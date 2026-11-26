// Capturas a 390 px (teléfono) y 1440 px (escritorio) en capturas/. Usa las copias guardadas (sin internet)
// (los datos se juntan con la hora actual, así que se ven como un día normal).
import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { launch, startServer, newPage, ready, goTo } from '../tests/helpers.mjs';

execFileSync(process.execPath, ['scripts/collect.mjs', '--out', 'dist/data', '--fixtures', 'tests/fixtures'], { stdio: 'inherit' });
await mkdir('capturas', { recursive: true });
const { server, url } = await startServer('dist');
const browser = await launch();
const storage = {
  'p1.keywords': JSON.stringify(['Fed', 'Solana']),
  'p1.lists': JSON.stringify([{ name: 'Traders FX', url: 'https://x.com/i/lists/1234567890' }, { name: 'Memes SOL', url: 'https://x.com/i/lists/9876543210' }]),
};
const clean = (page) => page.evaluate(() => (document.getElementById('toast').hidden = true));

for (const [w, h, tag] of [[390, 844, '390'], [1440, 900, '1440']]) {
  const { context, page } = await newPage(browser, url, { storage, width: w, height: h, lang: 'en', isMobile: w < 1024 });
  await page.goto(url);
  await ready(page);
  await page.waitForTimeout(500);
  const shots = [['live', '01-now'], ['stocks', '02-stocks'], ['crypto', '03-crypto'], ['forex', '04-forex'], ['memes', '05-memes'], ['calendar', '06-calendar'], ['more', '07-more'], ['tweets', '08-posts'], ['sources', '09-sources']];
  for (const [where, name] of shots) {
    await goTo(page, where);
    if (where === 'memes') await page.waitForSelector('#v-memes .coin', { timeout: 10000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    await clean(page);
    await page.screenshot({ path: `capturas/${tag}-${name}.png` });
  }
  // Una historia abierta (por qué importa, reacción si la hay, otras fuentes) y el detalle de una acción
  await goTo(page, 'live');
  await page.click('#v-live [data-slot="live"] .it:nth-child(1) .act-open');
  await page.$eval('#v-live [data-slot="live"]', (e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 120));
  await page.waitForTimeout(200);
  await clean(page);
  await page.screenshot({ path: `capturas/${tag}-10-story-open.png` });
  await page.evaluate(() => window.p1.openDetail('NVDA'));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `capturas/${tag}-11-detail-nvda.png` });
  await page.click('#sheet-detail [data-close]');
  // Mapa en vivo
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('#v-live [data-chip="mapv"][data-v="map"]');
  await page.waitForTimeout(600);
  await page.$eval('[data-map], #v-live .infoline', (e) => e.scrollIntoView({ block: 'center' }));
  await clean(page);
  await page.screenshot({ path: `capturas/${tag}-12-live-map.png` });
  await page.click('#v-live [data-chip="mapv"][data-v="list"]');
  // Español
  await goTo(page, 'settings');
  await page.click('[data-chip="lang"][data-v="es"]');
  await goTo(page, 'live');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await clean(page);
  await page.screenshot({ path: `capturas/${tag}-13-ahora-es.png` });
  await context.close();
}
await browser.close();
server.close();
console.log('capturas listas en capturas/');
