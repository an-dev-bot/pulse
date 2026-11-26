// P2 prueba 6: mercados. Cripto esconde stablecoins y activos tokenizados; memecoins abren por volumen con
// liquidez ≥ $10k y edad ≥ 1 h (editables); lo pagado se llama «Promocionado» y nunca «trending/tendencia».
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isHiddenCoin, visibleCoins, memeFilter } from '../app/js/rank.js';
import { MEME_DEFAULTS, CRYPTO_DENY } from '../app/js/config.js';
import { STRINGS } from '../app/js/i18n.js';
import { launch, startServer, newPage, ready, prepareData, goTo } from './helpers.mjs';
import { TREND } from './p1-4-neutral.test.mjs';

const CG = JSON.parse(readFileSync('tests/fixtures/direct/coingecko.json', 'utf8')).map((c) => ({ id: c.id, symbol: c.symbol.toUpperCase(), price: c.current_price, change24: c.price_change_percentage_24h }));

test('p2 cripto: se esconden stablecoins (lista y regla «≈ $1 y plana») y activos tokenizados', () => {
  const shown = visibleCoins(CG).map((c) => c.symbol);
  for (const s of ['USDT', 'USDC', 'USDS', 'USDE', 'FIGR_HELOC']) assert.ok(!shown.includes(s), `${s} escondida`);
  for (const s of ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE']) assert.ok(shown.includes(s), `${s} visible`);
  // Una stablecoin nueva que no está en la lista se esconde por la regla…
  assert.equal(isHiddenCoin({ symbol: 'NEWUSD', price: 1.001, change24: 0.02 }), true);
  // …pero una moneda cerca de $1 que sí se mueve, no.
  assert.equal(isHiddenCoin({ symbol: 'XYZ', price: 0.99, change24: 6.5 }), false);
  for (const s of ['xaut', 'paxg']) assert.ok(CRYPTO_DENY.includes(s), `${s} (oro tokenizado) en la lista`);
});

test('p2 memecoins: filtros por defecto (volumen, liquidez ≥ $10k, edad ≥ 1 h); «Lanzamientos» sin filtro', () => {
  assert.deepEqual(MEME_DEFAULTS, { view: 'volume', minLiquidity: 10000, minAgeHours: 1 });
  const now = Date.parse('2026-11-26T08:00:00Z');
  const coins = [
    { key: 'a', liquidity: 50000, createdAt: '2026-11-20T00:00:00Z' },
    { key: 'b', liquidity: 9000, createdAt: '2026-11-20T00:00:00Z' }, // poca liquidez
    { key: 'c', liquidity: 80000, createdAt: '2026-11-26T07:30:00Z' }, // 30 min de vida
    { key: 'd', liquidity: null, createdAt: '2026-11-20T00:00:00Z' }, // sin dato de liquidez: no pasa el filtro
  ];
  const r = memeFilter(coins, 'volume', MEME_DEFAULTS, now);
  assert.deepEqual(r.shown.map((c) => c.key), ['a']);
  assert.equal(r.hidden, 3);
  assert.equal(memeFilter(coins, 'new', MEME_DEFAULTS, now).shown.length, 4);
  assert.equal(memeFilter(coins, 'volume', { minLiquidity: 0, minAgeHours: 0 }, now).shown.length, 4, 'editables');
});

test('p2 memecoins: ningún texto dice «trending/tendencia»; lo pagado se llama Promoted/Promocionado', () => {
  for (const lang of ['en', 'es']) for (const [k, v] of Object.entries(STRINGS[lang])) assert.ok(!TREND.test(v), `${lang} ${k}: ${v}`);
  assert.equal(STRINGS.en['meme.promo'], 'Promoted');
  assert.equal(STRINGS.es['meme.promo'], 'Promocionado');
});

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

test('p2 mercados (app): cripto sin stablecoins, con capitalización total, dominio de BTC y miedo/codicia (con fuente)', async () => {
  const { context, page } = await newPage(browser, srv.url, { lang: 'en' });
  await page.goto(srv.url);
  await ready(page);
  await goTo(page, 'crypto');
  await page.waitForSelector('#v-markets .coinrow');
  const syms = await page.$$eval('#v-markets .coinrow b', (b) => b.map((x) => x.textContent));
  assert.ok(syms.includes('BTC') && !syms.includes('USDT') && !syms.includes('USDC'), syms.join(' '));
  const tiles = await page.textContent('#v-markets .tiles');
  assert.match(tiles, /Total market cap/);
  assert.match(tiles, /BTC dominance/);
  assert.match(tiles, /Fear & Greed/);
  assert.match(tiles, /CoinGecko · /);
  assert.match(tiles, /alternative\.me · /);
  await context.close();
});

test('p2 mercados (app): memecoins abren por volumen con los filtros puestos; «Lanzamientos» avisa; promocionados marcados', async () => {
  const { context, page } = await newPage(browser, srv.url, { lang: 'en' });
  await page.goto(srv.url);
  await ready(page);
  await goTo(page, 'memes');
  await page.waitForSelector('#v-memes .coin');
  assert.equal(await page.getAttribute('[data-chip="mview"].sel', 'data-v'), 'volume');
  assert.equal(await page.inputValue('[data-mf="minLiquidity"]'), '10000');
  assert.equal(await page.inputValue('[data-mf="minAgeHours"]'), '1');
  const liq = await page.evaluate(() => window.p1.state.memes['solana.volume'].coins);
  const shownKeys = await page.$$eval('#v-memes .coin', (c) => c.map((x) => x.dataset.key));
  const now = await page.evaluate(() => Date.now());
  for (const k of shownKeys) {
    const c = liq.find((x) => x.key === k);
    assert.ok(c.liquidity >= 10000, `${k} liquidez ${c.liquidity}`);
    if (c.createdAt) assert.ok(now - Date.parse(c.createdAt) >= 3600e3, `${k} muy nueva`);
  }
  // Cambiar el filtro se nota en el acto y se recuerda
  await page.fill('[data-mf="minLiquidity"]', '0');
  await page.fill('[data-mf="minAgeHours"]', '0');
  assert.ok((await page.$$('#v-memes .coin')).length >= shownKeys.length);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('p1.prefs')).minLiquidity), 0);
  await page.click('[data-chip="mview"][data-v="new"]');
  await page.waitForSelector('#v-memes .coin');
  assert.match(await page.textContent('#v-memes .banner'), /New launches/i);
  await page.click('[data-chip="mview"][data-v="promoted"]');
  await page.waitForSelector('#v-memes .coin.promo');
  const badges = await page.$$eval('#v-memes .coin', (c) => c.map((x) => x.querySelector('.badge-promo')?.textContent));
  assert.ok(badges.every((b) => b === 'Promoted'));
  assert.ok(!TREND.test(await page.textContent('#v-memes')), 'sin «trending»');
  await context.close();
});

