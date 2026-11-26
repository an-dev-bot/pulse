// Funciones puras (sin DOM) para ordenar historias, filtrar monedas, buscar en el universo y medir frescura.
// Se usan en la app y en las pruebas. Lo personal (mi lista, palabras clave) solo se usa aquí, en el dispositivo.
import { UNIVERSE, CRYPTO_DENY, STALE_MIN, RANK } from './config.js';

const H = 3600e3;

// ---------- historias ----------
// Historias de la Action + noticias sueltas que aún no están en ninguna historia (por ejemplo, si news.json es más nuevo).
// P2.1: una historia publicada en dos idiomas (s.langs) se muestra en el idioma de la app; la otra versión
// queda como primer enlace en «También en». Sin versión en ese idioma, se queda como vino.
export function localizeStory(s, lang) {
  const v = s.langs?.[lang];
  if (!v) return s;
  const alt = Object.entries(s.langs).filter(([l]) => l !== lang).map(([l, o]) => ({ source: o.source, url: o.url, title: o.title, lang: l }));
  const rest = (s.others || []).filter((o) => o.url !== v.url && !alt.some((a) => a.url === o.url));
  return { ...s, title: v.title, summary: v.summary, url: v.url, source: v.source, lang, others: [...alt, ...rest].slice(0, 6) };
}

export function displayStories(storiesJson, newsJson, lang) {
  const stories = (Array.isArray(storiesJson?.stories) ? storiesJson.stories : []).map((s) => (lang ? localizeStory(s, lang) : s));
  const covered = new Set(stories.flatMap((s) => s.ids || [s.id]));
  const loose = (newsJson?.items || [])
    .filter((it) => !covered.has(it.id))
    .map((it) => ({ ...it, ids: [it.id], n: 1, others: [], assets: [], level: null, rules: [], boosts: [], repeat: false, last: it.time }));
  return [...stories, ...loose];
}

export function storyScore(s, now = Date.now(), ctx = {}) {
  const ageH = Math.max(0, (now - Date.parse(s.time)) / H);
  const w = RANK.weight[s.level] ?? RANK.weight.low;
  let score = w * Math.pow(0.5, ageH / RANK.halfLifeHours);
  score += Math.min(RANK.maxSourceBonus, RANK.perExtraSource * Math.max(0, (s.n || 1) - 1));
  if (ctx.watch && (s.assets || []).some((a) => ctx.watch.has(a))) score += RANK.watchBoost;
  if (ctx.kwMatch && ctx.kwMatch(s)) score += RANK.keywordBoost;
  return score;
}

// P2.1: el Top 3 es de impacto. Mi lista y mis palabras ordenan dentro de Alto/Medio, pero una historia «Bajo»
// solo entra si no hay 3 de Alto/Medio (y va al final).
export function pickTop3(stories, ctx = {}, now = Date.now()) {
  const ranked = rankStories(stories.filter((s) => s.level), 'top', ctx, now);
  const strong = ranked.filter((s) => s.level !== 'low');
  return [...strong, ...ranked.filter((s) => s.level === 'low')].slice(0, 3);
}

// mode: 'top' (impacto × recencia + fuentes + lo personal) | 'latest' (por hora de la primera aparición)
export function rankStories(stories, mode = 'top', ctx = {}, now = Date.now()) {
  const list = [...stories];
  if (mode === 'latest') return list.sort((a, b) => String(b.time).localeCompare(String(a.time)));
  const sc = new Map(list.map((s) => [s, storyScore(s, now, ctx)]));
  return list.sort((a, b) => sc.get(b) - sc.get(a) || String(b.time).localeCompare(String(a.time)));
}

// ---------- cripto ----------
export function isHiddenCoin(c) {
  const sym = String(c.symbol || '').toLowerCase();
  if (CRYPTO_DENY.includes(sym) || CRYPTO_DENY.includes(String(c.id || '').toLowerCase())) return true;
  // Regla «≈ $1 y plana»: stablecoins que no estén en la lista.
  return Number.isFinite(c.price) && Math.abs(c.price - 1) < 0.02 && Number.isFinite(c.change24) && Math.abs(c.change24) < 0.5;
}
export const visibleCoins = (coins) => (coins || []).filter((c) => !isHiddenCoin(c));

// ---------- memecoins ----------
// Filtros: liquidez mínima y edad mínima. En «Lanzamientos» no aplican (allí se avisa con una línea).
export function memeFilter(coins, view, prefs, now = Date.now()) {
  const list = coins || [];
  if (view === 'new') return { shown: list, hidden: 0 };
  const minL = Number(prefs?.minLiquidity) || 0;
  const minA = Number(prefs?.minAgeHours) || 0;
  const shown = list.filter((c) => {
    if (minL && !(c.liquidity >= minL)) return false;
    if (minA && c.createdAt && (now - Date.parse(c.createdAt)) / H < minA) return false;
    return true;
  });
  return { shown, hidden: list.length - shown.length };
}

// ---------- acciones ----------
const BY_SYM = new Map(UNIVERSE.map((u) => [u.sym, u]));
export const universeEntry = (sym) => BY_SYM.get(sym) || null;

export function gainersLosers(quotes, n = 5) {
  const rows = UNIVERSE.filter((u) => u.kind === 'stock' || u.kind === 'adr')
    .map((u) => quotes?.[u.sym])
    .filter((q) => q && Number.isFinite(q.changePct));
  const sorted = [...rows].sort((a, b) => b.changePct - a.changePct);
  return {
    gainers: sorted.filter((q) => q.changePct > 0).slice(0, n),
    losers: [...sorted].reverse().filter((q) => q.changePct < 0).slice(0, n),
  };
}

export function sectorMoves(quotes) {
  return UNIVERSE.filter((u) => u.kind === 'sector')
    .map((u) => (quotes?.[u.sym] && Number.isFinite(quotes[u.sym].changePct) ? { ...quotes[u.sym], sector: u.sector } : null))
    .filter(Boolean)
    .sort((a, b) => b.changePct - a.changePct);
}

// Busca en el universo por símbolo o por nombre. Devuelve las entradas del universo (no inventa ninguna).
export function searchUniverse(q) {
  const s = String(q || '').trim();
  if (!s) return [];
  const up = s.toUpperCase().replace(/^\$/, '');
  const low = s.toLowerCase();
  const exact = [];
  const rest = [];
  for (const u of UNIVERSE) {
    if (u.sym === up) exact.push(u);
    else if (u.sym.startsWith(up) || u.name.toLowerCase().includes(low) || u.names.some((n) => n.replace(/\(.*\)/, '').toLowerCase().includes(low))) rest.push(u);
  }
  return [...exact, ...rest].slice(0, 12);
}

// ---------- frescura ----------
export function ageMinutes(iso, now = Date.now()) {
  if (!iso) return Infinity;
  return (now - Date.parse(iso)) / 60000;
}
export const isStale = (iso, now = Date.now()) => ageMinutes(iso, now) > STALE_MIN;
