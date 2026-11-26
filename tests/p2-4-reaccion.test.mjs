// P2 prueba 4: la reacción («BTC +1.4% desde este titular») sale SOLO de las fotos de precios que guarda la Action.
// Sin fotos, sin cobertura a la hora del titular o sin un precio posterior → nada. Ningún texto predice dirección ni dice comprar/vender.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reactionFor, buildStories } from '../scripts/impact.mjs';
import { appendSnapshots, priceAt } from '../scripts/markets.mjs';
import { STRINGS } from '../app/js/i18n.js';
import { ADVICE } from './p1-4-neutral.test.mjs';

const m = (iso) => Math.round(Date.parse(iso) / 60000);
const NOW = new Date('2026-11-26T15:00:00Z');
// BTC: 100 000 a las 13:00 y 13:15; 101 400 a las 14:45 (cada punto = [minuto, precio, último minuto con ese precio])
const SNAP = {
  series: {
    BTC: [[m('2026-11-26T13:00:00Z'), 100000, m('2026-11-26T13:15:00Z')], [m('2026-11-26T13:30:00Z'), 100500], [m('2026-11-26T14:45:00Z'), 101400]],
    'EUR=': [[m('2026-11-26T09:00:00Z'), 1.05]],
  },
};

test('p2 reacción: se calcula entre la foto cubierta a la hora del titular y la última foto', () => {
  const r = reactionFor(['BTC'], '2026-11-26T13:10:00Z', SNAP, NOW);
  assert.equal(r.asset, 'BTC');
  assert.equal(r.pct, 1.4);
  assert.equal(r.from, '2026-11-26T13:10:00.000Z'); // precio vigente a las 13:10 (foto de 13:00–13:15)
  assert.equal(r.to, '2026-11-26T14:45:00.000Z');
});

test('p2 reacción: sin fotos, sin cobertura o sin precio posterior → nada (nunca se inventa)', () => {
  assert.equal(reactionFor(['BTC'], '2026-11-26T13:10:00Z', null, NOW), null, 'sin fotos');
  assert.equal(reactionFor(['BTC'], '2026-11-26T13:10:00Z', { series: {} }, NOW), null, 'serie vacía');
  assert.equal(reactionFor(['BTC'], '2026-11-26T11:00:00Z', SNAP, NOW), null, 'antes de la primera foto');
  assert.equal(reactionFor(['BTC'], '2026-11-26T14:50:00Z', SNAP, NOW), null, 'no hay foto posterior');
  assert.equal(reactionFor(['EUR'], '2026-11-26T09:05:00Z', SNAP, NOW), null, 'una sola foto: no hay cambio que medir');
  assert.equal(reactionFor(['BTC'], '2026-11-26T13:10:00Z', SNAP, new Date('2026-11-27T15:00:00Z')), null, 'la última foto es vieja');
  assert.equal(reactionFor(['DOGE'], '2026-11-26T13:10:00Z', SNAP, NOW), null, 'activo sin serie');
  // Un hueco en las fotos no se rellena: 13:15 → 13:30 cubierto, pero 12:00 no.
  assert.equal(priceAt(SNAP.series.BTC, m('2026-11-26T12:00:00Z')), null);
});

test('p2 reacción: las fotos se encadenan entre corridas y no rellenan huecos', () => {
  let s = appendSnapshots(null, { BTC: 100 }, new Date('2026-11-26T10:00:00Z'));
  s = appendSnapshots(s, { BTC: 100 }, new Date('2026-11-26T10:15:00Z'));
  assert.equal(s.series.BTC.length, 1, 'mismo precio: se alarga el punto');
  s = appendSnapshots(s, { BTC: 101 }, new Date('2026-11-26T10:30:00Z'));
  s = appendSnapshots(s, { BTC: 101 }, new Date('2026-11-26T14:00:00Z'));
  assert.equal(s.series.BTC.length, 3, 'después de un hueco largo es un punto nuevo');
  assert.equal(priceAt(s.series.BTC, m('2026-11-26T12:00:00Z')), null, 'el hueco queda vacío');
  s = appendSnapshots(s, { BTC: 102 }, new Date('2026-12-05T10:00:00Z'));
  assert.ok(s.series.BTC.every((p) => p[0] >= m('2026-11-28T10:00:00Z')), 'se guardan unos 7 días');
});

test('p2 reacción: con las fotos de las copias guardadas, la historia muestra la reacción y sube un nivel si es grande', () => {
  const item = { id: 'x', title: 'Bitcoin climbs as traders eye $100K', summary: '', url: 'https://e.com/x', source: 'CoinDesk', sourceId: 'coindesk', market: 'crypto', tags: ['crypto'], lang: 'en', time: '2026-11-26T13:10:00Z' };
  const big = { series: { BTC: [[m('2026-11-26T13:00:00Z'), 100000, m('2026-11-26T13:15:00Z')], [m('2026-11-26T14:45:00Z'), 104000]] } };
  const out = buildStories({ items: [item], snapshots: big, now: NOW });
  assert.equal(out.stories[0].reaction.pct, 4);
  assert.equal(out.stories[0].level, 'medium', 'bajo + reacción ≥ 3% en cripto = medio');
  assert.ok(out.stories[0].boosts.includes('reaction'));
  const none = buildStories({ items: [item], snapshots: null, now: NOW });
  assert.equal(none.stories[0].reaction, undefined, 'sin fotos no hay reacción');
  assert.equal(none.stories[0].level, 'low');
});

test('p2 reacción: los textos solo describen lo observado (sin dirección futura ni comprar/vender)', () => {
  const FUTURE = /\b(will (rise|fall|go up|go down)|expected to (rise|fall)|likely to (rise|fall)|subirá|bajará|va a (subir|bajar))\b/i;
  for (const lang of ['en', 'es']) {
    const S = STRINGS[lang];
    const keys = Object.keys(S).filter((k) => /^(why\.|boost\.|reaction|impact\.)/.test(k));
    assert.ok(keys.length >= 10, `${lang}: hay textos de impacto`);
    for (const k of keys) {
      assert.ok(!ADVICE.test(S[k]), `${lang} ${k}: ${S[k]}`);
      assert.ok(!FUTURE.test(S[k]), `${lang} ${k}: predice dirección: ${S[k]}`);
    }
  }
  assert.match(STRINGS.en.reaction, /since this headline/);
  // El código que arma la línea usa el número calculado tal cual (con su signo), no una palabra de dirección.
  const main = readFileSync('app/js/main.js', 'utf8');
  assert.match(main, /t\('reaction', \{ asset: .*, pct: .*\}\)/);
});
