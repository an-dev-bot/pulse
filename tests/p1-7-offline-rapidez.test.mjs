// Prueba 7: sin internet abre con lo último; abrir < 2 s y cambiar de pestaña < 150 ms con la CPU 4× más lenta.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, startServer, newPage, ready, prepareData, TABS } from './helpers.mjs';

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

test('p1 sin internet abre con lo último guardado y su hora', async () => {
  const { context, page } = await newPage(browser, srv.url);
  await page.goto(srv.url);
  await ready(page);
  await page.click('.tabs [data-tab="memes"]');
  await page.waitForSelector('#v-memes .coin', { timeout: 10000 });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // ahora la página queda controlada por el service worker
  await ready(page);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const liveCount = await page.$$eval('#v-live .it', (x) => x.length);

  await context.setOffline(true);
  await context.unrouteAll({ behavior: 'ignoreErrors' });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort('internetdisconnected'));
  await page.reload();
  await ready(page);
  assert.equal(await page.$$eval('#v-live .it', (x) => x.length), liveCount, 'mismas noticias');
  await page.waitForSelector('#offline:not([hidden])');
  assert.match(await page.textContent('#offline'), /Sin conexión/);
  assert.match(await page.textContent('#v-live [data-upd]'), /Actualizado (hace .+|ahora)/);
  assert.match(await page.textContent('#ticker'), /BTC\$\d/);
  assert.match(await page.textContent('#ticker'), /S&P 500/);
  await page.click('.tabs [data-tab="memes"]');
  assert.ok((await page.$$('#v-memes .coin')).length > 0, 'memecoins guardadas');
  await page.click('.tabs [data-tab="forex"]');
  assert.ok((await page.$$('#v-forex .ev')).length > 0, 'calendario guardado');
  await context.close();
});

test('p1 rapidez con CPU 4× más lenta: abrir < 2 s y cambiar de pestaña < 150 ms', async () => {
  const { context, page } = await newPage(browser, srv.url);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(srv.url);
  await ready(page);
  const cold = await page.evaluate(() => performance.getEntriesByName('p1-ready')[0].startTime);
  await page.reload();
  await ready(page);
  const warm = await page.evaluate(() => performance.getEntriesByName('p1-ready')[0].startTime);
  console.log(`abrir: primera vez ${cold.toFixed(0)} ms, con caché ${warm.toFixed(0)} ms`);
  assert.ok(cold < 2000, `primera apertura ${cold} ms`);
  assert.ok(warm < 2000, `apertura con caché ${warm} ms`);

  const times = {};
  for (const round of [1, 2]) {
    for (const tab of [...TABS.slice(1), 'live']) {
      const dt = await page.evaluate(async (tab) => {
        const b = document.querySelector(`.tabs [data-tab="${tab}"]`);
        const t0 = performance.now();
        b.click();
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
        return performance.now() - t0;
      }, tab);
      times[`${tab}#${round}`] = Math.round(dt);
      await page.waitForTimeout(150);
    }
  }
  console.log('cambiar de pestaña (ms):', JSON.stringify(times));
  for (const [k, v] of Object.entries(times)) assert.ok(v < 150, `${k}: ${v} ms`);
  await context.close();
});
