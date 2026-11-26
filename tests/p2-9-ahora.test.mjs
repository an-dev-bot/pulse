// P2 prueba 9: pantalla «Now». En este orden: Top 3 → próximo evento alto con cuenta regresiva → movimientos de mi lista
// → historias (Top/Latest). Sale de las copias guardadas.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, startServer, newPage, ready, prepareData } from './helpers.mjs';

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

test('p2 Now: los cuatro bloques salen en orden y con contenido', async () => {
  const { context, page } = await newPage(browser, srv.url, { lang: 'en' });
  await page.clock.setFixedTime(new Date('2026-11-25T12:00:00Z'));
  await page.goto(srv.url);
  await ready(page);
  const order = await page.$$eval('#v-live [data-slot]', (els) => els.map((e) => e.dataset.slot).filter((s) => ['top3', 'next', 'movers', 'live'].includes(s)));
  assert.deepEqual(order, ['top3', 'next', 'movers', 'live']);

  // 1) Top 3: tres historias, de alto impacto primero, con la nota «estimado por reglas»
  const t3 = await page.$$eval('#v-live .t3', (x) => x.map((e) => e.querySelector('.lvl').textContent));
  assert.equal(t3.length, 3);
  assert.ok(t3.every((l) => l === 'High'), t3.join(','));
  assert.match(await page.textContent('#v-live'), /Impact is estimated by rules\./);

  // 2) Próximo evento alto con cuenta regresiva (Core PCE a las 13:30 UTC)
  assert.match(await page.textContent('#v-live [data-slot="next"]'), /Core PCE Price Index m\/m/);
  assert.equal(await page.textContent('#v-live [data-slot="next"] .cd'), 'in 1 h 30 min');

  // 3) Movimientos de mi lista (por defecto NVDA, AAPL, MSFT, TSLA, SPY, QQQ), ordenados por tamaño del cambio
  const mv = await page.$$eval('#v-live .mv', (x) => x.map((e) => e.dataset.open));
  assert.deepEqual([...mv].sort(), ['AAPL', 'MSFT', 'NVDA', 'QQQ', 'SPY', 'TSLA']);
  assert.equal(mv[0], 'NVDA', 'el que más se movió va primero (−3.91%)');
  assert.match(await page.$eval('#v-live [data-slot="movers"]', (e) => e.parentElement.textContent), /CNBC · delayed/);

  // 4) Historias con Top/Latest
  const first = await page.getAttribute('#v-live [data-slot="live"] .it', 'data-id');
  await page.click('#v-live [data-chip="sort"][data-v="latest"]');
  const times = await page.$$eval('#v-live [data-slot="live"] .it time', (x) => x.map((e) => e.getAttribute('datetime')));
  assert.deepEqual(times, [...times].sort().reverse(), 'Latest: de lo más nuevo a lo más viejo');
  await page.click('#v-live [data-chip="sort"][data-v="top"]');
  assert.equal(await page.getAttribute('#v-live [data-slot="live"] .it', 'data-id'), first);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('p1.prefs')).sort), 'top', 'se recuerda');
  await context.close();
});

test('p2 Now: mi lista y mis palabras clave suben historias en «Top» (solo en el teléfono)', async () => {
  const { context, page } = await newPage(browser, srv.url, { lang: 'en', storage: { 'p1.watchlist': JSON.stringify(['AMD']) } });
  await page.clock.setFixedTime(new Date('2026-11-26T08:10:00Z'));
  await page.goto(srv.url);
  await ready(page);
  const before = await page.$$eval('#v-live [data-slot="live"] .it', (x) => x.map((e) => e.dataset.id));
  const amd = await page.evaluate(() => window.p1.state.stories.stories.find((s) => s.assets.includes('AMD'))?.id);
  if (amd) {
    await page.evaluate(() => localStorage.setItem('p1.watchlist', JSON.stringify(['NVDA'])));
    await page.reload();
    await ready(page);
    const after = await page.$$eval('#v-live [data-slot="live"] .it', (x) => x.map((e) => e.dataset.id));
    assert.notDeepEqual(after, before, 'cambiar mi lista cambia el orden Top');
  }
  await context.close();
});

// P2.1: mi lista ordena dentro de Alto/Medio, pero no mete una historia «Bajo» en el Top 3 si hay 3 de Alto/Medio.
// Caso real del 26-nov: dos notas de opinión sobre Nvidia (Bajo) salían 1.ª y 3.ª con NVDA en la lista.
test('p2 Now: una historia «Bajo» no entra al Top 3 por mi lista si hay 3 de Alto/Medio', async () => {
  const { pickTop3 } = await import('../app/js/rank.js');
  const now = Date.parse('2026-11-26T18:20:00Z');
  const s = (id, level, time, assets = []) => ({ id, level, time, assets, n: 1 });
  const list = [
    s('op1', 'low', '2026-11-26T16:30:00Z', ['NVDA']),
    s('op2', 'low', '2026-11-26T15:30:00Z', ['NVDA']),
    s('nv', 'high', '2026-11-25T17:19:33Z', ['NVDA']),
    s('cpi', 'high', '2026-11-26T11:53:00Z', ['USD']),
    s('gold', 'medium', '2026-11-26T18:01:00Z', ['XAU', 'USD']),
    s('bok', 'medium', '2026-11-26T18:04:00Z'),
  ];
  const ctx = { watch: new Set(['NVDA']) };
  const top = pickTop3(list, ctx, now);
  assert.equal(top.length, 3);
  assert.ok(top.every((x) => x.level !== 'low'), top.map((x) => x.id).join());
  // con menos de 3 de Alto/Medio, «Bajo» rellena al final
  const few = pickTop3([list[0], list[3]], ctx, now);
  assert.deepEqual(few.map((x) => x.id), ['cpi', 'op1']);
});
