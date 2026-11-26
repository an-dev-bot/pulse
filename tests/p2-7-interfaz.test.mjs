// P2 prueba 7: interfaz. EN/ES completos; 320/390/768/1440 px sin nada fuera; toques ≥ 44 px; barra de pestañas opaca;
// sin emoji; ≥ 7 tarjetas a 390 px; a 1440 px se ven el carril izquierdo, el feed y el panel derecho sin huecos grandes.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { STRINGS } from '../app/js/i18n.js';
import { launch, startServer, newPage, ready, prepareData, goTo, P2_TABS, FIXTURE_NOW } from './helpers.mjs';

const EMOJI = /[\p{Emoji_Presentation}\u{FE0F}]/u;
const LISTS = JSON.stringify([{ name: 'Traders FX', url: 'https://x.com/i/lists/1234567890' }]);

test('p2 idiomas: EN y ES tienen las mismas claves y cada t(…) del código existe', () => {
  const en = Object.keys(STRINGS.en).sort();
  const es = Object.keys(STRINGS.es).sort();
  assert.deepEqual(en, es);
  for (const k of en) {
    assert.ok(STRINGS.en[k].trim() && STRINGS.es[k].trim(), `${k} vacío`);
    const vars = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
    assert.equal(vars(STRINGS.en[k]), vars(STRINGS.es[k]), `${k}: mismas variables`);
  }
  for (const f of readdirSync('app/js').filter((f) => f.endsWith('.js'))) {
    const src = readFileSync(`app/js/${f}`, 'utf8');
    for (const m of src.matchAll(/\b(?:t|sh)\('([a-zA-Z0-9_.]+)'/g)) {
      if (m[1].endsWith('.')) continue; // clave armada con una variable (p. ej. 'why.' + regla): se revisa abajo
      assert.ok(m[1] in STRINGS.en, `${f}: falta «${m[1]}»`);
    }
  }
  // Claves armadas: cada regla de impacto, nivel, sector, pestaña y subpágina tiene su texto.
  const rules = [...readFileSync('scripts/impact-rules.mjs', 'utf8').matchAll(/id: '(\w+)'/g)].map((m) => m[1]);
  const sectors = [...readFileSync('app/js/config.js', 'utf8').matchAll(/sector: '(\w+)'/g)].map((m) => m[1]);
  const need = [...rules.map((r) => 'why.' + r), ...['high', 'medium', 'low'].map((l) => 'imp.' + l), ...sectors.map((s) => 'sector.' + s), ...P2_TABS.flatMap((v) => ['tab.' + v, 'title.' + v]), ...['saved', 'posts', 'settings', 'sources'].flatMap((k) => ['more.' + k, `more.${k}.d`])];
  for (const k of need) assert.ok(k in STRINGS.en, `falta «${k}»`);
});

test('p2 sin emoji: ni en los textos ni en el código de la interfaz (los íconos son SVG propios)', () => {
  for (const lang of ['en', 'es']) for (const [k, v] of Object.entries(STRINGS[lang])) assert.ok(!EMOJI.test(v), `${lang} ${k}: ${v}`);
  for (const f of ['app/index.html', 'app/styles.css', ...readdirSync('app/js').map((f) => `app/js/${f}`)]) {
    const src = readFileSync(f, 'utf8');
    const m = src.match(EMOJI);
    assert.ok(!m, `${f}: ${m?.[0]}`);
  }
  const icons = readFileSync('app/js/icons.js', 'utf8');
  assert.ok(!/https?:\/\//.test(icons.replace('http://www.w3.org/2000/svg', '')), 'íconos sin CDN');
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

// Nada se sale de la pantalla y todo lo que se toca mide ≥ 44 px (el mismo criterio que en P1).
const check = (page) =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bad = [];
    if (document.documentElement.scrollWidth > vw) bad.push(`documento ${document.documentElement.scrollWidth}px`);
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('[hidden]') || el.parentElement?.closest('.ticker, .chips, .movers')) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.right <= vw + 1 && r.left >= -1) continue;
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
    for (const el of document.querySelectorAll('button, .btn, a.it-main, a.t3, input:not([type=file]), [role=tab], .chip')) {
      if (el.closest('[hidden]')) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.width < 43.5 || r.height < 43.5) bad.push(`pequeño: ${el.tagName}.${el.className} «${el.textContent.trim().slice(0, 20)}» ${r.width.toFixed(0)}×${r.height.toFixed(0)}`);
    }
    return bad.slice(0, 8);
  });

