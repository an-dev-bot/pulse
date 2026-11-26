// P2 prueba 2: titulares parecidos se juntan en una historia («+N fuentes»); lo que vuelve a salir se marca «repetida»,
// conserva su primera hora y no salta arriba.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStories, groupItems, sameStory as similar } from '../scripts/impact.mjs';
import { collect, fixtureFetcher } from '../scripts/collect.mjs';
import { displayStories, rankStories } from '../app/js/rank.js';
import { STRINGS } from '../app/js/i18n.js';

const NOW = new Date('2026-11-26T08:00:00Z');
const it = (id, title, time, source = 'Fuente ' + id) => ({ id, title, summary: '', url: `https://e.com/${id}`, source, sourceId: source.toLowerCase(), market: 'crypto', tags: ['crypto'], lang: 'en', time });

test('p2 historias: la misma noticia en varios medios es una sola historia con «+N»', () => {
  const items = [
    it('a', 'Nvidia agrees to $290M settlement over crypto mining revenue disclosures', '2026-11-25T17:19:33Z', 'Cointelegraph'),
    it('b', 'Nvidia to pay $290 million to settle crypto mining disclosure claims', '2026-11-25T18:02:00Z', 'The Block'),
    it('c', 'Nvidia settles crypto mining revenue disclosure case for $290M', '2026-11-25T19:40:00Z', 'Decrypt'),
    it('d', 'Bitcoin climbs as traders eye $100K', '2026-11-25T19:00:00Z', 'CoinDesk'),
  ];
  const out = buildStories({ items, now: NOW });
  assert.equal(out.stories.length, 2);
  const nv = out.stories.find((s) => s.ids.includes('a'));
  assert.deepEqual(nv.ids.sort(), ['a', 'b', 'c']);
  assert.equal(nv.n, 3);
  assert.equal(nv.time, '2026-11-25T17:19:33Z', 'hora de la primera aparición');
  assert.equal(nv.others.length, 2);
  assert.equal(STRINGS.en['sources.plus'].replace('{n}', nv.n - 1), '+2 sources');
  assert.equal(STRINGS.es['sources.plus'].replace('{n}', nv.n - 1), '+2 fuentes');
});

test('p2 historias: titulares distintos no se juntan (aunque compartan palabras sueltas)', () => {
  assert.ok(!similar('Bitcoin climbs as traders eye $100K', 'Bitcoin miners sell as hashprice falls'));
  assert.ok(!similar('Fed holds rates steady', 'ECB holds rates steady'), 'otro banco central = otra historia');
  const g = groupItems([it('a', 'Fed holds rates steady at 4.5%', '2026-11-25T10:00:00Z'), it('b', 'ECB holds rates steady at 2%', '2026-11-25T10:30:00Z')]);
  assert.equal(g.length, 2);
});

test('p2 historias: fuera de la ventana de 72 h no se junta', () => {
  const g = groupItems([
    it('a', 'Nvidia agrees to $290M settlement over crypto mining revenue disclosures', '2026-11-20T10:00:00Z'),
    it('b', 'Nvidia agrees to $290M settlement over crypto mining revenue disclosures', '2026-11-25T10:00:00Z'),
  ]);
  assert.equal(g.length, 2);
});

test('p2 historias: lo que vuelve a salir horas después queda «repetida», con su primera hora, y no salta arriba', () => {
  const t1 = 'Binance hack: North Korea-linked group laundered $1.1B through DeFi protocols';
  const run1 = buildStories({ items: [it('a', t1, '2026-11-25T08:00:00Z', 'CoinDesk')], now: new Date('2026-11-25T09:00:00Z') });
  assert.equal(run1.stories[0].repeat, false);
  // 16 h después otro medio publica lo mismo (la Action pasa el resultado anterior con --prev)
  const fresh = it('n', 'Ethereum developers schedule next network upgrade', '2026-11-26T00:30:00Z', 'Decrypt');
  const run2 = buildStories({ items: [it('a', t1, '2026-11-25T08:00:00Z', 'CoinDesk'), it('b', 'North Korea-linked group laundered $1.1B from Binance hack through DeFi protocols', '2026-11-26T00:00:00Z', 'The Block'), fresh], prev: run1, now: new Date('2026-11-26T01:00:00Z') });
  const s = run2.stories.find((x) => x.ids.includes('b'));
  assert.equal(s.repeat, true, 'marcada repetida');
  assert.equal(s.time, '2026-11-25T08:00:00Z', 'conserva la primera hora');
  assert.equal(s.id, run1.stories[0].id, 'mismo id que la primera vez');
  // En «Latest» va por su primera hora: la nueva (00:30) va antes que la repetida (que apareció el día anterior).
  const latest = rankStories(displayStories(run2, null), 'latest', {}, new Date('2026-11-26T01:00:00Z').getTime());
  assert.equal(latest[0].ids[0], 'n');
  assert.ok(STRINGS.en.repeat && STRINGS.es.repeat);
});

