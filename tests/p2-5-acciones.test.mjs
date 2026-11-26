// P2 prueba 5: acciones. Cotizaciones de CNBC se leen bien; quién sube y quién baja; buscar por símbolo y por nombre;
// lo que no está en el universo lo dice; mi lista nunca sale en una petición; fechas «(est)» se muestran como «est.».
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCnbcAny, parseEarnings, universeSymbols, universeUrls } from '../scripts/markets.mjs';
import { gainersLosers, searchUniverse, sectorMoves } from '../app/js/rank.js';
import { UNIVERSE, DEFAULT_WATCHLIST } from '../app/js/config.js';
import { launch, startServer, newPage, ready, prepareData, recordRequests, goTo, P2_TABS, TABS } from './helpers.mjs';

const fx = (n) => JSON.parse(readFileSync(`tests/fixtures/${n}`, 'utf8'));

test('p2 acciones: las cotizaciones de CNBC se leen (precio, cambio, %, hora, resultados)', () => {
  const q = { ...parseCnbcAny(fx('cnbc-universe-1.json')), ...parseCnbcAny(fx('cnbc-universe-2.json')), ...parseCnbcAny(fx('cnbc-universe-3.json')) };
  assert.ok(Object.keys(q).length >= 60, `${Object.keys(q).length} cotizaciones`);
  assert.deepEqual(q.NVDA, { sym: 'NVDA', name: 'NVIDIA Corporation', last: 149.3, time: '2026-11-25', realTime: true, change: -6.08, changePct: -3.91, earnings: { date: '2027-02-23', est: true } });
  for (const v of Object.values(q)) {
    assert.ok(Number.isFinite(v.last), `${v.sym} sin precio`);
    if ('changePct' in v) assert.ok(Number.isFinite(v.changePct));
  }
  // Un símbolo que CNBC no conoce (code ≠ 0) no aparece; nada se inventa.
  const bad = parseCnbcAny({ FormattedQuoteResult: { FormattedQuote: [{ symbol: 'ZZZZ', code: 1, last: '' }, { symbol: 'X', code: 0, last: 'N/A' }] } });
  assert.deepEqual(bad, {});
});