for (const [width, height] of [[320, 640], [390, 844], [768, 1024], [1440, 900]]) {
  test(`p2 ${width}px: nada fuera de la pantalla y toques ≥ 44 px en todas las pantallas`, async () => {
    const { context, page } = await newPage(browser, srv.url, { width, height, lang: 'en', isMobile: width < 1024, storage: { 'p1.lists': LISTS } });
    await page.clock.setFixedTime(new Date(FIXTURE_NOW.getTime() + 10 * 60e3));
    await page.goto(srv.url);
    await ready(page);
    for (const where of ['live', 'stocks', 'crypto', 'forex', 'memes', 'calendar', 'more', 'saved', 'tweets', 'settings', 'sources']) {
      await goTo(page, where);
      if (where === 'memes') await page.waitForSelector('#v-memes .coin', { timeout: 10000 });
      assert.deepEqual(await check(page), [], where);
    }
    await page.evaluate(() => window.p1.openDetail('NVDA'));
    assert.deepEqual(await check(page), [], 'detalle');
    await context.close();
  });
}

test('p2 390px: barra de pestañas opaca, ≥ 7 tarjetas en pantalla y la barra de precios abre lo que se toca', async () => {
  const { context, page } = await newPage(browser, srv.url, { width: 390, height: 844, lang: 'en' });
  await page.clock.setFixedTime(new Date(FIXTURE_NOW.getTime() + 10 * 60e3));
  await page.goto(srv.url);
  await ready(page);
  const nav = await page.$eval('.nav', (e) => {
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return { bg: cs.backgroundColor, bottom: Math.round(r.bottom), opacity: cs.opacity, tabs: e.querySelectorAll('[role=tab]').length };
  });
  assert.match(nav.bg, /^rgb\(/, `fondo opaco: ${nav.bg}`);
  assert.equal(nav.opacity, '1');
  assert.equal(nav.bottom, 844, 'abajo de la pantalla');
  assert.equal(nav.tabs, 5);
  assert.deepEqual(await page.$$eval('.tabs [role=tab] span', (s) => s.map((x) => x.textContent)), ['Now', 'Markets', 'Memes', 'Calendar', 'More']);
  // Llevar el feed arriba y contar tarjetas completas entre la barra de arriba y la de abajo
  await page.$eval('#v-live [data-slot="live"]', (e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - document.querySelector('.top').offsetHeight));
  const visible = await page.evaluate(() => {
    const top = document.querySelector('.top').getBoundingClientRect().bottom;
    const bottom = document.querySelector('.nav').getBoundingClientRect().top;
    return [...document.querySelectorAll('#v-live [data-slot="live"] .it')].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.top >= top - 1 && r.bottom <= bottom + 1;
    }).length;
  });
  assert.ok(visible >= 7, `${visible} tarjetas en pantalla`);
  // La barra de precios: un toque abre el detalle
  await page.click('#ticker .tk[data-open=".SPX"]:not([aria-hidden])', { force: true });
  await page.waitForSelector('#sheet-detail:not([hidden])');
  assert.match(await page.textContent('#detail-title'), /S&P 500/);
  await context.close();
});

test('p2 1440px: carril izquierdo, feed y panel derecho visibles, sin huecos grandes a los lados', async () => {
  const { context, page } = await newPage(browser, srv.url, { width: 1440, height: 900, lang: 'en', isMobile: false });
  await page.goto(srv.url);
  await ready(page);
  await page.waitForSelector('#side .qr');
  const box = await page.evaluate(() => Object.fromEntries(['.nav', 'main', '#side'].map((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return [s, { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) }];
  })));
  const vw = 1440;
  for (const [s, r] of Object.entries(box)) assert.ok(r.width > 150 && r.height > 300 && r.left >= 0 && r.right <= vw, `${s} visible: ${JSON.stringify(r)}`);
  assert.ok(box['.nav'].right <= box.main.left + 1 && box.main.right <= box['#side'].left + 1, 'en ese orden');
  const used = box['#side'].right - box['.nav'].left;
  assert.ok(used >= 0.9 * vw, `las tres columnas ocupan ${used}px de ${vw}`);
  assert.ok(box.main.width >= 700, `feed de ${box.main.width}px`);
  // El panel derecho trae mi lista, el próximo evento alto y el resumen de mercado
  const side = await page.textContent('#side');
  for (const s of ['Watchlist', 'Next high-impact event', 'Market snapshot', 'NVDA', 'S&P 500']) assert.ok(side.includes(s), s);
  await context.close();
});

