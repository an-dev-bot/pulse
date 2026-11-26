// Lectores de fuentes: RSS 2.0 / Atom y el calendario de Forex Factory.
// Solo se toman título, enlace, hora y una línea de resumen. Nunca el cuerpo del artículo.
import { oneLine, hashId, normalizeUrl } from '../app/js/shared.js';
import { MEME_WORDS } from '../app/js/config.js';
import { LIMITS } from './sources.mjs';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', laquo: '«', raquo: '»', euro: '€', pound: '£', copy: '©', reg: '®', trade: '™' };

export function decodeEntities(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function unCdata(s) {
  return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

export function stripHtml(s) {
  return decodeEntities(
    unCdata(s)
      .replace(/<(script|style|figure|figcaption)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/<[^>]+>/g, ' ') // por si había HTML escapado
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block, names) {
  for (const n of names) {
    const re = new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${n}>`, 'i');
    const m = block.match(re);
    if (m) return m[1];
  }
  return '';
}

function atomLink(block) {
  const links = [...block.matchAll(/<link\b([^>]*?)\/?>/gi)].map((m) => m[1]);
  for (const attrs of links) {
    const rel = (attrs.match(/rel=["']([^"']+)/i) || [])[1] || 'alternate';
    const href = (attrs.match(/href=["']([^"']+)/i) || [])[1];
    if (href && rel === 'alternate') return href;
  }
  return '';
}

function parseDate(s) {
  if (!s) return null;
  const d = new Date(stripHtml(s));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Primera frase razonable de la descripción; nunca más de una línea.
export function summarize(description, title) {
  let t = stripHtml(description);
  // Quita colas típicas de feeds («The post X appeared first on Y», «Read more», «Continue reading»)
  t = t.replace(/\s*(The post .+ appeared first on .+|Read more.*|Continue reading.*|\[…\]|\[\.\.\.\])$/i, '').trim();
  if (!t) return '';
  if (t.toLowerCase() === String(title || '').toLowerCase()) return '';
  const first = t.match(/^(.{40,}?[.!?])(\s|$)/);
  return oneLine(first ? first[1] : t, LIMITS.summaryChars);
}

function memeTagged(text) {
  const low = ` ${text.toLowerCase()} `;
  return MEME_WORDS.some((w) => {
    const re = new RegExp(`(^|[^a-z0-9$])${w.replace(/[.$*+?^()[\]{}|\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i');
    return re.test(low);
  });
}

export function parseFeed(xml, source, now = new Date()) {
  const text = String(xml || '');
  if (!/<(rss|feed|rdf:RDF)\b/i.test(text)) throw new Error('No es un feed RSS/Atom');
  const blocks = [...text.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  const items = [];
  for (const b of blocks) {
    const title = oneLine(stripHtml(tag(b, ['title'])), 220);
    let link = stripHtml(tag(b, ['link'])) || atomLink(b);
    if (!link) {
      const guid = stripHtml(tag(b, ['guid']));
      if (/^https?:\/\//.test(guid)) link = guid;
    }
    if (!title || !/^https?:\/\//i.test(link)) continue;
    const date = parseDate(tag(b, ['pubDate', 'published', 'updated', 'dc:date']));
    const summary = summarize(tag(b, ['description', 'summary', 'media:description']), title);
    const time = (date && date <= new Date(now.getTime() + 10 * 60e3) ? date : now).toISOString();
    const tags = [source.market];
    if (source.market === 'crypto' && memeTagged(`${title} ${summary}`)) tags.push('meme');
    if (source.market === 'meme') tags.push('crypto');
    items.push({
      id: hashId(normalizeUrl(link)),
      title,
      summary,
      url: link.trim(),
      source: source.name,
      sourceId: source.id,
      market: source.market,
      tags,
      lang: source.lang,
      time,
    });
    if (items.length >= (source.maxItems || LIMITS.perSource)) break;
  }
  if (!items.length && blocks.length) throw new Error('El feed no trae noticias legibles');
  return items;
}

const IMPACT = { high: 'high', medium: 'medium', low: 'low', holiday: 'holiday', 'non-economic': 'low' };

export function parseFFCalendar(json) {
  if (!Array.isArray(json)) throw new Error('Calendario con formato inesperado');
  const events = [];
  for (const e of json) {
    const d = new Date(e.date);
    if (!e.title || Number.isNaN(d.getTime())) continue;
    events.push({
      id: hashId(`${e.title}|${e.country}|${d.toISOString()}`),
      title: String(e.title),
      country: String(e.country || ''),
      time: d.toISOString(),
      impact: IMPACT[String(e.impact || '').toLowerCase()] || 'low',
      forecast: e.forecast || '',
      previous: e.previous || '',
      actual: e.actual || '',
    });
  }
  if (!events.length) throw new Error('Calendario vacío');
  events.sort((a, b) => a.time.localeCompare(b.time));
  return events;
}
