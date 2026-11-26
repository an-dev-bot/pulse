// Prueba 4: lo promocionado nunca sale como tendencia; ningún texto de la app recomienda comprar o vender.
// (Además: el nombre de la app vive en un solo lugar.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { STRINGS } from '../app/js/i18n.js';
import { dsPairsToCoins, gtPoolsToCoins } from '../app/js/api.js';
import { APP } from '../app/js/config.js';

export const ADVICE = /\b(compr[aeáéo]\w*|vend[aeéo]\w*|vent[ao]s?|buy\w*|sell\w*|go long|go short|to the moon|te recomendamos|recomendamos|we recommend|invest now|invierte ya|señal(es)?|signals?|no te lo pierdas|don.?t miss|100x|guaranteed|garantizad\w*)\b/i;
export const TREND = /\b(tendencias?|trending|trends?)\b/i;

test('p1 ningún texto de la interfaz (es/en) recomienda comprar o vender', () => {
  for (const [lang, dict] of Object.entries(STRINGS)) {
    for (const [k, v] of Object.entries(dict)) assert.ok(!ADVICE.test(v), `${lang}.${k}: «${v}»`);
  }
  const html = readFileSync('app/index.html', 'utf8').replace(/<[^>]+>/g, ' ');
  assert.ok(!ADVICE.test(html), 'index.html');
});

test('p1 ningún texto usa «tendencia/trending»; lo pagado se llama «Promocionado»', () => {
  for (const dict of Object.values(STRINGS)) for (const v of Object.values(dict)) assert.ok(!TREND.test(v), v);
  assert.equal(STRINGS.es['meme.promo'], 'Promocionado');
  assert.equal(STRINGS.en['meme.promo'], 'Promoted');
});

test('p1 los boosts de DEX Screener siempre quedan marcados como promocionados', () => {
  const boosts = JSON.parse(readFileSync('tests/fixtures/direct/ds-boosts.json', 'utf8')).filter((b) => b.chainId === 'solana');
  const coins = dsPairsToCoins(JSON.parse(readFileSync('tests/fixtures/direct/ds-tokens.json', 'utf8')), boosts);
  assert.ok(coins.length > 0);
  assert.ok(coins.every((c) => c.promoted === true));
  const organic = gtPoolsToCoins(JSON.parse(readFileSync('tests/fixtures/direct/gt-volume.json', 'utf8')));
  assert.ok(organic.every((c) => c.promoted === false));
});

test('p1 los dos idiomas tienen los mismos textos', () => {
  assert.deepEqual(Object.keys(STRINGS.en).sort(), Object.keys(STRINGS.es).sort());
});

test('p1 el nombre de la app vive en un solo lugar del código', () => {
  const hits = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(m?js|html|css|json|ya?ml|webmanifest)$/.test(f) && readFileSync(p, 'utf8').includes(APP.name)) hits.push(p.replace(/\\/g, '/'));
    }
  };
  for (const d of ['app', 'scripts', '.github']) walk(d);
  assert.deepEqual(hits, ['app/js/config.js']);
});
