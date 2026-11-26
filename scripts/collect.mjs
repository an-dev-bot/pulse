// Junta las fuentes que no se pueden pedir desde el teléfono y escribe JSON en `--out`.
// Uso: node scripts/collect.mjs --out dist/data [--prev <url o carpeta de la publicación anterior>] [--fixtures tests/fixtures]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP } from '../app/js/config.js';
import { normalizeTitle, normalizeUrl, parseCnbcQuotes } from '../app/js/shared.js';
import { NEWS_SOURCES, CALENDAR_SOURCE, INDICES_SOURCE, LIMITS } from './sources.mjs';
import { parseFeed, parseFFCalendar } from './parse.mjs';

export const USER_AGENT = `${APP.name}NewsReader/1.0 (personal RSS reader; GitHub Actions)`;

export async function defaultFetchText(url, { timeoutMs = 20000, retries = 1 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml, application/json;q=0.9, */*;q=0.5' },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export function fixtureFetcher(dir) {
  const byUrl = new Map([...NEWS_SOURCES, CALENDAR_SOURCE, INDICES_SOURCE].map((s) => [s.url, s.id]));
  return async (url) => {
    const id = byUrl.get(url);
    if (!id) throw new Error(`Sin copia guardada para ${url}`);
    for (const ext of ['xml', 'json']) {
      const p = join(dir, `${id}.${ext}`);
      if (existsSync(p)) return readFile(p, 'utf8');
    }
    throw new Error(`Sin copia guardada para ${id}`);
  };
}

export function dedupeAndSort(items, max = LIMITS.maxItems) {
  const byUrl = new Set();
  const byTitle = new Set();
  const out = [];
  // Primero lo más nuevo; si hay duplicado se queda el primero que llegó (orden de fuentes).
  const sorted = [...items].sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  for (const it of sorted) {
    const u = normalizeUrl(it.url);
    const t = normalizeTitle(it.title);
    if (byUrl.has(u) || (t.length > 12 && byTitle.has(t))) {
      const prev = out.find((o) => normalizeUrl(o.url) === u || normalizeTitle(o.title) === t);
      if (prev) for (const tg of it.tags || []) if (!prev.tags.includes(tg)) prev.tags.push(tg);
      continue;
    }
    byUrl.add(u);
    byTitle.add(t);
    out.push({ ...it, tags: [...(it.tags || [it.market])] });
    if (out.length >= max) break;
  }
  return out;
}

export async function collect({ fetchText = defaultFetchText, now = new Date(), prev = {} } = {}) {
  const status = {};
  const nowIso = now.toISOString();
  const prevStatus = prev.status?.sources || {};
  const prevNews = Array.isArray(prev.news?.items) ? prev.news.items : [];

  const results = await Promise.all(
    NEWS_SOURCES.map(async (src) => {
      try {
        const items = parseFeed(await fetchText(src.url), src, now);
        status[src.id] = { name: src.name, ok: true, count: items.length, checkedAt: nowIso, lastOk: nowIso };
        return items;
      } catch (e) {
        status[src.id] = { name: src.name, ok: false, count: 0, error: String(e.message || e), checkedAt: nowIso, lastOk: prevStatus[src.id]?.lastOk || null };
        return [];
      }
    })
  );

  // Cada fuente puede tener su propia ventana de antigüedad (el feed de memecoins publica poco).
  const srcById = new Map(NEWS_SOURCES.map((s) => [s.id, s]));
  const minTimeFor = (id) => new Date(now.getTime() - (srcById.get(id)?.maxAgeHours || LIMITS.maxAgeHours) * 3600e3).toISOString();
  const inWindow = (it) => srcById.has(it.sourceId) && it.time >= minTimeFor(it.sourceId);
  const fresh = results.flat().filter(inWindow);
  const kept = prevNews.filter((it) => inWindow(it) && it.url && it.title);
  const items = dedupeAndSort([...fresh, ...kept]);

  let calendar = prev.calendar || null;
  try {
    const events = parseFFCalendar(JSON.parse(await fetchText(CALENDAR_SOURCE.url)));
    calendar = { generatedAt: nowIso, source: CALENDAR_SOURCE.name, events };
    status[CALENDAR_SOURCE.id] = { name: CALENDAR_SOURCE.name, ok: true, count: events.length, checkedAt: nowIso, lastOk: nowIso };
  } catch (e) {
    status[CALENDAR_SOURCE.id] = { name: CALENDAR_SOURCE.name, ok: false, count: 0, error: String(e.message || e), checkedAt: nowIso, lastOk: prevStatus[CALENDAR_SOURCE.id]?.lastOk || null };
  }

  let indices = prev.indices || null;
  try {
    const quotes = parseCnbcQuotes(JSON.parse(await fetchText(INDICES_SOURCE.url)));
    indices = { generatedAt: nowIso, source: INDICES_SOURCE.name, quotes };
    status[INDICES_SOURCE.id] = { name: INDICES_SOURCE.name, ok: true, count: quotes.length, checkedAt: nowIso, lastOk: nowIso };
  } catch (e) {
    status[INDICES_SOURCE.id] = { name: INDICES_SOURCE.name, ok: false, count: 0, error: String(e.message || e), checkedAt: nowIso, lastOk: prevStatus[INDICES_SOURCE.id]?.lastOk || null };
  }

  return {
    news: { generatedAt: nowIso, items },
    calendar: calendar || { generatedAt: null, events: [] },
    indices: indices || { generatedAt: null, quotes: [] },
    status: { generatedAt: nowIso, sources: status },
  };
}

async function loadPrev(where) {
  const prev = {};
  if (!where) return prev;
  for (const name of ['news', 'calendar', 'indices', 'status']) {
    try {
      let text;
      if (/^https?:\/\//.test(where)) {
        const r = await fetch(`${where.replace(/\/$/, '')}/${name}.json`, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': USER_AGENT } });
        if (!r.ok) continue;
        text = await r.text();
      } else {
        const p = join(where, `${name}.json`);
        if (!existsSync(p)) continue;
        text = await readFile(p, 'utf8');
      }
      prev[name] = JSON.parse(text);
    } catch {
      /* sin publicación anterior: se empieza de cero */
    }
  }
  return prev;
}

export async function writeOutput(outDir, data) {
  await mkdir(outDir, { recursive: true });
  for (const [name, value] of Object.entries(data)) {
    await writeFile(join(outDir, `${name}.json`), JSON.stringify(value));
  }
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] || '')).href) {
  const out = arg('out') || 'dist/data';
  const fixtures = arg('fixtures');
  const nowArg = arg('now');
  const prev = await loadPrev(arg('prev'));
  const data = await collect({
    fetchText: fixtures ? fixtureFetcher(fixtures) : defaultFetchText,
    now: nowArg ? new Date(nowArg) : new Date(),
    prev,
  });
  await writeOutput(out, data);
  const s = data.status.sources;
  for (const [id, v] of Object.entries(s)) console.log(`${v.ok ? 'OK  ' : 'FALLA'} ${id.padEnd(16)} ${v.ok ? v.count : v.error}`);
  console.log(`${data.news.items.length} noticias, ${data.calendar.events.length} eventos, ${data.indices.quotes.length} índices → ${out}`);
}
