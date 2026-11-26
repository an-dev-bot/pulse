// Historias e impacto (corre en la Action, sin IA ni APIs de pago).
// 1) Agrupa titulares del mismo hecho → una historia con «+N fuentes».
// 2) Fichas de activos con un diccionario (acciones del universo, cripto, monedas, bancos centrales, índices).
// 3) Nivel Alto/Medio/Bajo con reglas (scripts/impact-rules.mjs) + calendario ±2 h + nº de fuentes + reacción observada.
// 4) Reacción = lo que ya pasó en el precio según las series guardadas por la propia Action. Nunca una predicción.
import { UNIVERSE, ASSET_WORDS, ASSET_SERIES, ASSET_LABELS, REACTION_BUMP, FX_PAIRS, MACRO, INDEX_SYMBOLS } from '../app/js/config.js';
import { normalizeTitle } from '../app/js/shared.js';
import { RULES, LEVELS, GROUPS, CRYPTO_WORD, SOURCES_BUMP, CALENDAR_WINDOW_H, GROUP, REPEAT_AFTER_H, EVENT, DATA_EVENT, DATA_RULES, COMMENTARY } from './impact-rules.mjs';
import { priceAt, latestPoint } from './markets.mjs';

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- activos ----------
const ASSET_MATCHERS = (() => {
  const m = [];
  for (const u of UNIVERSE) {
    if (u.kind === 'sector') continue;
    const parts = u.names.map((n) => `\\b${n}(?![\\p{L}\\p{N}])`);
    const t = escRe(u.sym);
    parts.push(`\\$${t}\\b`, `\\(${t}\\)`, `\\b(NASDAQ|NYSE):\\s?${t}\\b`);
    if (u.tickerInText !== false && u.sym.length >= 3) parts.push(`\\b${t}\\b`);
    m.push({ asset: u.sym, re: new RegExp(parts.join('|'), 'u') });
  }
  for (const w of ASSET_WORDS) m.push({ asset: w.asset, re: new RegExp(w.re, 'u'), weak: !!w.weak });
  return m;
})();

// Activos mencionados, en orden de aparición. Sin duplicados.
export function detectAssets(text, { strong = false } = {}) {
  const s = String(text || '');
  const hits = [];
  for (const { asset, re, weak } of ASSET_MATCHERS) {
    if (strong && weak) continue;
    const m = re.exec(s);
    if (m && !hits.some((h) => h.asset === asset)) hits.push({ asset, at: m.index });
  }
  hits.sort((a, b) => a.at - b.at);
  return hits.map((h) => h.asset);
}

export function assetLabel(a) {
  return ASSET_LABELS[a] || a;
}

// ---------- reglas ----------
const COMPILED = RULES.map((r) => ({ ...r, rx: new RegExp(r.re, 'iu') }));
const CRYPTO_RX = new RegExp(CRYPTO_WORD, 'iu');
const EVENT_RX = new RegExp(EVENT, 'iu');
const DATA_EVENT_RX = new RegExp(DATA_EVENT, 'iu');
const COMMENTARY_RX = new RegExp(COMMENTARY, 'iu');

export function classify(title, assets = detectAssets(title)) {
  const hits = [];
  for (const r of COMPILED) {
    if (!r.rx.test(title)) continue;
    if (r.needs && ![].concat(r.needs).some((g) => assets.some((a) => GROUPS[g].includes(a)))) continue;
    if (r.needsWord === 'crypto' && !CRYPTO_RX.test(title) && !assets.some((a) => GROUPS.crypto.includes(a))) continue;
    hits.push(r);
  }
  // Una nota de opinión o guía se queda en bajo aunque mencione un tema fuerte.
  const feature = hits.find((r) => r.id === 'feature');
  const strong = hits.filter((r) => r.id !== 'feature').sort((a, b) => LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level));
  if (feature) return { level: 'low', rules: ['feature'], feature: true };
  const commentary = COMMENTARY_RX.test(title);
  if (!strong.length) return { level: 'low', rules: [], commentary };
  const rules = [...new Set(strong.map((r) => r.id))].slice(0, 2);
  // P2.1: «alto» solo con un evento que ya pasó en el título; si solo lo comenta o lo anticipa, «medio».
  const event = EVENT_RX.test(title) || (DATA_EVENT_RX.test(title) && strong.some((r) => DATA_RULES.includes(r.id)));
  if (strong[0].level === 'high' && !event) return { level: 'medium', rules, event: false, commentary };
  return { level: strong[0].level, rules, event, commentary: commentary && !event };
}

