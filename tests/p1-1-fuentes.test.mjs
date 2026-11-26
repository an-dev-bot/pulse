// Prueba 1: cada fuente configurada se lee bien (con copias guardadas, sin internet).
// Las fuentes reales se revisan aparte con `npm run p1:fuentes`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { NEWS_SOURCES } from '../scripts/sources.mjs';
import { parseFeed, parseFFCalendar } from '../scripts/parse.mjs';
import { parseCnbcQuotes } from '../app/js/shared.js';
import { gtPoolsToCoins, dsPairsToCoins } from '../app/js/api.js';

const NOW = new Date('2026-11-26T08:00:00Z');
const read = (f) => readFileSync(`tests/fixtures/${f}`, 'utf8');

for (const s of NEWS_SOURCES) {
  test(`p1 fuente ${s.id}: responde (copia guardada) y se lee bien`, () => {
    assert.ok(existsSync(`tests/fixtures/${s.id}.xml`), 'falta la copia guardada; corre npm run p1:fixtures');
    const items = parseFeed(read(`${s.id}.xml`), s, NOW);
    assert.ok(items.length >= 5, `solo ${items.length} noticias`);
    for (const it of items) {
      assert.ok(it.title.length > 5, 'título');
      assert.match(it.url, /^https?:\/\//, 'enlace');
      assert.equal(it.source, s.name);
      assert.ok(!Number.isNaN(Date.parse(it.time)), 'hora');
      assert.equal(it.lang, s.lang);
      assert.ok(it.tags.includes(s.market));
    }
  });
}

test('p1 fuente forexfactory: calendario de la semana', () => {
  const ev = parseFFCalendar(JSON.parse(read('forexfactory.json')));
  assert.ok(ev.length > 10);
  assert.ok(ev.some((e) => e.impact === 'high'), 'hay eventos de alto impacto');
  for (const e of ev) {
    assert.ok(['high', 'medium', 'low', 'holiday'].includes(e.impact));
    assert.ok(!Number.isNaN(Date.parse(e.time)));
  }
  assert.deepEqual([...ev].sort((a, b) => a.time.localeCompare(b.time)), ev, 'ordenado por hora');
});

test('p1 fuente cnbc-quotes: índices de acciones y del dólar', () => {
  const q = parseCnbcQuotes(JSON.parse(read('cnbc-quotes.json')));
  const labels = q.map((x) => x.label);
  for (const l of ['S&P 500', 'Nasdaq', 'Dow', 'DXY']) assert.ok(labels.includes(l), l);
  for (const x of q) assert.ok(Number.isFinite(x.last) && Number.isFinite(x.changePct));
});

test('p1 fuentes directas (CoinGecko, GeckoTerminal, DEX Screener) se leen bien', () => {
  const cg = JSON.parse(read('direct/coingecko.json'));
  for (const s of ['btc', 'eth', 'sol']) assert.ok(cg.some((c) => c.symbol === s), s);
  for (const f of ['gt-new', 'gt-volume', 'gt-trending']) {
    const coins = gtPoolsToCoins(JSON.parse(read(`direct/${f}.json`)));
    assert.ok(coins.length > 5, f);
    for (const c of coins) {
      assert.ok(c.symbol && c.pool && c.token, `${f}: datos`);
      assert.match(c.dexUrl, /^https:\/\/dexscreener\.com\//);
      if (c.chain === 'solana') assert.match(c.riskUrl, /^https:\/\/rugcheck\.xyz\/tokens\//);
    }
  }
  const boosts = JSON.parse(read('direct/ds-boosts.json')).filter((b) => b.chainId === 'solana');
  const promo = dsPairsToCoins(JSON.parse(read('direct/ds-tokens.json')), boosts);
  assert.ok(promo.length > 3);
});

test('p1 un feed roto o bloqueado da error claro (no se cuela basura)', () => {
  assert.throws(() => parseFeed('<html><body>Access denied</body></html>', NEWS_SOURCES[0]), /RSS/);
  assert.throws(() => parseFFCalendar({ error: 'rate limited' }));
  assert.throws(() => parseCnbcQuotes({}));
});