test('p2 768px: feed + panel derecho que se puede plegar (y se recuerda)', async () => {
  const { context, page } = await newPage(browser, srv.url, { width: 768, height: 1024, lang: 'en' });
  await page.goto(srv.url);
  await ready(page);
  await page.waitForSelector('#side .qr');
  assert.ok(await page.isVisible('#side'));
  await page.click('#btn-rail');
  assert.ok(!(await page.isVisible('#side')));
  assert.ok((await page.$eval('main', (e) => e.getBoundingClientRect().width)) > 700);
  await page.reload();
  await ready(page);
  assert.ok(!(await page.isVisible('#side')), 'sigue plegado');
  await page.click('#btn-rail');
  assert.ok(await page.isVisible('#side'));
  await context.close();
});

test('p2 idioma: abre en inglés la primera vez; el cambio es al instante y se recuerda', async () => {
  const { context, page } = await newPage(browser, srv.url, { lang: null });
  await page.goto(srv.url);
  await ready(page);
  assert.equal(await page.getAttribute('html', 'lang'), 'en');
  assert.equal(await page.textContent('.tabs [data-tab="live"] span'), 'Now');
  await page.evaluate(() => (window.__same = true));
  await goTo(page, 'settings');
  await page.click('[data-chip="lang"][data-v="es"]');
  assert.equal(await page.textContent('.tabs [data-tab="live"] span'), 'Ahora');
  assert.equal(await page.evaluate(() => window.__same), true, 'sin recargar');
  await page.reload();
  await ready(page);
  assert.equal(await page.getAttribute('html', 'lang'), 'es');
  // sin emoji en lo que se ve (fuera de titulares y nombres de monedas, que no son de la app)
  for (const where of ['live', 'stocks', 'memes', 'calendar', 'settings']) {
    await goTo(page, where);
    const own = await page.evaluate(() => {
      const c = document.body.cloneNode(true);
      c.querySelectorAll('.news, .it, .t3 h4, .sym, .cname, .coin, script, .ev-t, .next-r b, #results').forEach((e) => e.remove());
      return c.textContent;
    });
    assert.ok(!EMOJI.test(own), `${where}: ${own.match(EMOJI)?.[0]}`);
  }
  await context.close();
});

// P2.1: un solo título por pestaña (el de la cabecera), en teléfono y escritorio, en los dos idiomas.
for (const [width, height] of [[390, 844], [1440, 900]]) {
  test(`p2 ${width}px: cada pestaña muestra su título una sola vez`, async () => {
    const { context, page } = await newPage(browser, srv.url, { width, height, lang: 'en', isMobile: width < 1024 });
    await page.clock.setFixedTime(new Date(FIXTURE_NOW.getTime() + 10 * 60e3));
    await page.goto(srv.url);
    await ready(page);
    for (const lang of ['en', 'es']) {
      if (lang === 'es') {
        await goTo(page, 'settings');
        await page.click('[data-chip="lang"][data-v="es"]');
      }
      for (const tab of P2_TABS) {
        await goTo(page, tab);
        const title = STRINGS[lang]['title.' + tab];
        const found = await page.evaluate((title) => [...document.querySelectorAll('h1, h2, h3, [role=heading]')]
          .filter((h) => h.getClientRects().length && getComputedStyle(h).visibility !== 'hidden' && !h.closest('[hidden]') && h.textContent.trim() === title)
          .map((h) => h.id || h.tagName), title);
        assert.deepEqual(found, ['view-title'], `${lang} ${tab}: «${title}» aparece ${found.length} veces`);
      }
    }
    await context.close();
  });
}