// ---------- agrupación ----------
const STOP = new Set(
  ('the a an and or of to in on for at by with from as is are was were be been it its this that these those after before over under into than then up down new says said say will would could may might can ' +
    'amid about near more most less vs via just still now today week year what why how who when where which while not no yes his her their our your you we they he she them' +
    ' million billion trillion millones' +
    ' el la los las un una unos unas y o de del al en por para con sin sobre como que se su sus es son fue ser lo le ya muy más menos tras ante hoy').split(' ')
);

export function titleTokens(title) {
  const out = new Set();
  for (let w of normalizeTitle(title).split(' ')) {
    w = w.replace(/^(\d+)(m|bn|b|k)$/, '$1'); // «$290M» = «290 million»
    if (w.length < 3 && !/^\d{2,}$/.test(w)) continue;
    if (STOP.has(w)) continue;
    if (w.length > 6) w = w.replace(/(ments?|ing|ed)$/, ''); // settlement ≈ settle
    if (w.length > 4 && w.endsWith('s')) w = w.slice(0, -1);
    out.add(w);
  }
  return out;
}

export function similar(a, b) {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  if (shared < GROUP.minShared) return 0;
  const overlap = shared / Math.min(a.size, b.size);
  const jac = shared / (a.size + b.size - shared);
  return overlap >= GROUP.overlap || jac >= GROUP.jaccard ? Math.max(overlap, jac) : 0;
}

// Si los dos títulos nombran activos y no comparten ninguno, son historias distintas («Fed holds rates» ≠ «ECB holds rates»).
const disjoint = (a, b) => a.length > 0 && b.length > 0 && !a.some((x) => b.includes(x));
export function sameStory(titleA, titleB) {
  return !disjoint(detectAssets(titleA), detectAssets(titleB)) && similar(titleTokens(titleA), titleTokens(titleB)) > 0;
}

// P2.1: la misma nota en dos idiomas (FXStreet y FXStreet ES). Señales que no dependen del idioma:
// misma familia de fuente, a ≤ 3 h, mismas fichas de activos y las mismas cifras en el título (3,600 = 3.600).
export const CROSS_LANG_H = 3;
export const CROSS_LANG_NONUM_MIN = 30;
export const sourceFamily = (id = '') => id.replace(/-(es|en)$/, '');
export function titleNumbers(title = '') {
  return [...new Set((title.match(/\d[\d.,]*\d|\d/g) || []).map((n) => {
    if (/^\d{1,3}([.,]\d{3})+$/.test(n)) return Number(n.replace(/[.,]/g, ''));
    return Number(n.replace(',', '.'));
  }))];
}
function crossLang(a, b) {
  if (!a.it.lang || !b.it.lang || a.it.lang === b.it.lang) return false;
  if (sourceFamily(a.it.sourceId) !== sourceFamily(b.it.sourceId)) return false;
  if (Math.abs(a.t - b.t) > CROSS_LANG_H * 3600e3) return false;
  if (!a.assets.length || a.assets.length !== b.assets.length || !a.assets.every((x) => b.assets.includes(x))) return false;
  // Sin cifras en ninguno de los dos: solo si salieron casi juntos (las traducciones salen en minutos).
  if (!a.nums.length && !b.nums.length) return Math.abs(a.t - b.t) <= CROSS_LANG_NONUM_MIN * 60e3;
  const [small, big] = a.nums.length <= b.nums.length ? [a.nums, b.nums] : [b.nums, a.nums];
  return small.length > 0 && small.every((n) => big.includes(n));
}

