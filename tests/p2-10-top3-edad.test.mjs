// P2.2 prueba 10: tope de edad en el Top 3. Una historia con más de 12 h desde su primera aparición solo rellena
// cuando faltan frescas; en «Historias» sigue saliendo.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pickTop3, rankStories } from '../app/js/rank.js';
import { RANK } from '../app/js/config.js';
import { launch, startServer, newPage, ready, prepareData } from './helpers.mjs';

const NOW = Date.parse('2026-11-26T18:20:00Z');
const CTX = { watch: new Set(['NVDA']) };
const s = (id, level, time, assets = [], n = 1) => ({ id, level, time, assets, n });
const ids = (list) => list.map((x) => x.id);

// Caso real del 26-nov: la historia de Nvidia del 25-nov (3 fuentes) tiene 25 h.
const nv = s('nv', 'high', '2026-11-25T17:19:33Z', ['NVDA'], 3);
const op1 = s('op1', 'low', '2026-11-26T16:30:00Z', ['NVDA']);
const op2 = s('op2', 'low', '2026-11-26T15:30:00Z', ['NVDA']);
const cpi = s('cpi', 'high', '2026-11-26T11:53:00Z', ['USD']);
const gold = s('gold', 'medium', '2026-11-26T18:01:00Z', ['XAU', 'USD']);
const bok = s('bok', 'medium', '2026-11-26T18:04:00Z');

test('p2-2 Top 3: la historia de ayer no entra si hay 3 frescas de Alto/Medio', () => {
  assert.equal(RANK.top3MaxAgeHours, 12);
  const list = [op1, op2, nv, cpi, gold, bok];
  // por puntaje sería la primera de Alto/Medio: es el tope de edad el que la deja fuera
  assert.equal(rankStories(list, 'top', CTX, NOW).find((x) => x.level !== 'low').id, 'nv');
  const top = pickTop3(list, CTX, NOW);
  assert.deepEqual(ids(top).sort(), ['bok', 'cpi', 'gold']);
});

test('p2-2 Top 3: con solo 2 frescas, la tercera es la fresca «Bajo»; si no hay, la vieja con mejor puntaje', () => {
  const oldMed = s('oldMed', 'medium', '2026-11-25T10:00:00Z');
  assert.deepEqual(ids(pickTop3([nv, oldMed, op1, cpi, gold], CTX, NOW)), ['gold', 'cpi', 'op1']);
  assert.deepEqual(ids(pickTop3([oldMed, nv, cpi, gold], CTX, NOW)), ['gold', 'cpi', 'nv']);
});

test('p2-2 Top 3: 12 h exactas es fresca; 12 h 1 min ya no', () => {
  const edge = s('edge', 'medium', '2026-11-26T06:20:00Z');
  const over = s('over', 'high', '2026-11-26T06:19:00Z', ['NVDA'], 5);
  const low = s('low', 'low', '2026-11-26T18:00:00Z');
  // «edge» va antes que la fresca «Bajo»; «over», aunque puntúa más, queda detrás de las dos
  assert.deepEqual(ids(pickTop3([over, low, edge], CTX, NOW)), ['edge', 'low', 'over']);
});

test('p2-2 Top 3: entre las viejas, «Bajo» no queda antes que Alto/Medio', () => {
  const fresh = s('fresh', 'medium', '2026-11-26T18:00:00Z');
  const oldLow = s('oldLow', 'low', '2026-11-25T17:00:00Z', ['NVDA']);
  const oldHigh = s('oldHigh', 'high', '2026-11-25T17:00:00Z', ['USD']);
  const list = [oldLow, oldHigh, fresh];
  // por puntaje, mi lista pondría la «Bajo» antes: es el grupo el que lo impide
  assert.deepEqual(ids(rankStories([oldLow, oldHigh], 'top', CTX, NOW)), ['oldLow', 'oldHigh']);
  assert.deepEqual(ids(pickTop3(list, CTX, NOW)), ['fresh', 'oldHigh', 'oldLow']);
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

test('p2-2 Historias: lo viejo sigue en la lista (el tope solo es del Top 3)', async () => {
  // la función de la lista no filtra por edad
  const list = [nv, cpi, gold];
  assert.deepEqual(ids(rankStories(list, 'top', CTX, NOW)).sort(), ['cpi', 'gold', 'nv']);
  // en la app, dos días después todo es viejo: «Historias» lo muestra y el Top 3 se rellena con eso
  const clock = Date.parse('2026-11-28T08:00:00Z');
  const { context, page } = await newPage(browser, srv.url, { lang: 'en' });
  await page.clock.setFixedTime(new Date(clock));
  await page.goto(srv.url);
  await ready(page);
  const times = await page.$$eval('#v-live [data-slot="live"] .it time', (x) => x.map((e) => e.getAttribute('datetime')));
  assert.ok(times.length > 3, `${times.length} historias`);
  assert.ok(times.every((t) => clock - Date.parse(t) > RANK.top3MaxAgeHours * 3600e3), 'todas son viejas y se ven');
  assert.equal(await page.$$eval('#v-live .t3', (x) => x.length), 3);
  await context.close();
});
