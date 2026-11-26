// Prueba 6: el scroll no salta al llegar noticias; 375 y 320 px sin nada fuera; botones de 44 px; los dos idiomas.
// Más: promocionados marcados, ningún texto de la app recomienda, calendario, palabras clave, leídos y X.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, startServer, newPage, ready, prepareData, TABS } from './helpers.mjs';
import { ADVICE, TREND } from './p1-4-neutral.test.mjs';

const LISTS = JSON.stringify([{ name: 'Traders FX', url: 'https://x.com/i/lists/1234567890' }]);
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

test('p1 el scroll no salta al llegar noticias nuevas: aparece «N nuevas ↑»', async () => {
  const { context, page } = await newPage(browser, srv.url);
  let extra = [];
  await page.route('**/data/news.json*', (route) => {
    const body = { ...data.news, generatedAt: new Date().toISOString(), items: [...extra, ...data.news.items] };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(srv.url);
  await ready(page);
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(100);
  const ref = await page.evaluate(() => {
    const el = [...document.querySelectorAll('#v-live .it')].find((e) => e.getBoundingClientRect().top > 250);
    return { id: el.dataset.id, top: el.getBoundingClientRect().top, y: window.scrollY, n: document.querySelectorAll('#v-live .it').length };
  });
  const now = new Date().toISOString();
  extra = [1, 2, 3].map((i) => ({ id: `nueva${i}`, title: `Noticia nueva ${i}`, summary: '', url: `https://ejemplo.com/n${i}`, source: 'Prueba', sourceId: 'coindesk', market: 'crypto', tags: ['crypto'], lang: 'es', time: now }));
  await page.evaluate(() => window.p1.refresh());
  await page.waitForSelector('#pill:not([hidden])');
  const after = await page.evaluate((id) => {
    const el = document.querySelector(`#v-live .it[data-id="${id}"]`);
    return { top: el.getBoundingClientRect().top, y: window.scrollY, n: document.querySelectorAll('#v-live .it').length, pill: document.getElementById('pill').textContent };
  }, ref.id);
  assert.equal(after.y, ref.y, 'scrollY se movió');
  assert.ok(Math.abs(after.top - ref.top) < 1, `la noticia de referencia se movió ${after.top - ref.top}px`);
  assert.equal(after.n, ref.n, 'la lista cambió sin pedirlo');
  assert.equal(after.pill, '3 nuevas ↑');
  await page.click('#pill');
  await page.waitForFunction(() => window.scrollY === 0);
  assert.equal(await page.getAttribute('#v-live .it:first-child', 'data-id'), 'nueva1');
  await context.close();
});

for (const width of [375, 320]) {
  for (const lang of ['es', 'en']) {
    test(`p1 ${width}px (${lang}): nada se sale de la pantalla y todos los botones miden 44 px o más`, async () => {
      const { context, page } = await newPage(browser, srv.url, { width, height: 740, storage: { 'p1.lang': JSON.stringify(lang), 'p1.lists': LISTS, 'p1.keywords': JSON.stringify(['Bitcoin']) } });
      await page.goto(srv.url);
      await ready(page);
      await page.click('#v-live .it:nth-child(1) .act-save');
      const check = () =>
        page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const bad = [];
          if (document.documentElement.scrollWidth > vw) bad.push(`documento ${document.documentElement.scrollWidth}px`);
          for (const el of document.querySelectorAll('body *')) {
            if (el.parentElement?.closest('.ticker, .chips')) continue; // carriles deslizables a propósito
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            if (r.right <= vw + 1 && r.left >= -1) continue;
            // Si un contenedor que sí cabe recorta su contenido (texto con «…»), no se ve fuera.
            let clipped = false;
            for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
              const cs = getComputedStyle(p);
              if (cs.overflowX !== 'visible') {
                const pr = p.getBoundingClientRect();
                clipped = pr.right <= vw + 1 && pr.left >= -1;
                break;
              }
            }
            if (!clipped) bad.push(`fuera: ${el.tagName}.${el.className} ${Math.round(r.left)}–${Math.round(r.right)}`);
          }
          for (const el of document.querySelectorAll('button, .btn, a.it-main, input:not([type=file]), [role=tab], .chip')) {
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            if (r.width < 43.5 || r.height < 43.5) bad.push(`pequeño: ${el.tagName}.${el.className} «${el.textContent.trim().slice(0, 20)}» ${r.width.toFixed(0)}×${r.height.toFixed(0)}`);
          }
          return bad.slice(0, 8);
        });
      for (const tab of TABS) {
        await page.click(`.tabs [data-tab="${tab}"]`);
        if (tab === 'memes') await page.waitForSelector('#v-memes .coin', { timeout: 10000 });
        if (tab === 'forex') {
          await page.click('[data-chip="fx"][data-v="news"]');
          assert.deepEqual(await check(), [], `${tab}/noticias`);
          await page.click('[data-chip="fx"][data-v="cal"]');
        }
        assert.deepEqual(await check(), [], tab);
      }
      await page.click('[data-chip="mview"][data-v="promoted"]').catch(() => {});
      await page.click('.tabs [data-tab="memes"]');
      await page.click('[data-chip="mview"][data-v="promoted"]');
      await page.waitForSelector('#v-memes .coin.promo', { timeout: 10000 });
      assert.deepEqual(await check(), [], 'promocionados');
      await page.click('#btn-settings');
      assert.deepEqual(await check(), [], 'ajustes');
      await page.click('#sheet-settings [data-close]');
      await page.click('#btn-search');
      await page.fill('#q', 'bitcoin');
      await page.waitForTimeout(250);
      assert.deepEqual(await check(), [], 'búsqueda');
      await context.close();
    });
  }
}

