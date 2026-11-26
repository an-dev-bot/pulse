// Copia app/ a dist/, pone el nombre (de app/js/config.js), genera manifest, iconos y la lista del service worker.
import { cp, mkdir, readFile, readdir, rm, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { APP } from '../app/js/config.js';
import { makeIcons } from './icons.mjs';

const OUT = process.argv[2] || 'dist';
const keepData = await stat(join(OUT, 'data')).then(() => true).catch(() => false);
if (keepData) await cp(join(OUT, 'data'), '.data-keep', { recursive: true });
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp('app', OUT, { recursive: true });
if (keepData) {
  await cp('.data-keep', join(OUT, 'data'), { recursive: true });
  await rm('.data-keep', { recursive: true, force: true });
}
await makeIcons(join(OUT, 'icons'), APP.themeColor);

const manifest = {
  name: APP.name,
  short_name: APP.name,
  description: 'Trading news · memecoins · crypto · forex · stocks',
  lang: APP.defaultLang,
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'portrait',
  background_color: APP.themeColor,
  theme_color: APP.themeColor,
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
await writeFile(join(OUT, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));

let html = await readFile(join(OUT, 'index.html'), 'utf8');
html = html.replaceAll('__NAME__', APP.name).replaceAll('__THEME__', APP.themeColor);
await writeFile(join(OUT, 'index.html'), html);

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'data') out.push(...(await walk(p))); }
    else out.push(p);
  }
  return out;
}
const files = (await walk(OUT)).map((p) => relative(OUT, p).split(sep).join('/')).filter((p) => p !== 'sw.js').sort();
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(await readFile(join(OUT, f)));
const version = hash.digest('hex').slice(0, 10);
const shell = ['./', ...files.map((f) => './' + f)];
let sw = await readFile(join(OUT, 'sw.js'), 'utf8');
sw = sw.replace('__VERSION__', version).replace('__SHELL__', JSON.stringify(shell));
await writeFile(join(OUT, 'sw.js'), sw);
await writeFile(join(OUT, '.nojekyll'), '');
console.log(`build ${version}: ${files.length} archivos → ${OUT}`);
