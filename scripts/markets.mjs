// Cotizaciones del universo (CNBC), cripto (CoinGecko, alternative.me) y las series de precio (snapshots).
// Regla: nunca se inventa un número. Si un campo no viene, no se escribe.
import { CNBC_QUOTE_URL, UNIVERSE, FX_PAIRS, MACRO, INDEX_SYMBOLS, SNAPSHOT, CRYPTO_SNAP } from '../app/js/config.js';

const BATCH = 40;

const num = (s) => {
  if (s == null || s === '') return null;
  const n = parseFloat(String(s).replace(/[,%+]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// Todos los símbolos que se piden a CNBC (acciones, ETFs, sectores, ADR, forex y macro). Los índices de P1 también,
// para tener sus series.
export function universeSymbols() {
  const all = [...UNIVERSE.map((u) => u.sym), ...FX_PAIRS.map((f) => f.sym), ...MACRO.map((m) => m.sym), ...INDEX_SYMBOLS.map((i) => i.sym)];
  return [...new Set(all)];
}

export function universeUrls() {
  const syms = universeSymbols();
  const urls = [];
  for (let i = 0; i < syms.length; i += BATCH) urls.push(CNBC_QUOTE_URL + encodeURIComponent(syms.slice(i, i + BATCH).join('|')));
  return urls;
}

// «02/23/2027(est)» → { date: '2027-02-23', est: true }. Sin fecha válida → null (no se muestra).
export function parseEarnings(s) {
  const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})\s*(\(est\))?/i);
  if (!m) return null;
  return { date: `${m[3]}-${m[1]}-${m[2]}`, est: !!m[4] };
}

// Respuesta de CNBC → { SYM: {sym,name,last,change,changePct,time,realTime,earnings?} }
export function parseCnbcAny(json) {
  const list = json?.FormattedQuoteResult?.FormattedQuote;
  if (!Array.isArray(list)) throw new Error('Formato de cotizaciones inesperado');
  const out = {};
  for (const q of list) {
    if (!q || q.code !== 0 || num(q.last) == null) continue;
    const o = { sym: q.symbol, name: q.name || q.symbol, last: num(q.last), time: q.last_time || null, realTime: String(q.realTime) === 'true' };
    const ch = num(q.change);
    const cp = num(q.change_pct);
    if (ch != null) o.change = ch;
    if (cp != null) o.changePct = cp;
    if (String(q.last).includes('%')) o.unit = '%';
    const e = parseEarnings(q.EventData?.next_earnings_date);
    if (e) o.earnings = e;
    out[q.symbol] = o;
  }
  return out;
}

export function parseCgGlobal(json) {
  const d = json?.data;
  const mcap = d?.total_market_cap?.usd;
  if (!Number.isFinite(mcap)) throw new Error('CoinGecko global sin datos');
  const g = { mcap, updatedAt: d.updated_at ? new Date(d.updated_at * 1000).toISOString() : null };
  if (Number.isFinite(d.market_cap_change_percentage_24h_usd)) g.mcapChange24 = d.market_cap_change_percentage_24h_usd;
  if (Number.isFinite(d.market_cap_percentage?.btc)) g.btcDominance = d.market_cap_percentage.btc;
  return g;
}

export function parseFng(json) {
  const x = json?.data?.[0];
  const v = parseInt(x?.value, 10);
  if (!Number.isFinite(v)) throw new Error('Fear & Greed sin datos');
  return { value: v, label: String(x.value_classification || ''), time: x.timestamp ? new Date(+x.timestamp * 1000).toISOString() : null };
}

export function parseCgSimple(json) {
  const out = {};
  for (const { key, id } of CRYPTO_SNAP) {
    const c = json?.[id];
    if (!Number.isFinite(c?.usd)) continue;
    out[key] = { price: c.usd, time: c.last_updated_at ? new Date(c.last_updated_at * 1000).toISOString() : null };
    if (Number.isFinite(c.usd_24h_change)) out[key].change24 = c.usd_24h_change;
  }
  if (!Object.keys(out).length) throw new Error('CoinGecko sin precios');
  return out;
}

// ---------- series (snapshots) ----------
// Formato compacto: series[KEY] = [[tMin, precio, tFinMin?], …] con tMin = minutos desde 1970.
// Si el precio no cambió desde el último punto (mercado cerrado), solo se alarga ese punto (tFin) en lugar de repetirlo.
// Así se sabe exactamente qué horas están cubiertas: nunca se rellena un hueco (por ejemplo, corridas que no ocurrieron).
const toMin = (d) => Math.round(new Date(d).getTime() / 60000);
const round6 = (p) => Number(p.toPrecision(6));

export function appendSnapshots(prev, prices, now = new Date()) {
  const t = toMin(now);
  const minT = t - SNAPSHOT.maxDays * 1440;
  const series = {};
  for (const [k, pts] of Object.entries(prev?.series || {})) {
    if (!Array.isArray(pts)) continue;
    const kept = pts.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && (p[2] ?? p[0]) >= minT && p[0] <= t);
    if (kept.length) series[k] = kept;
  }
  for (const [k, raw] of Object.entries(prices)) {
    if (!Number.isFinite(raw)) continue;
    const p = round6(raw);
    const s = (series[k] ||= []);
    const last = s[s.length - 1];
    const lastEnd = last ? last[2] ?? last[0] : null;
    // Mismo precio y sin hueco grande (≤ 2 corridas perdidas): se extiende. Si hubo hueco, punto nuevo.
    if (last && last[1] === p && t - lastEnd <= SNAPSHOT.coverMin * 3) last[2] = t;
    else if (!last || last[0] !== t) s.push([t, p]);
    if (s.length > SNAPSHOT.maxPoints) s.splice(0, s.length - SNAPSHOT.maxPoints);
  }
  return { generatedAt: new Date(now).toISOString(), v: 1, series };
}

// Precio cubierto en el minuto `tMin`: el último punto que empezó antes y cuya cobertura llega a tMin (± coverMin).
export function priceAt(series, when, cover = SNAPSHOT.coverMin) {
  if (!Array.isArray(series) || !series.length) return null;
  const tMin = typeof when === 'number' ? when : toMin(when);
  // 1) El precio vigente a esa hora: el último punto que empezó antes y cuya cobertura llega hasta ahí.
  for (let i = series.length - 1; i >= 0; i--) {
    const [t0, p, t1 = t0] = series[i];
    if (t0 > tMin) continue;
    if (t1 + cover >= tMin) return { price: p, t: Math.min(tMin, t1) };
    break; // el punto anterior más cercano no cubre esa hora
  }
  // 2) Si no hay, la primera foto tomada poco después (dentro de la cobertura). Si tampoco, no hay dato.
  const next = series.find(([t0]) => t0 > tMin && t0 <= tMin + cover);
  return next ? { price: next[1], t: next[0] } : null;
}

export function latestPoint(series) {
  if (!Array.isArray(series) || !series.length) return null;
  const [t0, p, t1 = t0] = series[series.length - 1];
  return { price: p, t: t1 };
}
