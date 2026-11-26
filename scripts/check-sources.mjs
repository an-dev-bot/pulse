// Revisa las fuentes REALES (con internet): que respondan y que se lean bien.
import { NEWS_SOURCES, CALENDAR_SOURCE, INDICES_SOURCE, DIRECT_SOURCES, UNIVERSE_SOURCE, CRYPTO_SOURCES } from './sources.mjs';
import { parseCnbcAny, parseCgGlobal, parseCgSimple, parseFng, universeSymbols } from './markets.mjs';
import { parseFeed, parseFFCalendar } from './parse.mjs';
import { parseCnbcQuotes } from '../app/js/shared.js';
import { defaultFetchText } from './collect.mjs';

let fails = 0;
const line = (ok, id, msg) => {
  if (!ok) fails++;
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${id.padEnd(20)} ${msg}`);
};

await Promise.all([
  ...NEWS_SOURCES.map(async (s) => {
    try {
      const items = parseFeed(await defaultFetchText(s.url), s);
      line(items.length > 0, s.id, `${items.length} noticias · «${items[0]?.title.slice(0, 50)}»`);
    } catch (e) { line(false, s.id, e.message); }
  }),
  (async () => {
    try { const ev = parseFFCalendar(JSON.parse(await defaultFetchText(CALENDAR_SOURCE.url))); line(true, CALENDAR_SOURCE.id, `${ev.length} eventos`); }
    catch (e) { line(false, CALENDAR_SOURCE.id, e.message); }
  })(),
  (async () => {
    try { const q = parseCnbcQuotes(JSON.parse(await defaultFetchText(INDICES_SOURCE.url))); line(true, INDICES_SOURCE.id, q.map((x) => x.label).join(', ')); }
    catch (e) { line(false, INDICES_SOURCE.id, e.message); }
  })(),
  // P2: el universo de acciones (cada símbolo de config.js debe volver con precio) y la fecha de resultados.
  (async () => {
    try {
      const parts = await Promise.all(UNIVERSE_SOURCE.urls.map(async (u) => parseCnbcAny(JSON.parse(await defaultFetchText(u)))));
      const q = Object.assign({}, ...parts);
      const missing = universeSymbols().filter((sym) => !q[sym]);
      const earn = Object.values(q).filter((x) => x.earnings);
      const est = earn.filter((x) => x.earnings.est).length;
      line(missing.length === 0, UNIVERSE_SOURCE.id, `${Object.keys(q).length}/${universeSymbols().length} símbolos${missing.length ? ' · faltan: ' + missing.join(', ') : ''} · resultados: ${earn.length} (${est} «est»)`);
    } catch (e) { line(false, UNIVERSE_SOURCE.id, e.message); }
  })(),
  ...CRYPTO_SOURCES.map(async (s) => {
    try {
      const j = JSON.parse(await defaultFetchText(s.url));
      const parsed = s.id === 'coingecko-global' ? parseCgGlobal(j) : s.id === 'fng' ? parseFng(j) : parseCgSimple(j);
      line(!!parsed, s.id, JSON.stringify(parsed).slice(0, 90));
    } catch (e) { line(false, s.id, e.message); }
  }),
  ...DIRECT_SOURCES.map(async (s) => {
    try {
      const r = await fetch(s.url, { headers: { Origin: 'https://example.github.io' }, signal: AbortSignal.timeout(20000) });
      const cors = r.headers.get('access-control-allow-origin');
      JSON.parse(await r.text());
      line(r.ok && !!cors, s.id, `HTTP ${r.status} · CORS ${cors || 'NO'} (se pide desde el teléfono)`);
    } catch (e) { line(false, s.id, e.message); }
  }),
]);
console.log(fails ? `\n${fails} fuente(s) con problemas` : '\nTodas las fuentes responden');
process.exitCode = fails ? 1 : 0;