test('p2 mercados (app): forex con pares y DXY/10Y/oro/petróleo; sin evento alto, línea informativa (no un error rojo)', async () => {
  const { context, page } = await newPage(browser, srv.url, { lang: 'en' });
  await page.clock.setFixedTime(new Date('2026-11-29T12:00:00Z')); // domingo: ya no quedan eventos altos esa semana
  await page.goto(srv.url);
  await ready(page);
  await goTo(page, 'forex');
  const pairs = await page.textContent('#v-markets [data-slot="pairs"]');
  for (const p of ['EUR/USD', 'USD/JPY', 'USD/MXN']) assert.match(pairs, new RegExp(p.replace('/', '\\/')));
  const macro = await page.textContent('#v-markets');
  for (const m of ['DXY', 'US 10Y', 'Gold', 'WTI']) assert.ok(macro.includes(m), m);
  assert.match(await page.textContent('#v-markets .infoline'), /No high-impact events left this week/);
  assert.equal(await page.locator('#v-markets .srcfail, #v-markets .error').count(), 0);
  await context.close();
});

test('p2 mercados (app): calendario con fichas de impacto, hoy primero, su zona horaria y «actual»', async () => {
  const { context, page } = await newPage(browser, srv.url, { lang: 'en' });
  await page.clock.setFixedTime(new Date('2026-11-26T16:00:00Z'));
  await page.goto(srv.url);
  await ready(page);
  await goTo(page, 'calendar');
  assert.match(await page.textContent('#v-calendar .day'), /^Today/);
  assert.match(await page.textContent('#v-calendar'), /Mexico City/);
  assert.deepEqual(await page.$$eval('#v-calendar [data-chip="calimp"].sel', (c) => c.map((x) => x.dataset.v)), ['high', 'medium']);
  assert.equal(await page.locator('#v-calendar .ev.low').count(), 0, 'bajo apagado por defecto');
  await page.click('#v-calendar [data-chip="calimp"][data-v="low"]');
  assert.ok((await page.locator('#v-calendar .ev.low').count()) > 0);
  const withActual = await page.locator('#v-calendar .ev small', { hasText: 'Actual' }).count();
  const evs = await page.evaluate(() => window.p1.state.calendar.events.filter((e) => e.actual && e.time.slice(0, 10) >= '2026-11-26').length);
  assert.ok(withActual >= Math.min(1, evs), `«Actual» en ${withActual} de ${evs}`);
  await context.close();
});