test('p1 cambiar de idioma en Ajustes no recarga la página', async () => {
  const { context, page } = await newPage(browser, srv.url);
  await page.goto(srv.url);
  await ready(page);
  await page.evaluate(() => (window.__sinRecargar = true));
  assert.equal(await page.textContent('.tabs [data-tab="stocks"] span'), 'Acciones');
  await page.click('#btn-settings');
  await page.click('[data-chip="lang"][data-v="en"]');
  assert.equal(await page.textContent('.tabs [data-tab="stocks"] span'), 'Stocks');
  assert.equal(await page.textContent('#sheet-settings h2'), 'Settings');
  assert.equal(await page.getAttribute('html', 'lang'), 'en');
  await page.click('[data-chip="lang"][data-v="es"]');
  assert.equal(await page.textContent('.tabs [data-tab="stocks"] span'), 'Acciones');
  assert.equal(await page.evaluate(() => window.__sinRecargar), true);
  await context.close();
});

test('p1 promocionados marcados como «Promocionado» y ningún texto de la app recomienda ni dice «tendencia»', async () => {
  for (const lang of ['es', 'en']) {
    const { context, page } = await newPage(browser, srv.url, { storage: { 'p1.lang': JSON.stringify(lang), 'p1.lists': LISTS } });
    await page.goto(srv.url);
    await ready(page);
    await page.click('.tabs [data-tab="memes"]');
    await page.click('[data-chip="mview"][data-v="promoted"]');
    await page.waitForSelector('#v-memes .coin.promo', { timeout: 10000 });
    const cards = await page.$$eval('#v-memes .coin', (cs) => cs.map((c) => c.querySelector('.badge-promo')?.textContent || ''));
    assert.ok(cards.length > 0);
    assert.ok(cards.every((t) => t === (lang === 'es' ? 'Promocionado' : 'Promoted')), 'todas marcadas');
    for (const v of ['new', 'gainers', 'volume']) {
      await page.click(`[data-chip="mview"][data-v="${v}"]`);
      await page.waitForSelector('#v-memes .coin', { timeout: 10000 });
      assert.equal(await page.$$eval('#v-memes .coin .badge-promo', (b) => b.length), 0, `${v} no lleva marca de pago`);
    }
    for (const tab of TABS) await page.click(`.tabs [data-tab="${tab}"]`);
    await page.click('#btn-settings');
    // Texto propio de la app (sin titulares de medios ni nombres de monedas, que no son de la app)
    const own = await page.evaluate(() => {
      const c = document.body.cloneNode(true);
      c.querySelectorAll('.news, .it, .sym, .cname, script, .ev-t, .next-r b').forEach((e) => e.remove());
      return c.textContent.replace(/\s+/g, ' ');
    });
    assert.ok(!ADVICE.test(own), `texto que recomienda: ${own.match(ADVICE)?.[0]}`);
    assert.ok(!TREND.test(own), `texto «tendencia»: ${own.match(TREND)?.[0]}`);
    await context.close();
  }
});

