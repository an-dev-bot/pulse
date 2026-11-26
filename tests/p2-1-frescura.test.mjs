// P2 prueba 1: frescura. Cada sección dice cuándo se revisó; con datos de más de 45 min sale un aviso tranquilo
// («Data is X old. Last update: HH:MM»); una fuente que falla se ve en su sección y en Sources; lo vacío explica por qué.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, startServer, newPage, ready, prepareData, goTo, FIXTURE_NOW } from './helpers.mjs';
import { isStale } from '../app/js/rank.js';

let browser, srv, data;
before(async () => {
  data = await prepareData();
  srv = await startServer('dist');
  browser = await launch();
});
after(async () => {
  await browser?.close();
  srv?.server.close();
});

const at = (min) => new Date(FIXTURE_NOW.getTime() + min * 60e3);

test('p2 frescura: la regla de 45 minutos', () => {
  assert.equal(isStale(FIXTURE_NOW.toISOString(), at(45).getTime()), false);
  assert.equal(isStale(FIXTURE_NOW.toISOString(), at(46).getTime()), true);
  assert.equal(isStale(null, at(0).getTime()), true, 'sin fecha = viejo');
});

test('p2 frescura: datos al día → «Checked …» y sin aviso', async () => {
  const { context, page } = await newPage(browser, srv.url, { lang: 'en' });
  await page.clock.setFixedTime(at(10));
  await page.goto(srv.url);
  await ready(page);
  assert.match(await page.textContent('#v-live [data-upd="news"]'), /^Checked 10 min.? ago$/);
  assert.deepEqual(await page.$$eval('[data-stale]', (b) => b.map((x) => x.dataset.stale)), []);
  for (const tab of ['stocks', 'forex', 'calendar']) {
    await goTo(page, tab);
    assert.match(await page.textContent(`.view:not([hidden]) [data-upd]`), /^Checked /, tab);
  }
  await context.close();
});

test('p2 frescura: datos viejos (2 h) → aviso tranquilo con la edad y la hora de la última actualización', async () => {
  for (const [lang, re] of [['en', /^Data is 2 h 0 min old\. Last update: 02:00/], ['es', /^Los datos tienen 2 h 0 min de antigüedad\. Última actualización: 02:00/]]) {
    const { context, page } = await newPage(browser, srv.url, { lang });
    await page.clock.setFixedTime(at(120));
    await page.goto(srv.url);
    await ready(page);
    const banner = page.locator('#v-live [data-stale="news"]');
    assert.match(await banner.textContent(), re);
    // tranquilo: no es una caja roja de error
    const bg = await banner.evaluate((e) => getComputedStyle(e).backgroundColor);
    assert.notEqual(bg, 'rgb(255, 59, 92)');
    await goTo(page, 'calendar');
    assert.equal(await page.locator('#v-calendar [data-stale="calendar"]').count(), 1);
    await context.close();
  }
});

test('p2 frescura: una fuente que falla se ve en su sección (con su último éxito) y en Sources', async () => {
  const { context, page } = await newPage(browser, srv.url, { lang: 'en' });
  await page.clock.setFixedTime(at(5));
  await page.route('**/data/status.json*', (route) => {
    const s = structuredClone(data.status);
    s.sources.forexfactory = { ...s.sources.forexfactory, ok: false, error: 'HTTP 503', count: 0, lastOk: '2026-11-25T20:00:00.000Z' };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(s) });
  });
  await page.goto(srv.url);
  await ready(page);
  await goTo(page, 'calendar');
  const fail = page.locator('#v-calendar [data-fail="forexfactory"]');
  await fail.waitFor();
  assert.match(await fail.textContent(), /^Forex Factory is not responding \(checked 02:00\)\. Last worked: .*14:00\.$/);
  // Otras secciones que no usan esa fuente no lo muestran
  await goTo(page, 'crypto');
  assert.equal(await page.locator('#v-markets [data-fail="forexfactory"]').count(), 0);
  await goTo(page, 'sources');
  const row = page.locator('#v-more [data-src="forexfactory"]');
  assert.match(await row.textContent(), /Forex Factory/);
  assert.match(await row.textContent(), /HTTP 503/);
  assert.match(await row.textContent(), /failing/);
  assert.equal(await row.locator('.dot.bad').count(), 1);
  assert.ok((await page.locator('#v-more [data-src]').count()) >= 15, 'todas las fuentes de status.json');
  await context.close();
});

test('p2 frescura: lo vacío explica por qué', async () => {
  const { context, page } = await newPage(browser, srv.url, { lang: 'en' });
  await page.clock.setFixedTime(at(5));
  await page.goto(srv.url);
  await ready(page);
  await goTo(page, 'saved');
  assert.equal(await page.textContent('#v-more .empty'), 'Nothing saved yet. Tap the star on any story to keep it here.');
  await goTo(page, 'stocks');
  await page.fill('#stock-q', 'QQZZ');
  assert.match(await page.textContent('[data-untracked]'), /not tracked yet/);
  await context.close();
});
