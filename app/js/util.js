import { APP } from './config.js';
import { getLang, t } from './i18n.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const fmtCache = new Map();
function fmt(key, make) {
  const k = getLang() + key;
  let f = fmtCache.get(k);
  if (!f) fmtCache.set(k, (f = make(getLang())));
  return f;
}

export function clock(iso) {
  if (!iso) return '';
  return fmt('clock', (l) => new Intl.DateTimeFormat(l, { timeZone: APP.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })).format(new Date(iso));
}
export function dayLabel(iso) {
  return fmt('day', (l) => new Intl.DateTimeFormat(l, { timeZone: APP.timeZone, weekday: 'short', day: 'numeric', month: 'short' })).format(new Date(iso));
}
export function dayKey(iso) {
  return fmt('dkey', () => new Intl.DateTimeFormat('en-CA', { timeZone: APP.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })).format(new Date(iso));
}

export function ago(iso, now = Date.now()) {
  if (!iso) return '';
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 45) return t('ago.now');
  const rtf = fmt('rtf', (l) => new Intl.RelativeTimeFormat(l, { style: 'short', numeric: 'always' }));
  if (s < 3600) return rtf.format(-Math.max(1, Math.round(s / 60)), 'minute');
  if (s < 86400 * 2) return rtf.format(-Math.round(s / 3600), 'hour');
  return rtf.format(-Math.round(s / 86400), 'day');
}

// Duración corta: «2 h 13 min», «45 min», «3 d»
export function duration(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return t('min', { n: m });
  const h = Math.floor(m / 60);
  if (h < 48) return `${t('h', { n: h })} ${t('min', { n: m % 60 })}`;
  return t('d', { n: Math.floor(h / 24) });
}

export function age(iso, now = Date.now()) {
  if (!iso) return '—';
  const m = Math.max(0, (now - new Date(iso).getTime()) / 60000);
  if (m < 60) return t('min', { n: Math.round(m) });
  if (m < 48 * 60) return t('h', { n: Math.floor(m / 60) });
  return t('d', { n: Math.floor(m / 1440) });
}

export function num(n, digits = 2) {
  if (n == null || !Number.isFinite(n)) return '—';
  return fmt('num' + digits, (l) => new Intl.NumberFormat(l === 'es' ? 'es-MX' : 'en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })).format(n);
}

export function usdCompact(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return '$' + fmt('cmp', (l) => new Intl.NumberFormat(l === 'es' ? 'es-MX' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 })).format(n);
}

// Precio con ceros compactados para monedas diminutas: 0.0₅4006
export function price(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1000) return '$' + num(n, 0);
  if (n >= 1) return '$' + num(n, 2);
  if (n >= 0.0001) return '$' + n.toPrecision(4).replace(/0+$/, '');
  const s = n.toFixed(20).slice(2); // dígitos después del punto
  const zeros = s.match(/^0*/)[0].length;
  const digits = s.slice(zeros, zeros + 4);
  return `$0.0<sub>${zeros}</sub>${digits}`;
}

export function pct(n) {
  if (n == null || !Number.isFinite(n)) return '<span class="flat">—</span>';
  const cls = n > 0 ? 'up' : n < 0 ? 'down' : 'flat';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `<span class="${cls}">${sign}${num(Math.abs(n), Math.abs(n) >= 100 ? 0 : 2)}%</span>`;
}

const reCache = { key: '', re: null };
export function keywordRegex(keywords) {
  const key = keywords.join('\u0001');
  if (reCache.key !== key) {
    reCache.key = key;
    reCache.re = keywords.length
      ? new RegExp(`(^|[^\\p{L}\\p{N}])(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=$|[^\\p{L}\\p{N}])`, 'giu')
      : null;
  }
  return reCache.re;
}

export function highlight(text, re) {
  const safe = esc(text);
  if (!re) return safe;
  re.lastIndex = 0;
  return safe.replace(re, (m, pre, word) => `${pre}<mark>${word}</mark>`);
}

export function matchesKeyword(item, re) {
  if (!re) return null;
  re.lastIndex = 0;
  const m = re.exec(`${item.title} ${item.summary || ''}`);
  re.lastIndex = 0;
  return m ? m[2] : null;
}