test('p2 historias: con las copias guardadas sale stories.json válido y news.json queda como en P1', async () => {
  const d = await collect({ fetchText: fixtureFetcher('tests/fixtures'), now: NOW });
  assert.equal(d.stories.method, 'rules');
  assert.ok(d.stories.stories.length > 50);
  const covered = new Set(d.stories.stories.flatMap((s) => s.ids));
  for (const n of d.news.items) assert.ok(covered.has(n.id), `sin historia: ${n.id}`);
  assert.ok(d.stories.stories.some((s) => s.n >= 3), 'hay al menos una historia con 3 fuentes');
  for (const s of d.stories.stories) {
    assert.ok(['high', 'medium', 'low'].includes(s.level));
    assert.ok(s.n >= 1 && s.ids.length >= s.n);
    assert.ok(Array.isArray(s.assets) && s.assets.length <= 4);
  }
  assert.deepEqual(Object.keys(d.news.items[0]).sort(), ['id', 'lang', 'market', 'source', 'sourceId', 'summary', 'tags', 'time', 'title', 'url'].sort());
});

// P2.1: FXStreet y FXStreet ES publican la misma nota en dos idiomas. Se juntan con señales sin idioma
// (misma familia, ≤ 3 h, mismas fichas, mismas cifras: 3,600 = 3.600); la tarjeta sale en el idioma de la app y enlaza ambas.
test('p2 historias: la pareja del oro de hoy (FXStreet EN/ES) es una sola historia, en el idioma de la app', async () => {
  const { localizeStory } = await import('../app/js/rank.js');
  const fx = (id, title, time, lang) => ({ ...it(id, title, time, lang === 'es' ? 'FXStreet ES' : 'FXStreet'), sourceId: lang === 'es' ? 'fxstreet-es' : 'fxstreet', lang, market: 'forex', tags: ['forex'] });
  const items = [
    fx('en1', 'Gold stays below $3,600 as Fed rate hike bets and geopolitical risks support USD', '2026-11-26T04:50:44Z', 'en'),
    fx('es1', 'El Oro se mantiene por debajo de 3.600$ mientras las apuestas sobre la Fed y el repunte del USD limitan la recuperación desde mínimos de 15 meses', '2026-11-26T04:51:07Z', 'es'),
    // otra nota del oro en español con otra cifra: no es la misma
    fx('es2', 'El Oro rebota por encima de los 3.550$ mientras caen los rendimientos del USD', '2026-11-26T03:30:00Z', 'es'),
    // otra familia de fuente con la misma cifra: no se junta por idioma
    { ...it('o1', 'Precio del Oro: los 3.600$ siguen como techo para el USD', '2026-11-26T05:00:00Z', 'Otro Medio'), lang: 'es' },
  ];
  const out = buildStories({ items, now: NOW });
  const gold = out.stories.find((s) => s.ids.includes('en1'));
  assert.deepEqual(gold.ids.sort(), ['en1', 'es1'], 'la pareja EN/ES se junta y nada más');
  assert.equal(gold.n, 1, 'una traducción no cuenta como otra fuente');
  assert.deepEqual(Object.keys(gold.langs).sort(), ['en', 'es']);
  const es = localizeStory(gold, 'es');
  assert.match(es.title, /^El Oro se mantiene/);
  assert.equal(es.url, 'https://e.com/es1');
  assert.equal(es.lang, 'es');
  assert.equal(es.others[0].url, 'https://e.com/en1', 'enlaza también la versión en inglés');
  const en = localizeStory(gold, 'en');
  assert.match(en.title, /^Gold stays below/);
  assert.equal(en.others[0].url, 'https://e.com/es1');
  // una nota que solo existe en un idioma se queda igual
  const solo = out.stories.find((s) => s.ids.includes('es2'));
  assert.equal(solo.langs, undefined);
  assert.equal(localizeStory(solo, 'en'), solo);
});