test('p2 acciones: el universo vive en config.js y se pide a CNBC por tandas', () => {
  const syms = universeSymbols();
  for (const s of DEFAULT_WATCHLIST) assert.ok(syms.includes(s), `${s} en el universo`);
  for (const s of ['AMX', 'FMX', 'KOF', 'CX', 'XLK', 'XLF']) assert.ok(syms.includes(s), s);
  const urls = universeUrls();
  assert.ok(urls.length >= 2, 'varias tandas');
  for (const u of urls) {
    assert.match(u, /^https:\/\/quote\.cnbc\.com\//);
    assert.ok(decodeURIComponent(u).split('symbols=')[1].split('|').length <= 40);
  }
});

test('p2 acciones: quién sube y quién baja (solo acciones, sin ETFs)', () => {
  const q = {
    NVDA: { sym: 'NVDA', changePct: 4.2 }, AAPL: { sym: 'AAPL', changePct: -2.5 }, MSFT: { sym: 'MSFT', changePct: 1.1 },
    TSLA: { sym: 'TSLA', changePct: -6.0 }, SPY: { sym: 'SPY', changePct: 9 }, XLK: { sym: 'XLK', changePct: -9 },
    AMX: { sym: 'AMX', changePct: 0.4 }, AMZN: { sym: 'AMZN', changePct: 0 }, META: { sym: 'META' },
  };
  const { gainers, losers } = gainersLosers(q, 3);
  assert.deepEqual(gainers.map((x) => x.sym), ['NVDA', 'MSFT', 'AMX']);
  assert.deepEqual(losers.map((x) => x.sym), ['TSLA', 'AAPL']);
  assert.deepEqual(sectorMoves(q).map((x) => x.sym), ['XLK']);
});

test('p2 acciones: buscar por símbolo y por nombre; lo que no está no se inventa', () => {
  assert.equal(searchUniverse('NVDA')[0].sym, 'NVDA');
  assert.equal(searchUniverse('$tsla')[0].sym, 'TSLA');
  assert.ok(searchUniverse('nvidia').some((u) => u.sym === 'NVDA'));
  assert.ok(searchUniverse('Coca').some((u) => u.sym === 'KOF'), 'FEMSA/Coca-Cola');
  assert.ok(searchUniverse('Cemex').some((u) => u.sym === 'CX'));
  assert.deepEqual(searchUniverse('ZZZZQ'), []);
  assert.deepEqual(searchUniverse('   '), []);
});

test('p2 acciones: fechas de resultados «(est)» quedan como estimadas', () => {
  assert.deepEqual(parseEarnings('02/23/2027(est)'), { date: '2027-02-23', est: true });
  assert.deepEqual(parseEarnings('02/23/2027 (EST)'), { date: '2027-02-23', est: true });
  assert.deepEqual(parseEarnings('12/11/2026'), { date: '2026-12-11', est: false });
  assert.equal(parseEarnings(''), null);
  assert.equal(parseEarnings('soon'), null);
});

// ---------- en la app ----------
let browser, srv;
before(async () => {
  await prepareData();
  srv = await startServer('dist');
  browser = await launch();
});
after(async () => {
  await browser?.close();
  srv?.server.close();
});

test('p2 acciones (app): resultados estimados dicen «est.»; los confirmados no; enlaces a CNBC y TradingView', async () => {
  const { context, page } = await newPage(browser, srv.url, { lang: 'en' });
  await page.goto(srv.url);
  await ready(page);
  await goTo(page, 'stocks');
  await page.click('#v-markets [data-slot="watch"] [data-open="NVDA"]');
  await page.waitForSelector('#sheet-detail:not([hidden])');
  const dd = page.locator('#detail-body [data-earnings]');
  assert.match(await dd.textContent(), /2027/);
  assert.equal(await dd.locator('.est').textContent(), 'est.');
  assert.match(await page.textContent('#detail-body'), /CNBC marks this date as an estimate/);
  assert.match(await page.textContent('#detail-body .dt-meta'), /CNBC · .+ · delayed/);
  assert.equal(await page.getAttribute('#detail-body a[href^="https://www.cnbc.com/quotes/"]', 'href'), 'https://www.cnbc.com/quotes/NVDA');
  assert.ok(await page.$('#detail-body a[href^="https://www.tradingview.com/"]'));
  // AVGO: CNBC da una fecha confirmada → sin «est.»
  await page.evaluate(() => window.p1.openDetail('AVGO'));
  assert.equal(await page.locator('#detail-body [data-earnings] .est').count(), 0);
  // Un índice sin fecha de resultados: no se muestra el renglón (no se inventa).
  await page.evaluate(() => window.p1.openDetail('.SPX'));
  assert.equal(await page.locator('#detail-body [data-earnings]').count(), 0);
  await context.close();
});

test('p2 acciones (app): buscar y «aún no se sigue»; mi lista no sale en ninguna petición', async () => {
  const MINE = ['KOF', 'FMX', 'CX'];
  const { context, page } = await newPage(browser, srv.url, { lang: 'en', storage: { 'p1.watchlist': JSON.stringify(MINE) } });
  const reqs = recordRequests(context);
  await page.goto(srv.url);
  await ready(page);
  await goTo(page, 'stocks');
  await page.fill('#stock-q', 'cemex');
  await page.waitForSelector('#v-markets [data-slot="stock-results"] [data-open="CX"]');
  await page.fill('#stock-q', 'ZZQQ');
  assert.equal(await page.textContent('[data-untracked]'), '“ZZQQ” is not tracked yet (add it to the universe in config.js).');
  // Mi lista se ve en la app…
  assert.deepEqual(await page.$$eval('#v-markets [data-slot="watch"] [data-open]', (b) => b.map((x) => x.dataset.open)), MINE);
  // …y se usa en todas partes, pero nunca viaja.
  for (const tab of [...P2_TABS, ...TABS]) await goTo(page, tab);
  await page.evaluate(() => window.p1.openDetail('KOF'));
  await page.evaluate(() => window.p1.refresh());
  await page.waitForTimeout(300);
  const net = reqs.filter((r) => /^https?:/.test(r.url));
  assert.ok(net.length > 5);
  for (const r of net) {
    const blob = `${r.url}\n${r.headers}\n${r.body}`;
    for (const s of ['KOF', 'FMX', 'p1.watchlist']) assert.ok(!blob.includes(s), `«${s}» salió en ${r.url}`);
  }
  await context.close();
});

test('p2 acciones: cada símbolo del universo tiene nombre y tipo', () => {
  for (const u of UNIVERSE) {
    assert.ok(u.sym && u.name && u.kind, JSON.stringify(u));
    assert.ok(['stock', 'etf', 'sector', 'adr'].includes(u.kind), u.sym);
  }
});