test('p1 calendario: alto impacto en rojo, cuenta regresiva y hora de Ciudad de México', async () => {
  const { context, page } = await newPage(browser, srv.url);
  await page.clock.install({ time: new Date('2026-11-25T12:00:00Z') });
  await page.goto(srv.url);
  await ready(page);
  await page.click('.tabs [data-tab="forex"]');
  const cd = await page.textContent('#v-forex .next .cd');
  assert.equal(cd, 'en 1 h 30 min'); // Core PCE a las 13:30 UTC
  const row = page.locator('#v-forex .ev.high', { hasText: 'Core PCE Price Index m/m' });
  assert.equal(await row.locator('.tm').textContent(), '07:30'); // 13:30 UTC = 07:30 en CDMX
  assert.equal(await row.locator('.imp').evaluate((e) => getComputedStyle(e).backgroundColor), 'rgb(255, 59, 92)');
  await context.close();
});

test('p1 palabras clave resaltan y avisan; leídas se apagan y se recuerdan; búsqueda', async () => {
  const { context, page } = await newPage(browser, srv.url);
  await page.goto(srv.url);
  await ready(page);
  await page.evaluate(() => localStorage.setItem('p1.keywords', JSON.stringify(['Bitcoin'])));
  await page.reload();
  await ready(page);
  await page.waitForSelector('#toast:not([hidden])');
  assert.match(await page.textContent('#toast'), /Bitcoin|palabras clave/);
  assert.ok((await page.$$('#v-live mark')).length > 0, 'hay resaltados');
  assert.ok((await page.$$('#v-live .it.kw')).length > 0);
  const id = await page.getAttribute('#v-live .it:nth-child(3)', 'data-id');
  await page.click('#v-live .it:nth-child(3) .act-read');
  assert.ok(await page.$eval(`#v-live .it[data-id="${id}"]`, (e) => e.classList.contains('read') && getComputedStyle(e.querySelector('.it-main')).opacity < 0.6));
  await page.reload();
  await ready(page);
  assert.ok(await page.$eval(`#v-live .it[data-id="${id}"]`, (e) => e.classList.contains('read')), 'leída tras recargar');
  await page.click('#btn-search');
  await page.fill('#q', 'bitcoin');
  await page.waitForTimeout(250);
  assert.ok((await page.$$('#results .it')).length > 0, 'la búsqueda encuentra noticias');
  await context.close();
});

test('p1 Tuits: botón por lista; si X no deja incrustar, mensaje tranquilo sin errores', async () => {
  const { context, page } = await newPage(browser, srv.url, { storage: { 'p1.lists': LISTS } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(srv.url);
  await ready(page);
  await page.click('.tabs [data-tab="tweets"]');
  const a = page.locator('.xl a.btn');
  assert.equal(await a.getAttribute('href'), 'https://x.com/i/lists/1234567890');
  assert.equal(await a.getAttribute('target'), '_blank');
  await page.click('[data-embed="0"]');
  await page.waitForFunction(() => /X/.test(document.querySelector('[data-embed-slot="0"]').textContent) && !/…/.test(document.querySelector('[data-embed-slot="0"]').textContent), null, { timeout: 12000 });
  assert.deepEqual(errors, []);
  await context.close();
});
