// Funciones puras que usan tanto la app como la Action.
import { INDEX_SYMBOLS } from './config.js';

const num = (s) => {
  if (s == null) return null;
  const n = parseFloat(String(s).replace(/[,%+]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// Respuesta de quote.cnbc.com → [{sym,label,last,change,changePct,realTime,time}]
export function parseCnbcQuotes(json) {
  const list = json?.FormattedQuoteResult?.FormattedQuote;
  if (!Array.isArray(list)) throw new Error('Formato de cotizaciones inesperado');
  const bySym = new Map(list.map((q) => [q.symbol, q]));
  const out = [];
  for (const { sym, label } of INDEX_SYMBOLS) {
    const q = bySym.get(sym);
    if (!q || q.code !== 0 || num(q.last) == null) continue;
    out.push({
      sym,
      label,
      last: num(q.last),
      change: num(q.change),
      changePct: num(q.change_pct),
      realTime: String(q.realTime) === 'true',
      time: q.last_time || null,
    });
  }
  if (!out.length) throw new Error('Sin cotizaciones válidas');
  return out;
}

// Texto plano en una sola línea, recortado a `max` caracteres.
export function oneLine(text, max = 180) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:–-]+$/, '') + '…';
}

// Hash corto y estable (FNV-1a) para ids.
export function hashId(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function normalizeUrl(u) {
  try {
    const url = new URL(u);
    url.hash = '';
    for (const k of [...url.searchParams.keys()]) {
      if (/^(utm_|mc_|cmpid|ref$|src$|__source)/i.test(k)) url.searchParams.delete(k);
    }
    url.hostname = url.hostname.replace(/^www\./, '');
    return url.toString().replace(/\/$/, '');
  } catch {
    return String(u || '').trim();
  }
}

export function normalizeTitle(t) {
  return String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
