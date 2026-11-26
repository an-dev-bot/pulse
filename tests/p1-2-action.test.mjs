// Prueba 2: la Action junta, quita duplicados, ordena por hora y escribe JSON válido; si una fuente falla, las demás siguen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collect, fixtureFetcher, writeOutput, dedupeAndSort } from '../scripts/collect.mjs';
import { NEWS_SOURCES } from '../scripts/sources.mjs';
import { normalizeUrl, normalizeTitle } from '../app/js/shared.js';

const NOW = new Date('2026-11-26T08:00:00Z');
const fx = fixtureFetcher('tests/fixtures');

test('p1 junta todas las fuentes, sin duplicados y ordenado de lo más nuevo a lo más viejo', async () => {
  const d = await collect({ fetchText: fx, now: NOW });
  const items = d.news.items;
  assert.ok(items.length > 100);
  const urls = items.map((i) => normalizeUrl(i.url));
  assert.equal(new Set(urls).size, urls.length, 'URLs repetidas');
  const titles = items.map((i) => normalizeTitle(i.title)).filter((t) => t.length > 12);
  assert.equal(new Set(titles).size, titles.length, 'títulos repetidos');
  for (let i = 1; i < items.length; i++) assert.ok(items[i - 1].time >= items[i].time, 'orden por hora');
  const markets = new Set(items.flatMap((i) => i.tags));
  for (const m of ['meme', 'crypto', 'forex', 'stocks']) assert.ok(markets.has(m), m);
  assert.ok(Object.values(d.status.sources).every((s) => s.ok));
  assert.ok(d.calendar.events.length > 0 && d.indices.quotes.length > 0);
});

test('p1 la misma noticia en dos feeds sale una sola vez (y conserva ambas etiquetas)', () => {
  const a = { id: 'a', title: 'Bitcoin hits a new high today', url: 'https://www.x.com/n/1?utm_source=rss', time: '2026-11-26T07:00:00Z', market: 'crypto', tags: ['crypto'] };
  const b = { ...a, id: 'b', url: 'https://x.com/n/1', tags: ['meme'] };
  const c = { ...a, id: 'c', url: 'https://other.com/2', title: 'Bitcoin hits a NEW high today!' };
  const out = dedupeAndSort([a, b, c]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].tags.sort(), ['crypto', 'meme']);
});

test('p1 escribe JSON válido', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'p1-'));
  await writeOutput(dir, await collect({ fetchText: fx, now: NOW }));
  const files = (await readdir(dir)).sort();
  assert.deepEqual(files, ['calendar.json', 'crypto.json', 'indices.json', 'markets.json', 'news.json', 'snapshots.json', 'status.json', 'stories.json']); // P2: cuatro archivos nuevos
  for (const f of files) JSON.parse(await readFile(join(dir, f), 'utf8'));
});

test('p1 si una fuente falla, las demás siguen y se conserva lo anterior de la que falló', async () => {
  const good = await collect({ fetchText: fx, now: NOW });
  const broken = new Set([NEWS_SOURCES[0].url, NEWS_SOURCES[5].url]);
  const flaky = async (url) => {
    if (broken.has(url)) throw new Error('HTTP 403');
    if (url.includes('faireconomy')) return 'not json';
    return fx(url);
  };
  const later = new Date(NOW.getTime() + 15 * 60e3);
  const d = await collect({ fetchText: flaky, now: later, prev: good });
  const st = d.status.sources;
  assert.equal(st[NEWS_SOURCES[0].id].ok, false);
  assert.equal(st[NEWS_SOURCES[5].id].ok, false);
  assert.equal(st.forexfactory.ok, false);
  assert.ok(st[NEWS_SOURCES[1].id].ok && st['cnbc-top'].ok, 'las demás siguen');
  assert.ok(d.news.items.some((i) => i.sourceId === NEWS_SOURCES[0].id), 'conserva lo anterior de la fuente caída');
  assert.equal(d.calendar.events.length, good.calendar.events.length, 'calendario anterior conservado');
  // Sin publicación anterior y sin red, igual escribe algo válido
  const d2 = await collect({ fetchText: async () => { throw new Error('sin red'); }, now: NOW });
  assert.deepEqual(d2.news.items, []);
  assert.ok(Object.values(d2.status.sources).every((s) => !s.ok));
});
