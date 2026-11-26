// P2 prueba 8: rapidez con la CPU 4× más lenta: abrir < 2 s y cambiar de pestaña < 150 ms, también con el mapa en vivo abierto.
// El mapa: tocar un nodo abre la historia; con «reducir movimiento» queda quieto; si el equipo es flojo, vuelve la lista.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, startServer, newPage, ready, prepareData, P2_TABS, FIXTURE_NOW } from './helpers.mjs';

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

async function switchTimes(page) {
  const times = {};
  for (const round of [1, 2]) {
    for (const tab of [...P2_TABS.slice(1), 'live']) {
      times[`${tab}#${round}`] = await page.evaluate(async (tab) => {
        const t0 = performance.now();
        document.querySelector(`.tabs [data-tab="${tab}"]`).click();
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
        return Math.round(performance.now() - t0);
      }, tab);
      await page.waitForTimeout(150);
    }
  }
  return times;
}

for (const map of [false, true]) {
  test(`p2 rapidez con CPU 4× ${map ? 'y el mapa en vivo abierto' : '(lista)'}: abrir < 2 s, cambiar de pestaña < 150 ms`, async () => {
    const { context, page } = await newPage(browser, srv.url, { lang: 'en', storage: map ? { 'p1.prefs': JSON.stringify({ map: true }) } : {} });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(srv.url);
    await ready(page);
    const cold = await page.evaluate(() => performance.getEntriesByName('p1-ready')[0].startTime);
    await page.reload();
    await ready(page);
    const warm = await page.evaluate(() => performance.getEntriesByName('p1-ready')[0].startTime);
    if (map) await page.waitForFunction(() => !!window.p1.map());
    const times = await switchTimes(page);
    console.log(`${map ? 'mapa' : 'lista'}: abrir ${cold.toFixed(0)} / ${warm.toFixed(0)} ms; pestañas`, JSON.stringify(times));
    assert.ok(cold < 2000 && warm < 2000, `abrir ${cold} / ${warm} ms`);
    for (const [k, v] of Object.entries(times)) assert.ok(v < 150, `${k}: ${v} ms`);
    await context.close();
  });
}

test('p2 mapa en vivo: cuadros a ~60 fps, en pausa fuera de la pestaña, y tocar un nodo abre la historia', async () => {
  const { context, page } = await newPage(browser, srv.url, { lang: 'en', width: 1440, height: 900, isMobile: false });
  await page.clock.setFixedTime(new Date(FIXTURE_NOW.getTime() + 10 * 60e3));
  await page.goto(srv.url);
  await ready(page);
  await page.click('#v-live [data-chip="mapv"][data-v="map"]');
  await page.waitForFunction(() => window.p1.map()?.nodes?.length > 0);
  // Tiempo de dibujo por cuadro (medido dentro de la página: el reloj de pruebas fija Date, no performance)
  const frames = await page.evaluate(
    () =>
      new Promise((res) => {
        const ts = [];
        const step = (t) => {
          ts.push(t);
          if (ts.length < 90) requestAnimationFrame(step);
          else res(ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b));
        };
        requestAnimationFrame(step);
      })
  );
  const median = frames[Math.floor(frames.length / 2)];
  console.log(`mapa: mediana entre cuadros ${median.toFixed(1)} ms, p90 ${frames[Math.floor(frames.length * 0.9)].toFixed(1)} ms`);
  assert.ok(median <= 17.5, `mediana ${median} ms (≈ 60 fps)`);
  // Nodos: tamaño según impacto
  const nodes = await page.evaluate(() => window.p1.map().nodes.map((n) => ({ id: n.id, level: n.level, r: n.r, x: n.dx ?? n.x, y: n.dy ?? n.y })));
  const r = Object.fromEntries(nodes.map((n) => [n.level, n.r]));
  assert.ok(r.high > (r.medium ?? 0) && (r.medium ?? r.high) > (r.low ?? 0), JSON.stringify(r));
  // Tocar el nodo de una historia alta abre esa historia
  const target = nodes.find((n) => n.level === 'high');
  const box = await page.$eval('[data-map] canvas', (c) => c.getBoundingClientRect().toJSON());
  await page.mouse.click(box.x + target.x, box.y + target.y);
  await page.waitForSelector('#sheet-detail:not([hidden])');
  assert.ok(await page.$(`#detail-body .it[data-id="${target.id}"]`), 'la historia tocada');
  // Fuera de la pestaña, en pausa (no gasta batería)
  await page.click('#sheet-detail [data-close]');
  await page.click('.tabs [data-tab="markets"]');
  const ticks = await page.evaluate(async () => {
    const m = window.p1.map();
    const before = m.nodes[0].dx;
    await new Promise((r) => setTimeout(r, 300));
    return before === m.nodes[0].dx;
  });
  assert.ok(ticks, 'quieto fuera de la pestaña');
  await context.close();
});

test('p2 mapa en vivo: con «reducir movimiento» se dibuja quieto; en equipos flojos vuelve la lista', async () => {
  const { context, page } = await newPage(browser, srv.url, { lang: 'en', storage: { 'p1.prefs': JSON.stringify({ map: true }) } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(srv.url);
  await ready(page);
  await page.waitForFunction(() => !!window.p1.map());
  const still = await page.evaluate(async () => {
    const m = window.p1.map();
    const a = m.nodes.map((n) => n.dx).join();
    await new Promise((r) => setTimeout(r, 400));
    return { reduced: m.reduced, same: a === m.nodes.map((n) => n.dx).join() };
  });
  assert.deepEqual(still, { reduced: true, same: true });
  await context.close();

  const low = await newPage(browser, srv.url, { lang: 'en', storage: { 'p1.prefs': JSON.stringify({ map: true }) } });
  await low.context.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }));
  await low.page.goto(srv.url);
  await ready(low.page);
  await low.page.waitForSelector('#v-live .infoline');
  assert.match(await low.page.textContent('#v-live [data-slot="live"]'), /list/i);
  assert.ok((await low.page.$$('#v-live [data-slot="live"] .it')).length > 0, 'la lista de siempre');
  assert.equal(await low.page.evaluate(() => window.p1.map()), null);
  await low.context.close();
});