export function groupItems(items) {
  const sorted = [...items].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const groups = [];
  const win = GROUP.windowHours * 3600e3;
  for (const it of sorted) {
    const tok = titleTokens(it.title);
    const assets = detectAssets(it.title);
    const t = Date.parse(it.time);
    const nums = titleNumbers(it.title);
    const me = { it, tok, assets, t, nums };
    let best = null;
    let bestSim = 0;
    for (const g of groups) {
      if (t - g.lastT > win) continue;
      for (const m of g.members) {
        const s = crossLang(me, m) ? 1 : disjoint(assets, m.assets) ? 0 : similar(tok, m.tok);
        if (s > bestSim) {
          bestSim = s;
          best = g;
        }
      }
    }
    if (best) {
      best.members.push(me);
      best.lastT = Math.max(best.lastT, t);
    } else groups.push({ members: [me], lastT: t });
  }
  return groups.map((g) => g.members.map((m) => m.it));
}

// ---------- calendario y reacción ----------
const INDEX_ASSETS = new Set(['SPX', 'NDX', 'DJI', 'RUT', 'US10Y']);
function eventTouches(ev, assets) {
  const c = ev.country;
  if (assets.includes(c)) return true;
  if (c === 'USD') return assets.some((a) => INDEX_ASSETS.has(a) || UNIVERSE.some((u) => u.sym === a));
  return false;
}

function kindOf(asset) {
  if (['BTC', 'ETH', 'SOL'].includes(asset)) return 'crypto';
  if (['XAU', 'OIL'].includes(asset)) return 'commodity';
  if (['SPX', 'NDX', 'DJI', 'RUT', 'IPC'].includes(asset)) return 'index';
  if (ASSET_SERIES[asset]) return 'fx';
  return 'stock';
}

const SERIES_LABEL = Object.fromEntries([...FX_PAIRS, ...MACRO, ...INDEX_SYMBOLS].map((x) => [x.sym, x.label]));

// Reacción observada: cambio entre el precio cubierto a la hora del titular y el último precio guardado.
// Sin serie, sin cobertura a esa hora o sin un precio posterior → null (no se muestra nada).
export function reactionFor(assets, firstSeenIso, snapshots, now = new Date()) {
  const series = snapshots?.series || {};
  const t0 = Math.round(Date.parse(firstSeenIso) / 60000);
  const nowMin = Math.round(new Date(now).getTime() / 60000);
  for (const a of assets) {
    const key = ASSET_SERIES[a] || (UNIVERSE.some((u) => u.sym === a) ? a : null);
    if (!key || !series[key]) continue;
    const p0 = priceAt(series[key], t0);
    const p1 = latestPoint(series[key]);
    if (!p0 || !p1 || p1.t <= p0.t || p1.t < t0 || nowMin - p1.t > 90) continue;
    const pct = (p1.price / p0.price - 1) * 100;
    if (!Number.isFinite(pct)) continue;
    return {
      asset: a,
      key,
      label: SERIES_LABEL[key] || assetLabel(a),
      pct: Math.round(pct * 100) / 100,
      from: new Date(p0.t * 60000).toISOString(),
      to: new Date(p1.t * 60000).toISOString(),
      kind: kindOf(a),
    };
  }
  return null;
}

