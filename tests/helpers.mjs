// Ayudas para las pruebas de interfaz: servidor local, navegador y APIs externas simuladas con copias guardadas.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { serve } from '../scripts/serve.mjs';

const FX = 'tests/fixtures/direct';
const fx = (n) => readFileSync(join(FX, n), 'utf8');

export async function launch() {
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch (e) {
      if (!channel) throw e;
    }
  }
}

export async function startServer(root = 'dist') {
  return serve(root, 0);
}

// Simula las APIs públicas con copias guardadas y bloquea todo lo demás que sea externo.
export async function mockExternal(context, { log } = {}) {
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const u = route.request().url();
    log?.push(u);
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body });
    if (u.startsWith('https://api.coingecko.com/')) return json(fx('coingecko.json'));
    if (u.includes('api.geckoterminal.com') && u.includes('new_pools')) return json(fx('gt-new.json'));
    if (u.includes('api.geckoterminal.com') && u.includes('trending_pools')) return json(fx('gt-trending.json'));
    if (u.includes('api.geckoterminal.com') && u.includes('/pools?sort=')) return json(fx('gt-volume.json'));
    if (u.includes('api.dexscreener.com/token-boosts/')) return json(fx('ds-boosts.json'));
    if (u.includes('api.dexscreener.com/tokens/v1/')) return json(fx('ds-tokens.json'));
    return route.abort('blockedbyclient');
  });
}

// Registra TODAS las peticiones (URL, cabeceras y cuerpo) para comprobar que no salen datos personales.
export function recordRequests(context) {
  const reqs = [];
  context.on('request', (r) => reqs.push({ url: r.url(), headers: JSON.stringify(r.headers()), body: r.postData() || '' }));
  return reqs;
}

export async function newPage(browser, base, { width = 375, height = 812, log, storage, lang = 'es', isMobile = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile, hasTouch: isMobile, serviceWorkers: 'allow', locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  await mockExternal(context, { log });
  if (storage) await context.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
  // P2: la app abre en inglés la primera vez. Las pruebas de P1 se escribieron en español: si nadie eligió idioma, se pone «es».
  if (lang) await context.addInitScript((l) => { if (!localStorage.getItem('p1.lang')) localStorage.setItem('p1.lang', JSON.stringify(l)); }, lang);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  return { context, page };
}

export async function ready(page) {
  await page.waitForFunction(() => window.p1?.ready === true, null, { timeout: 15000 });
}

// Datos de prueba: se juntan de las copias guardadas, sin internet.
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { collect, fixtureFetcher, writeOutput } from '../scripts/collect.mjs';
export const FIXTURE_NOW = new Date('2026-11-26T08:00:00Z');
export async function prepareData() {
  if (!existsSync('dist/index.html')) execFileSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
  const data = await collect({ fetchText: fixtureFetcher('tests/fixtures'), now: FIXTURE_NOW });
  await writeOutput('dist/data', data);
  return data;
}

// Pestañas de P1 → dónde viven en P2 (5 pestañas: Now · Markets · Memes · Calendar · More).
export const TABS = ['live', 'memes', 'crypto', 'forex', 'stocks', 'tweets', 'saved'];
export const P2_TABS = ['live', 'markets', 'memes', 'calendar', 'more'];
const ROUTE = { live: ['live'], memes: ['memes'], calendar: ['calendar'], crypto: ['markets', 'mseg', 'crypto'], forex: ['markets', 'mseg', 'forex'], stocks: ['markets', 'mseg', 'stocks'], tweets: ['more', 'more', 'posts'], saved: ['more', 'more', 'saved'], settings: ['more', 'more', 'settings'], sources: ['more', 'more', 'sources'], markets: ['markets'], more: ['more'] };
export async function goTo(page, name) {
  const [tab, group, v] = ROUTE[name];
  await page.click(`.tabs [data-tab="${tab}"]`);
  // «More» recuerda la última subpágina: se vuelve al menú antes de elegir otra.
  if (tab === 'more' && (await page.$('#v-more [data-back]'))) await page.click('#v-more [data-back]');
  if (group) await page.click(`#v-${tab} [data-chip="${group}"][data-v="${v}"]`);
}
export const openSettings = (page) => goTo(page, 'settings');
