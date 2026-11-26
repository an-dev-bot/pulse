// Capturas a 375 px de cada pestaña en capturas/. Usa las copias guardadas (sin internet).
import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { launch, startServer, newPage, ready } from '../tests/helpers.mjs';

execFileSync(process.execPath, ['scripts/collect.mjs', '--out', 'dist/data', '--fixtures', 'tests/fixtures'], { stdio: 'inherit' });
await mkdir('capturas', { recursive: true });
const { server, url } = await startServer('dist');
const browser = await launch();
const storage = {
  'p1.keywords': JSON.stringify(['Fed', 'Solana']),
  'p1.lists': JSON.stringify([{ name: 'Traders FX', url: 'https://x.com/i/lists/1234567890' }, { name: 'Memes SOL', url: 'https://x.com/i/lists/9876543210' }]),
};
const { page } = await newPage(browser, url, { storage, height: 812 });
await page.goto(url);
await ready(page);
await page.waitForTimeout(400);
const shots = [['live', '01-en-vivo'], ['memes', '02-memecoins'], ['crypto', '03-cripto'], ['forex', '04-forex'], ['stocks', '05-acciones'], ['tweets', '06-tuits'], ['saved', '07-guardados']];
// Guardar un par de noticias para que «Guardados» no salga vacío
await page.click('#v-live .it:nth-child(2) .act-save');
await page.click('#v-live .it:nth-child(4) .act-save');
await page.click('#v-live .it:nth-child(3) .act-read');
for (const [tab, name] of shots) {
  await page.click(`.tabs [data-tab="${tab}"]`);
  if (tab === 'memes') await page.waitForSelector('#v-memes .coin', { timeout: 10000 });
  await page.waitForTimeout(250);
  await page.evaluate(() => (document.getElementById('toast').hidden = true));
  await page.screenshot({ path: `capturas/${name}.png` });
}
await page.click('.tabs [data-tab="memes"]');
await page.click('[data-chip="mview"][data-v="promoted"]');
await page.waitForSelector('#v-memes .coin.promo', { timeout: 10000 });
await page.screenshot({ path: 'capturas/08-memecoins-promocionados.png' });
await page.click('#btn-settings');
await page.waitForTimeout(150);
await page.screenshot({ path: 'capturas/09-ajustes.png' });
await page.click('#sheet-settings [data-close]');
await page.click('#btn-search');
await page.fill('#q', 'bitcoin');
await page.waitForTimeout(300);
await page.screenshot({ path: 'capturas/10-buscar.png' });
await page.click('#sheet-search [data-close]');
await browser.close();
server.close();
console.log('capturas listas en capturas/');