// ---------- historias ----------
export function buildStories({ items = [], calendar = null, snapshots = null, prev = null, now = new Date() } = {}) {
  const prevByItem = new Map();
  for (const s of prev?.stories || []) for (const id of s.ids || [s.id]) prevByItem.set(id, s);
  const highs = (calendar?.events || []).filter((e) => e.impact === 'high');
  const stories = [];

  for (const group of groupItems(items)) {
    const first = group[0];
    const prevStory = group.map((it) => prevByItem.get(it.id)).find(Boolean);
    const firstSeen = prevStory && prevStory.time < first.time ? prevStory.time : first.time;
    const times = group.map((g) => Date.parse(g.time));
    let repeat = !!prevStory?.repeat;
    for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] >= REPEAT_AFTER_H * 3600e3) repeat = true;
    if (prevStory && Date.parse(group[group.length - 1].time) - Date.parse(prevStory.last || prevStory.time) >= REPEAT_AFTER_H * 3600e3) repeat = true;

    // Activos: de todos los títulos, los más mencionados primero; si los títulos no nombran ninguno, del resumen.
    const count = new Map();
    for (const it of group) detectAssets(it.title).forEach((a, i) => count.set(a, (count.get(a) || 0) + 10 - Math.min(i, 9)));
    let assets = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a);
    if (!assets.length) assets = detectAssets(first.summary, { strong: true });
    assets = assets.slice(0, 4);

    // Nivel base: la regla más fuerte entre todos los títulos del grupo.
    let base = classify(first.title, assets);
    if (!base.feature) {
      for (const it of group.slice(1)) {
        const c = classify(it.title, assets);
        if (!c.feature && LEVELS.indexOf(c.level) > LEVELS.indexOf(base.level)) base = c;
      }
    }

    // P2.1: una traducción de la misma familia (FXStreet / FXStreet ES) no cuenta como otra fuente.
    const sources = [...new Set(group.map((g) => (g.sourceId ? sourceFamily(g.sourceId) : g.source)))];
    const boosts = [];
    const t0 = Date.parse(firstSeen);
    const ev = highs.find((e) => Math.abs(Date.parse(e.time) - t0) <= CALENDAR_WINDOW_H * 3600e3 && eventTouches(e, assets));
    if (ev) boosts.push('calendar');
    if (sources.length >= SOURCES_BUMP) boosts.push('sources');
    const reaction = reactionFor(assets, firstSeen, snapshots, now);
    if (reaction && Math.abs(reaction.pct) >= REACTION_BUMP[reaction.kind]) boosts.push('reaction');
    let li = LEVELS.indexOf(base.level) + boosts.length;
    if (base.feature) li = Math.min(li, 1);
    // P2.1: «alto» pide un evento en el título, un evento del calendario o una reacción del precio; las fuentes solas no bastan.
    // Un comentario sin evento («Fed hike bets», «ahead of», «stays below»…) se queda en «medio» como mucho.
    if (!base.event && (base.commentary || (!boosts.includes('calendar') && !boosts.includes('reaction')))) li = Math.min(li, 1);
    const level = LEVELS[Math.min(li, 2)];

    const s = {
      id: prevStory?.id || first.id,
      ids: group.map((g) => g.id),
      title: first.title,
      summary: first.summary || '',
      url: first.url,
      source: first.source,
      sourceId: first.sourceId,
      lang: first.lang,
      market: first.market,
      tags: [...new Set(group.flatMap((g) => g.tags || [g.market]))],
      time: firstSeen,
      last: group[group.length - 1].time,
      n: sources.length,
      others: group.slice(1).filter((g) => g.source !== first.source || g.url !== first.url).slice(0, 6).map((g) => ({ source: g.source, url: g.url, title: g.title, time: g.time })),
      repeat,
      level,
      rules: base.rules,
      boosts,
      assets,
    };
    if (ev) s.event = { title: ev.title, country: ev.country, time: ev.time };
    // P2.1: si la misma familia la publicó en dos idiomas, guardamos cada versión; la app muestra la de su idioma.
    const langs = {};
    for (const g of group) if (g.lang && !langs[g.lang] && sourceFamily(g.sourceId) === sourceFamily(first.sourceId)) langs[g.lang] = { title: g.title, summary: g.summary || '', url: g.url, source: g.source };
    if (Object.keys(langs).length > 1) s.langs = langs;
    if (reaction) s.reaction = reaction;
    stories.push(s);
  }
  stories.sort((a, b) => b.time.localeCompare(a.time));
  return { generatedAt: new Date(now).toISOString(), method: 'rules', stories };
}
