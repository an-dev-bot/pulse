// P2 prueba 3: tabla de impacto (≥ 30 casos). Cada caso: título → nivel esperado y fichas de activos esperadas.
// Solo reglas: el nivel dice qué suele moverse, nunca la dirección.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, detectAssets, buildStories } from '../scripts/impact.mjs';

// [título, nivel, fichas (en orden; [] = ninguna)]
export const CASES = [
  // ---------- Alto: macro de EE. UU. y bancos centrales ----------
  ['Fed holds interest rates steady, signals two cuts next year', 'high', ['USD']],
  ['ECB cuts rates by 25 bps as inflation cools', 'high', ['EUR']],
  ['Bank of Japan raises rates to highest since 2008', 'high', ['JPY']],
  ['Banxico recorta la tasa de interés a 7%', 'high', ['MXN']],
  ['US CPI rises 0.3% in October, core inflation steady', 'high', ['USD']],
  ['Nonfarm payrolls beat expectations with 254K jobs added', 'high', []],
  ['US GDP grows 2.8% in third quarter', 'high', ['USD']],
  ['Inflación en México sube a 4.5% anual en octubre', 'high', ['MXN']],
  ['Trump announces new tariffs on Chinese imports', 'high', ['CNY']],
  // ---------- Alto: cripto y megacaps ----------
  ['Crypto exchange hacked, $400M drained from hot wallet', 'high', []],
  ['SEC approves spot Solana ETF applications', 'high', ['SOL']],
  ['SEC sues Coinbase over unregistered securities', 'high', ['COIN']], // acción de la SEC contra un nombre cripto grande
  ['Nvidia earnings beat estimates as data center revenue soars', 'high', ['NVDA']],
  ['Apple revenue misses forecasts on weak iPhone sales', 'high', ['AAPL']],
  ['Nvidia agrees to $290M settlement over crypto mining revenue disclosures', 'high', ['NVDA']],
  ['Mining firm files for Chapter 11 bankruptcy protection', 'high', []],
  // P2.1: titulares reales de hoy (26-nov). Un dato publicado con su cifra es alto aunque diga «ahead of».
  ['US inflation rises to 3.8% ahead of December Fed meeting, tariffs push prices higher', 'high', ['USD']],
  // ---------- Medio ----------
  // P2.1: comentario que solo menciona el evento (apuestas, «ahead of», «outlook», precio que «stays / falters») → medio como mucho
  ['Gold stays below $3,600 as Fed rate hike bets and geopolitical risks support USD', 'medium', ['XAU', 'USD']],
  ['Core PCE inflation data due Thursday', 'medium', []], // antes alto: anuncia un dato, no lo publica
  ['Fed to cut rates in December, traders bet', 'medium', ['USD']],
  ['EUR/USD falters ahead of ECB rate decision', 'medium', ['EUR', 'USD']],
  ['Tariff outlook weighs on stocks as investors await details', 'medium', []],
  ['Walmart earnings top estimates, raises guidance', 'medium', ['WMT']],
  ['Morgan Stanley upgrades AMD to overweight', 'medium', ['AMD']],
  ['Senate committee advances stablecoin bill', 'medium', []],
  ['Powell speech at Jackson Hole in focus', 'medium', ['USD']],
  ['Treasury yields climb ahead of auction', 'medium', ['US10Y']],
  ['Euro area PMI improves in November', 'medium', ['EUR']],
  ['Bitcoin price outlook: regulation proposal moves to Congress', 'medium', ['BTC']],
  ['Lagarde speech: ECB in a good place', 'medium', ['EUR']],
  // ---------- Bajo ----------
  ['Bitcoin climbs as traders eye $100K', 'low', ['BTC']],
  ['What is a memecoin? A beginner guide', 'low', []],
  ['Opinion: Why the Fed should cut rates now', 'low', ['USD']], // opinión: se queda en bajo aunque hable de tasas
  ['Is the stock market open for Thanksgiving?', 'low', ['SPX']],
  ['Ethereum developers schedule next network upgrade', 'low', ['ETH']],
  ['Dogecoin jumps 12% on social media buzz', 'low', ['DOGE']],
  ['Gold steadies near record as dollar slips', 'low', ['XAU', 'USD']],
  ['Hackers breach hospital network in ransomware attack', 'low', []], // hackeo que no es cripto: no sube
  ['USD/JPY holds above 150 in quiet Asian session', 'low', ['USD', 'JPY']],
  ['Podcast recap: the week in markets', 'low', []],
  ['Australian Dollar edges higher against peers', 'low', ['AUD']],
];

test('p2 tabla de impacto: al menos 30 casos', () => {
  assert.ok(CASES.length >= 30, `${CASES.length} casos`);
});

for (const [title, level, chips] of CASES) {
  test(`p2 impacto «${title}» → ${level} ${JSON.stringify(chips)}`, () => {
    const assets = detectAssets(title);
    assert.deepEqual(assets, chips, 'fichas');
    assert.equal(classify(title, assets).level, level, 'nivel');
  });
}

test('p2 impacto: un evento de alto impacto a ±2 h de la misma moneda sube un nivel; fuera de la ventana, no', () => {
  const now = new Date('2026-11-26T15:00:00Z');
  const item = (id, title, time) => ({ id, title, summary: '', url: `https://e.com/${id}`, source: 'Prueba', sourceId: 'x', market: 'forex', tags: ['forex'], lang: 'en', time });
  const cal = { events: [{ title: 'Unemployment Claims', country: 'USD', impact: 'high', time: '2026-11-26T13:30:00Z' }] };
  const near = buildStories({ items: [item('a', 'Dollar edges lower against the yen', '2026-11-26T14:00:00Z')], calendar: cal, now });
  assert.equal(near.stories[0].level, 'medium');
  assert.deepEqual(near.stories[0].boosts, ['calendar']);
  const far = buildStories({ items: [item('b', 'Dollar edges lower against the yen', '2026-11-26T20:00:00Z')], calendar: cal, now });
  assert.equal(far.stories[0].level, 'low');
  const other = buildStories({ items: [item('c', 'Euro edges lower against the yen', '2026-11-26T14:00:00Z')], calendar: cal, now });
  assert.equal(other.stories[0].level, 'low', 'otra moneda no sube');
});

test('p2 impacto: 4 fuentes o más suben un nivel', () => {
  const now = new Date('2026-11-26T15:00:00Z');
  const srcs = ['CoinDesk', 'Cointelegraph', 'Decrypt', 'The Block'];
  const items = srcs.map((s, i) => ({ id: 'n' + i, title: ['Ethereum developers schedule next network upgrade for March', 'Ethereum developers schedule the next network upgrade', 'Ethereum devs schedule next network upgrade for March', 'Ethereum developers set schedule for next network upgrade'][i], summary: '', url: `https://e.com/${i}`, source: s, sourceId: 's' + i, market: 'crypto', tags: ['crypto'], lang: 'en', time: `2026-11-26T1${i}:00:00Z` }));
  const out = buildStories({ items, now });
  assert.equal(out.stories.length, 1, 'una sola historia');
  assert.equal(out.stories[0].n, 4);
  assert.equal(out.stories[0].level, 'medium');
  assert.ok(out.stories[0].boosts.includes('sources'));
});
