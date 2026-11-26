// Prueba 5: listas de X, palabras clave, guardados y leídos se quedan en el teléfono (ninguna petición los manda),
// y exportar e importar deja todo igual.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { launch, startServer, newPage, ready, prepareData, recordRequests, TABS, goTo, openSettings } from './helpers.mjs';

const SECRETS = ['Zqxkeyword', 'ListaSecretaQ', '1112223334445556667', 'savedidzz9', 'Guardado secreto ZZ9', 'zz9-nota', 'readidqq7'];
const PERSONAL = {
  'p1.keywords': JSON.stringify(['Zqxkeyword', 'Bitcoin']),
  'p1.lists': JSON.stringify([{ name: 'ListaSecretaQ', url: 'https://x.com/i/lists/1112223334445556667' }]),
  'p1.saved': JSON.stringify([{ id: 'savedidzz9', title: 'Guardado secreto ZZ9', summary: '', url: 'https://ejemplo.com/zz9-nota', source: 'Prueba', market: 'crypto', tags: ['crypto'], lang: 'es', time: '2026-11-25T10:00:00.000Z', savedAt: '2026-11-25T11:00:00.000Z' }]),
  'p1.read': JSON.stringify(['readidqq7']),
};

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

test('p1 ninguna petición manda listas de X, palabras clave, guardados ni leídos', async () => {
  const { context, page } = await newPage(browser, srv.url, { storage: PERSONAL });
  const reqs = recordRequests(context);
  await page.goto(srv.url);
  await ready(page);
  for (const tab of TABS) {
    await goTo(page, tab); // P2: pestañas nuevas (ver helpers.goTo)
    await page.waitForTimeout(120);
  }
  await page.click('.tabs [data-tab="memes"]');
  for (const v of ['new', 'gainers', 'volume', 'promoted']) {
    await page.click(`[data-chip="mview"][data-v="${v}"]`);
    await page.waitForSelector('#v-memes .coin', { timeout: 10000 });
  }
  await page.click('[data-chip="chain"][data-v="all"]');
  await page.waitForSelector('#v-memes .coin', { timeout: 10000 });
  await page.click('#btn-search');
  await page.fill('#q', 'Zqxkeyword');
  await page.waitForTimeout(250);
  await page.click('#sheet-search [data-close]');
  await openSettings(page);
  await page.waitForTimeout(100);
  await page.evaluate(() => window.p1.refresh());
  await page.waitForTimeout(300);

  const net = reqs.filter((r) => /^https?:/.test(r.url));
  assert.ok(net.length > 5, 'hubo peticiones');
  for (const r of net) {
    const blob = `${r.url}\n${r.headers}\n${r.body}`;
    for (const s of SECRETS) assert.ok(!blob.includes(s), `«${s}» salió en ${r.url}`);
  }
  // Y solo a los destinos conocidos
  const hosts = new Set(net.map((r) => new URL(r.url).host));
  for (const h of hosts) assert.match(h, /^(127\.0\.0\.1:\d+|api\.coingecko\.com|api\.geckoterminal\.com|api\.dexscreener\.com)$/, h);
  await context.close();
});

test('p1 exportar e importar deja todo igual', async () => {
  const { context, page } = await newPage(browser, srv.url);
  await page.goto(srv.url);
  await ready(page);
  await page.evaluate((p) => {
    for (const [k, v] of Object.entries(p)) localStorage.setItem(k, v);
    localStorage.setItem('p1.lang', JSON.stringify('en'));
  }, PERSONAL);
  await page.reload();
  await ready(page);
  // Marcar una leída y guardar una real desde la interfaz
  await page.click('#v-live .it:nth-child(1) .act-save');
  await page.click('#v-live .it:nth-child(2) .act-open'); // P2: «leída» vive en la tarjeta abierta
  await page.click('#v-live .it:nth-child(2) .act-read');
  const snapshot = () => page.evaluate(() => Object.fromEntries(['lang', 'keywords', 'lists', 'saved', 'read', 'watchlist'].map((k) => [k, JSON.parse(localStorage.getItem('p1.' + k))])));
  const before = await snapshot();
  assert.equal(before.saved.length, 2);
  assert.equal(before.read.length, 2);

  await openSettings(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-export]')]);
  const file = await dl.path();
  const backup = JSON.parse(await readFile(file, 'utf8'));
  assert.deepEqual(backup.data, before);

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await ready(page);
  const empty = await snapshot();
  assert.deepEqual(empty.keywords, null);

  await openSettings(page);
  await page.setInputFiles('#import-file', file);
  await page.waitForFunction(() => !document.getElementById('toast').hidden);
  const afterImport = await snapshot();
  assert.deepEqual(afterImport, before);
  // La interfaz refleja lo importado sin recargar (idioma inglés, lista de X)
  assert.equal(await page.textContent('.tabs [data-tab="markets"] span'), 'Markets'); // P2: pestaña Markets
  await goTo(page, 'tweets');
  assert.equal(await page.textContent('.xl-h b'), 'ListaSecretaQ');
  // Un archivo que no es respaldo no rompe nada
  await openSettings(page);
  await page.setInputFiles('#import-file', { name: 'malo.json', mimeType: 'application/json', buffer: Buffer.from('{"hola":1}') });
  await page.waitForTimeout(200);
  assert.deepEqual(await snapshot(), before);
  await context.close();
});
