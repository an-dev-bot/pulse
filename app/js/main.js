import { APP, MARKETS, CHAINS, MEME_LIMITS, REFRESH, UNIVERSE, FX_PAIRS, MACRO, INDEX_SYMBOLS, ASSET_LABELS, ASSET_SERIES } from './config.js';
import { setLang, getLang, t } from './i18n.js';
import * as store from './store.js';
import { cachedData, freshData, fetchCoins, lastCoins, fetchMemes, lastMemes } from './api.js';
import { $, $$, esc, clock, dayLabel, dayKey, ago, duration, age, num, usdCompact, price, pct, pctText, quoteNum, keywordRegex, highlight, matchesKeyword, sparkline, seriesValues, dateOnly, tzName } from './util.js';
import { icon } from './icons.js';
import { displayStories, rankStories, visibleCoins, memeFilter, gainersLosers, sectorMoves, searchUniverse, universeEntry, isStale, pickTop3 } from './rank.js';

const PAGE = 40;
const COIN_PAGE = 20;
const TABS = [
  ['live', 'now'],
  ['markets', 'markets'],
  ['memes', 'memes'],
  ['calendar', 'calendar'],
  ['more', 'more'],
];
const P = store.state.prefs;
const S = {
  news: null, stories: null, calendar: null, indices: null, status: null, markets: null, crypto: null, snapshots: null,
  coins: lastCoins(), coinsErr: null, memes: {}, memeErr: null, coinLimit: COIN_PAGE,
  tab: 'live', liveFilter: 'all', mseg: 'stocks', more: 'menu', showPast: false, stockQ: '',
  memeChain: 'solana', memeView: P.memeView, offline: false, scroll: {}, rendered: new Set(), dirty: new Set(), open: new Set(),
};
const lists = {}; // id de lista → { ids:Set, pending:[], limit }
const memePending = { has: false };
let liveMap = null;

// Fuentes de la Action que alimentan cada sección (para decir cuál falla y desde cuándo).
const NON_NEWS = new Set(['forexfactory', 'cnbc-quotes', 'cnbc-universe', 'coingecko-global', 'coingecko-simple', 'fng']);
const SECTION_SRC = {
  stocks: ['cnbc-universe', 'cnbc-quotes', 'cnbc-top', 'cnbc-markets', 'marketwatch'],
  forex: ['cnbc-universe', 'forexfactory', 'fxstreet', 'fxstreet-es', 'investinglive'],
  crypto: ['coingecko-global', 'fng', 'coindesk', 'cointelegraph', 'decrypt', 'theblock'],
  memes: ['ct-memecoin'],
  calendar: ['forexfactory'],
};

// ---------- utilidades ----------
const kwRe = () => keywordRegex(store.state.keywords);
const allNews = () => S.news?.items || [];
const quotes = () => S.markets?.quotes || {};
const indexQuote = (sym) => (S.indices?.quotes || []).find((q) => q.sym === sym) || null;
const anyQuote = (sym) => quotes()[sym] || indexQuote(sym);
const assetLabel = (a) => (STRINGS_HAS(`asset.${a}`) ? t(`asset.${a}`) : ASSET_LABELS[a] || a);
function STRINGS_HAS(k) {
  return t(k) !== k;
}
const todayKey = () => dayKey(new Date().toISOString());
function when(iso) {
  if (!iso) return '';
  return dayKey(iso) === todayKey() ? clock(iso) : `${dayLabel(iso).split(',')[0].split(' ')[0]} ${clock(iso)}`;
}
function rankCtx() {
  const re = kwRe();
  return { watch: new Set(store.state.watchlist), kwMatch: re ? (s) => !!matchesKeyword(s, re) : null };
}
let storyCache = { key: '', list: [] };
function stories() {
  const key = `${S.stories?.generatedAt}|${S.news?.generatedAt}|${S.news?.items?.length}|${getLang()}`;
  if (storyCache.key !== key) storyCache = { key, list: displayStories(S.stories, S.news, getLang()) };
  return storyCache.list;
}
const byTag = (tag) => stories().filter((s) => (s.tags || [s.market]).includes(tag));
const ranked = (list) => rankStories(list, P.sort, rankCtx());
const findStory = (id) => stories().find((s) => s.id === id) || store.savedList().find((s) => s.id === id) || null;

// ---------- frescura ----------
function sectionInfo(section) {
  if (section === 'memes') {
    const d = S.memes[`${S.memeChain}.${S.memeView}`] || lastMemes(S.memeChain, S.memeView);
    return { iso: d?.fetchedAt, phoneErr: S.memeErr, phoneName: 'GeckoTerminal / DEX Screener', srcs: SECTION_SRC.memes };
  }
  if (section === 'crypto') return { iso: S.coins?.fetchedAt, actionIso: S.status?.generatedAt, phoneErr: S.coinsErr, phoneName: 'CoinGecko', srcs: SECTION_SRC.crypto };
  const srcs = section === 'news' ? Object.keys(S.status?.sources || {}).filter((id) => !NON_NEWS.has(id)) : SECTION_SRC[section] || [];
  return { iso: S.status?.generatedAt || S.news?.generatedAt, srcs };
}
function freshHtml(section) {
  const info = sectionInfo(section);
  let html = `<div class="sh"><span class="upd" data-upd="${section}">${esc(info.iso ? t('updated', { t: ago(info.iso) }) : t('updated.never'))}</span></div>`;
  const staleIso = [info.iso, info.actionIso].filter(Boolean).find((x) => isStale(x));
  if (staleIso) {
    html += `<div class="banner" data-stale="${section}">${icon('clock')}<div>${esc(t('stale', { age: duration(Date.now() - Date.parse(staleIso)), time: clock(staleIso) }))}<small>${esc(t('stale.why'))}</small></div></div>`;
  }
  const st = S.status?.sources || {};
  for (const id of info.srcs) {
    const s = st[id];
    if (s && !s.ok) html += `<div class="srcfail" data-fail="${esc(id)}">${icon('alert')}<span>${esc(t('src.failing', { name: s.name, checked: clock(s.checkedAt), last: s.lastOk ? `${dayKey(s.lastOk) === todayKey() ? '' : dayLabel(s.lastOk) + ' '}${clock(s.lastOk)}` : t('src.never') }))}</span></div>`;
  }
  if (info.phoneErr) html += `<div class="srcfail" data-fail="phone">${icon('alert')}<span>${esc(t('src.failing', { name: info.phoneName, checked: clock(info.phoneErr), last: info.iso ? clock(info.iso) : t('src.never') }))}</span></div>`;
  return `<div data-slot="fresh-${section}">${html}</div>`;
}

// ---------- tarjetas ----------
function storyRow(s, { open = false } = {}) {
  const re = kwRe();
  const kw = matchesKeyword(s, re);
  const saved = store.isSaved(s.id);
  const read = store.isRead(s.id);
  const isOpen = open || S.open.has(s.id);
  const lvl = s.level ? `<span class="lvl ${s.level}">${esc(t('imp.' + s.level))}</span>` : '';
  const chips = (s.assets || []).slice(0, 3).map((a) => `<span class="ac">${esc(assetLabel(a))}</span>`).join('');
  const plus = s.n > 1 ? ` ${t(s.n === 2 ? 'sources.plus1' : 'sources.plus', { n: s.n - 1 })}` : '';
  const rep = s.repeat ? `<span class="badge-rep">${icon('repeat')}${esc(t('repeat'))}</span>` : '';
  return `<article class="it${s.level ? ' lvl-' + s.level : ''}${read ? ' read' : ''}${kw ? ' kw' : ''}${isOpen ? ' open' : ''}" data-id="${esc(s.id)}">
<div class="it-body"><div class="it-meta">${lvl}${chips}<span class="src">${esc(s.source)}${esc(plus)}</span>${rep}<time datetime="${esc(s.time)}">${esc(when(s.time))}</time></div>
<a class="it-main" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" lang="${esc(s.lang || 'en')}"><h3>${highlight(s.title, re)}</h3>${s.summary ? `<p class="it-sum">${highlight(s.summary, re)}</p>` : ''}</a>
${isOpen ? storyMore(s) : ''}</div>
<div class="it-act"><button type="button" class="ib act-save${saved ? ' on' : ''}" aria-pressed="${saved}" aria-label="${esc(t(saved ? 'unsave' : 'save'))}">${icon('star')}</button><button type="button" class="ib act-open" aria-expanded="${isOpen}" aria-label="${esc(t(isOpen ? 'collapse' : 'expand'))}">${icon(isOpen ? 'chevUp' : 'chevDown')}</button></div>
</article>`;
}

function storyMore(s) {
  const parts = [];
  const rule = (s.rules || [])[0];
  if (rule) parts.push(`<div class="why">${icon('info')}<span><b>${esc(t('why.title'))}:</b> ${esc(t('why.' + rule))}</span></div>`);
  for (const b of s.boosts || []) {
    const txt = b === 'calendar' && s.event ? t('boost.calendar', { e: `${s.event.country} ${s.event.title} ${clock(s.event.time)}` }) : b === 'sources' ? t('boost.sources', { n: s.n }) : b === 'reaction' ? t('boost.reaction') : '';
    if (txt) parts.push(`<div class="why">${icon('zap')}<span>${esc(txt)}</span></div>`);
  }
  if (s.reaction) {
    const r = s.reaction;
    const line = esc(t('reaction', { asset: '\u0001', pct: '\u0002' })).replace('\u0001', `<b>${esc(r.label)}</b>`).replace('\u0002', pct(r.pct));
    parts.push(`<div class="react" data-reaction>${line}<small>${esc(t('reaction.src', { from: when(r.from), to: when(r.to) }))}</small></div>`);
  }
  if (s.repeat) parts.push(`<div class="why">${icon('repeat')}<span>${esc(t('repeat.d'))}</span></div>`);
  if (s.others?.length) parts.push(`<div><small class="dim">${esc(t('also'))}</small><div class="others">${s.others.map((o) => `<a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer"${o.lang ? ` lang="${esc(o.lang)}" data-lang-alt` : ''}>${esc(o.source)} ${icon('external')}</a>`).join('')}</div></div>`);
  const read = store.isRead(s.id);
  parts.push(`<div class="row"><button type="button" class="btn act-read${read ? ' on' : ''}" aria-pressed="${read}">${icon('check')}<span>${esc(t(read ? 'unread' : 'read'))}</span></button>${s.level ? `<span class="note dim">${esc(t('impact.note'))}</span>` : ''}</div>`);
  return `<div class="it-more">${parts.join('')}</div>`;
}

function newsListHtml(listId, items, emptyKey = 'empty.news') {
  const L = (lists[listId] ||= { ids: new Set(), pending: [], limit: PAGE });
  L.ids = new Set(items.map((i) => i.id));
  L.pending = [];
  if (!items.length) return `<p class="empty">${esc(t(listId === 'saved' ? 'empty.saved' : emptyKey))}</p>`;
  const shown = items.slice(0, L.limit);
  return `<div class="news" data-list="${listId}">${shown.map((s) => storyRow(s)).join('')}</div>${
    items.length > shown.length ? `<button type="button" class="more" data-more="${listId}">${esc(t('more'))} (${items.length - shown.length})</button>` : ''
  }`;
}

function listItems(listId) {
  switch (listId) {
    case 'live': return ranked(S.liveFilter === 'all' ? stories() : byTag(S.liveFilter));
    case 'memes': return ranked(byTag('meme'));
    case 'crypto': return ranked(byTag('crypto'));
    case 'forex': return ranked(byTag('forex'));
    case 'stocks': return ranked(byTag('stocks'));
    case 'saved': return store.savedList();
    default: return [];
  }
}

function chips(group, options, current) {
  const sel = (v) => (Array.isArray(current) ? current.includes(v) : v === current);
  return `<div class="chips" role="group" data-group="${group}">${options
    .map(([v, label, ic]) => `<button type="button" class="chip${sel(v) ? ' sel' : ''}" data-chip="${group}" data-v="${esc(v)}" aria-pressed="${sel(v)}">${ic ? icon(ic) : ''}${esc(label)}</button>`)
    .join('')}</div>`;
}
const seg = (group, options, current) => chips(group, options, current).replace('class="chips"', 'class="seg"');
const sh = (key, extra = '') => `<div class="sh"><h3>${esc(t(key))}</h3><span class="grow"></span>${extra}</div>`;

// Fila de cotización (acción, par, índice). Siempre con fuente y hora en el detalle; aquí, «con retraso».
function quoteRow(sym, { label, sub } = {}) {
  const q = anyQuote(sym);
  const u = universeEntry(sym);
  const vals = seriesValues(S.snapshots?.series?.[sym]);
  return `<button type="button" class="qr" data-open="${esc(sym)}"><span class="nm"><b>${esc(label || u?.sym || q?.label || sym)}</b><small>${esc(sub ?? u?.name ?? q?.name ?? '')}</small></span>
<span class="px">${q ? (u ? num(q.last, 2) : quoteNum(q.last)) + (q.unit || '') : '—'}</span><span class="ch">${q ? pct(q.changePct) : ''}</span><span class="sp">${sparkline(vals)}</span></button>`;
}
const qHead = (first) => `<div class="qr head"><span>${esc(first)}</span><span class="px">${esc(t('col.last'))}</span><span class="ch">${esc(t('col.chg'))}</span><span class="sp">${esc(t('col.5d'))}</span></div>`;

// ---------- vistas ----------
function nextHigh() {
  const now = Date.now();
  return (S.calendar?.events || []).find((e) => e.impact === 'high' && new Date(e.time).getTime() > now) || null;
}
function nextEventHtml() {
  if (!S.calendar) return '';
  const e = nextHigh();
  if (!e) return `<div class="infoline">${icon('info')}<span>${esc(t('cal.none'))}</span></div>`;
  return `<div class="next"><small>${esc(t('cal.next'))}</small><div class="next-r"><span class="imp high">${esc(e.country)}</span><b>${esc(e.title)}</b></div>
<div class="next-r mono"><span class="cd" data-cd="${esc(e.time)}">${esc(t('cal.in', { t: duration(new Date(e.time) - Date.now()) }))}</span><span class="dim">${esc(dayLabel(e.time))} · ${clock(e.time)}</span></div></div>`;
}

function top3Html() {
  const top = pickTop3(stories(), rankCtx());
  if (!top.length) return '';
  return `<div class="top3">${top
    .map((s, i) => `<a class="t3" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" data-t3="${esc(s.id)}"><span class="rank">${i + 1}</span><div><div class="it-meta"><span class="lvl ${s.level}">${esc(t('imp.' + s.level))}</span>${(s.assets || []).slice(0, 3).map((a) => `<span class="ac">${esc(assetLabel(a))}</span>`).join('')}<span class="src">${esc(s.source)}${s.n > 1 ? ' ' + esc(t(s.n === 2 ? 'sources.plus1' : 'sources.plus', { n: s.n - 1 })) : ''}</span><time>${esc(when(s.time))}</time></div><h4 lang="${esc(s.lang || 'en')}">${esc(s.title)}</h4></div></a>`)
    .join('')}</div>`;
}

function moversHtml() {
  const rows = store.state.watchlist.map((sym) => anyQuote(sym)).filter((q) => q && Number.isFinite(q.changePct));
  if (!rows.length) return `<p class="note dim">${esc(store.state.watchlist.length ? t('updated.never') : t('watch.empty'))}</p>`;
  rows.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  return `<div class="movers">${rows.map((q) => `<button type="button" class="mv" data-open="${esc(q.sym)}"><b>${esc(q.sym)}</b><span>${quoteNum(q.last)}</span>${pct(q.changePct)}</button>`).join('')}</div>`;
}

const views = {
  live() {
    const mapOn = P.map;
    return `${freshHtml('news')}
<div class="sec">${sh('top3', `<span class="upd">${esc(t('impact.note'))}</span>`)}<div data-slot="top3">${top3Html()}</div></div>
<div class="sec">${sh('cal.next')}<div data-slot="next">${nextEventHtml()}</div></div>
<div class="sec">${sh('movers', `<span class="delay">CNBC · ${esc(t('delayed'))}</span>`)}<div data-slot="movers">${moversHtml()}</div></div>
<div class="sec">${sh('feed')}<div class="tools">${seg('sort', [['top', t('sort.top')], ['latest', t('sort.latest')]], P.sort)}${seg('mapv', [['list', t('view.list'), 'list'], ['map', t('view.map'), 'map']], mapOn ? 'map' : 'list')}</div>
${chips('live', [['all', t('m.all')], ['meme', t('m.meme')], ['crypto', t('m.crypto')], ['forex', t('m.forex')], ['stocks', t('m.stocks')]], S.liveFilter)}
<div data-slot="live">${mapOn ? mapShellHtml() : newsListHtml('live', listItems('live'), S.liveFilter === 'all' ? 'empty.news' : 'empty.filter')}</div></div>`;
  },
  markets() {
    const body = marketsBody();
    return `${seg('mseg', [['stocks', t('seg.stocks')], ['crypto', t('seg.crypto')], ['forex', t('seg.forex')]], S.mseg)}<div data-slot="mbody">${body}</div>`;
  },
  memes() {
    const chainOpts = CHAINS.map((c) => [c.id, c.id === 'all' ? t('meme.all') : c.label]);
    const viewOpts = [['volume', t('meme.volume')], ['gainers', t('meme.gainers')], ['new', t('meme.new')], ['promoted', t('meme.promoted')]];
    return `${freshHtml('memes')}${chips('mview', viewOpts, S.memeView)}${chips('chain', chainOpts, S.memeChain)}
${S.memeView === 'new' ? `<div class="banner">${icon('alert')}<span>${esc(t('meme.newwarn'))}</span></div>` : `<div class="filters" data-slot="mfilters"><label>${esc(t('meme.minliq'))}<input type="number" inputmode="numeric" min="0" step="1000" data-mf="minLiquidity" value="${esc(P.minLiquidity)}"></label><label>${esc(t('meme.minage'))}<input type="number" inputmode="decimal" min="0" step="1" data-mf="minAgeHours" value="${esc(P.minAgeHours)}"></label></div>`}
<p class="note dim">${esc(t('meme.disclaimer'))}</p>${S.memeView === 'promoted' ? `<p class="note dim promo-note">${esc(t('meme.promo.note'))}</p>` : ''}
<div data-slot="coins">${coinsHtml(S.memes[`${S.memeChain}.${S.memeView}`] || lastMemes(S.memeChain, S.memeView))}</div>
<div class="sec">${sh('meme.news')}<div data-slot="memes">${newsListHtml('memes', listItems('memes'))}</div></div>`;
  },
  calendar() {
    return `${freshHtml('calendar')}<div class="sec"><div data-slot="next">${nextEventHtml()}</div></div>
${chips('calimp', [['high', t('cal.high')], ['medium', t('cal.medium')], ['low', t('cal.low')]], P.cal)}
<div data-slot="cal">${calendarHtml()}</div>`;
  },
  more() {
    if (S.more === 'menu') {
      const items = [['saved', 'bookmark'], ['posts', 'at'], ['settings', 'settings'], ['sources', 'signal']];
      return `<div class="menu">${items
        .map(([k, ic]) => `<button type="button" class="mi" data-chip="more" data-v="${k}">${icon(ic)}<span><b>${esc(t('more.' + k))}</b><small>${esc(t('more.' + k + '.d'))}</small></span>${icon('chevRight')}</button>`)
        .join('')}</div>`;
    }
    const body = S.more === 'saved' ? `<div data-slot="saved">${newsListHtml('saved', listItems('saved'))}</div>` : S.more === 'posts' ? postsHtml() : S.more === 'settings' ? settingsHtml() : sourcesHtml();
    return `<div class="backbar"><button type="button" class="ib" data-back aria-label="${esc(t('back'))}">${icon('chevLeft')}</button><h2>${esc(t('more.' + S.more))}</h2></div>${body}`;
  },
};

const marketsBody = () => (S.mseg === 'crypto' ? cryptoHtml() : S.mseg === 'forex' ? forexHtml() : stocksHtml());

function stocksHtml() {
  const q = quotes();
  const idx = INDEX_SYMBOLS.filter((i) => !['.DXY', 'MXN='].includes(i.sym));
  const { gainers, losers } = gainersLosers(q);
  const secs = sectorMoves(q);
  const n = UNIVERSE.filter((u) => u.kind !== 'sector').length;
  return `${freshHtml('stocks')}
<div class="sec"><div class="searchrow"><input id="stock-q" type="search" autocomplete="off" enterkeyhint="search" placeholder="${esc(t('stock.q'))}" value="${esc(S.stockQ)}" aria-label="${esc(t('stock.q'))}"></div><div data-slot="stock-results">${stockResultsHtml()}</div></div>
<div class="sec">${sh('indices', `<span class="delay">CNBC · ${esc(t('delayed'))}</span>`)}<div class="tiles">${idx
    .map((i) => {
      const x = indexQuote(i.sym);
      return `<button type="button" class="tile" data-open="${esc(i.sym)}"><small>${esc(i.label)}</small><b>${x ? quoteNum(x.last) : '—'}</b>${x ? pct(x.changePct) : ''}</button>`;
    })
    .join('')}</div></div>
<div class="sec">${sh('watchlist')}<div class="panel" data-slot="watch">${watchTableHtml()}</div></div>
<div class="sec two"><div>${sh('gainers')}<div class="panel">${gainers.length ? gainers.map((x) => quoteRow(x.sym)).join('') : `<p class="note dim">${esc(t('updated.never'))}</p>`}</div></div>
<div>${sh('losers')}<div class="panel">${losers.length ? losers.map((x) => quoteRow(x.sym)).join('') : `<p class="note dim">${esc(t('updated.never'))}</p>`}</div></div></div>
${secs.length ? `<div class="sec">${sh('sectors')}<div class="sectors">${secs.map((s) => `<button type="button" class="sector" data-open="${esc(s.sym)}"><span>${esc(t('sector.' + s.sector))}</span>${pct(s.changePct)}</button>`).join('')}</div></div>` : ''}
<p class="note dim">${esc(t('universe.n', { n }))} · ${esc(t('universe.mx'))}</p>
<div class="sec">${sh('news')}<div data-slot="stocks">${newsListHtml('stocks', listItems('stocks'))}</div></div>`;
}

function watchTableHtml() {
  const wl = store.state.watchlist;
  if (!wl.length) return `<p class="empty">${esc(t('watch.empty'))}</p>`;
  return qHead(t('watchlist')) + wl.map((s) => quoteRow(s)).join('');
}

function stockResultsHtml() {
  const q = S.stockQ.trim();
  if (!q) return '';
  const hits = searchUniverse(q);
  if (!hits.length) return `<p class="empty" data-untracked>${esc(t('stock.none', { q }))}</p>`;
  return `<div class="panel">${hits.map((u) => quoteRow(u.sym)).join('')}</div>`;
}

function cryptoHtml() {
  const g = S.crypto?.global;
  const f = S.crypto?.fng;
  const tiles = [];
  if (g) {
    tiles.push(`<div class="tile"><small>${esc(t('crypto.mcap'))}</small><b>${usdCompact(g.mcap)}</b>${g.mcapChange24 != null ? pct(g.mcapChange24) : ''}<span class="src">${esc(t('src.time', { src: g.source, time: when(g.updatedAt || g.checkedAt) }))}</span></div>`);
    if (g.btcDominance != null) tiles.push(`<div class="tile"><small>${esc(t('crypto.dom'))}</small><b>${num(g.btcDominance, 1)}%</b><span class="src">${esc(t('src.time', { src: g.source, time: when(g.updatedAt || g.checkedAt) }))}</span></div>`);
  }
  if (f) tiles.push(`<div class="tile"><small>${esc(t('crypto.fng'))}</small><b>${f.value}</b><span class="dim">${esc(f.label)}</span><span class="src">${esc(t('src.time', { src: f.source, time: when(f.time || f.checkedAt) }))}</span></div>`);
  return `${freshHtml('crypto')}${tiles.length ? `<div class="sec"><div class="tiles">${tiles.join('')}</div></div>` : ''}
<div class="sec">${sh('prices', `<span class="delay">CoinGecko</span>`)}<div class="panel" data-slot="prices">${pricesHtml()}</div><p class="note dim">${esc(t('crypto.hidden'))}</p></div>
<div class="sec">${sh('news')}<div data-slot="crypto">${newsListHtml('crypto', listItems('crypto'))}</div></div>`;
}

function pricesHtml() {
  const cs = visibleCoins(S.coins?.coins);
  if (!cs.length) return `<p class="empty">${esc(t('meme.loading'))}</p>`;
  return `<div class="qr head"><span>${esc(t('col.coin'))}</span><span class="px">${esc(t('col.last'))}</span><span class="ch">24h</span><span class="sp">7d</span></div>${cs
    .slice(0, 20)
    .map((c) => `<button type="button" class="qr coinrow" data-open="C:${esc(c.symbol)}"><span class="nm"><b>${esc(c.symbol)}</b><small>${esc(c.name)}</small></span><span class="px">${c.price >= 1 ? '$' + num(c.price, c.price >= 1000 ? 0 : 2) : price(c.price)}</span><span class="ch">${pct(c.change24)}</span><span class="sp">${sparkline(c.spark)}</span></button>`)
    .join('')}`;
}

function forexHtml() {
  const e = nextHigh();
  const info = !S.calendar ? '' : e ? `<div class="infoline">${icon('info')}<span>${esc(t('fx.next', { e: `${e.country} ${e.title}`, t: t('cal.in', { t: duration(new Date(e.time) - Date.now()) }) }))}</span></div>` : `<div class="infoline">${icon('info')}<span>${esc(t('fx.nohigh'))}</span></div>`;
  return `${freshHtml('forex')}${info}
<div class="sec">${sh('fx.pairs', `<span class="delay">CNBC · ${esc(t('delayed'))}</span>`)}<div class="panel" data-slot="pairs">${qHead(t('col.pair'))}${FX_PAIRS.filter((p) => anyQuote(p.sym)).map((p) => quoteRow(p.sym, { label: p.label, sub: '' })).join('')}</div></div>
<div class="sec">${sh('fx.macro')}<div class="panel">${qHead('')}${MACRO.filter((m) => anyQuote(m.sym)).map((m) => quoteRow(m.sym, { label: m.asset && ASSET_LABELS[m.asset] ? assetLabel(m.asset) : m.label, sub: anyQuote(m.sym)?.name || '' })).join('')}</div></div>
<div class="sec">${sh('news')}<div data-slot="forex">${newsListHtml('forex', listItems('forex'))}</div></div>`;
}

function coinsHtml(data) {
  if (!data) return `<p class="empty">${esc(t('meme.loading'))}</p>`;
  if (data.error && !data.coins?.length) return `<p class="empty">${esc(t('meme.error'))}</p>`;
  const { shown, hidden } = memeFilter(data.coins, S.memeView, P);
  if (!shown.length) return `<p class="empty">${esc(t(data.coins.length ? 'meme.empty' : 'meme.error'))}</p>`;
  const now = Date.now();
  const rest = shown.length - S.coinLimit;
  return `${hidden ? `<p class="note dim" data-hidden="${hidden}">${esc(t('meme.hidden', { n: hidden }))}</p>` : ''}<div class="coins">${shown
    .slice(0, S.coinLimit)
    .map((c) => {
      const hours = c.createdAt ? (now - new Date(c.createdAt).getTime()) / 3600e3 : null;
      const warns = [];
      if (c.liquidity != null && c.liquidity < MEME_LIMITS.lowLiquidityUsd) warns.push(`<span class="warn">${icon('alert')}${esc(t('meme.lowliq'))}</span>`);
      if (hours != null && hours < MEME_LIMITS.youngHours) warns.push(`<span class="warn">${icon('clock')}${esc(t('meme.young', { h: age(c.createdAt, now) }))}</span>`);
      return `<div class="coin${c.promoted ? ' promo' : ''}" data-key="${esc(c.key)}">
<div class="coin-h"><b class="sym">${esc(c.symbol)}</b><span class="cname">${esc(c.name)}</span>${c.promoted ? `<span class="badge-promo">${esc(t('meme.promo'))}</span>` : ''}</div><div class="coin-p">${price(c.priceUsd)} ${pct(c.change24)}</div>
<div class="coin-g"><span><small>${esc(t('meme.vol'))}</small>${usdCompact(c.volume24)}</span><span><small>${esc(t('meme.liq'))}</small>${usdCompact(c.liquidity)}</span><span><small>${esc(t('meme.age'))}</small>${age(c.createdAt, now)}</span><span class="chain">${esc(c.chain)}</span>${warns.join('')}</div>
<div class="coin-b"><a class="btn" href="${esc(c.dexUrl)}" target="_blank" rel="noopener noreferrer">${esc(t('meme.dex'))} ${icon('external')}</a>${c.riskUrl ? `<a class="btn" href="${esc(c.riskUrl)}" target="_blank" rel="noopener noreferrer">${icon('shield')}${esc(t('meme.risk'))}</a>` : ''}</div></div>`;
    })
    .join('')}</div>${rest > 0 ? `<button type="button" class="more" data-more-coins>${esc(t('more'))} (${rest})</button>` : ''}`;
}

function calendarHtml() {
  const evs = S.calendar?.events || [];
  if (!evs.length) return `<p class="empty">${esc(t('updated.never'))}</p>`;
  const now = Date.now();
  const today = todayKey();
  const want = new Set(P.cal);
  const byImpact = evs.filter((e) => want.has(e.impact) || e.impact === 'holiday');
  const shown = S.showPast ? byImpact : byImpact.filter((e) => dayKey(e.time) >= today);
  let html = `<p class="note mono dim">${esc(t('calendar'))} · Forex Factory · ${esc(t('cal.tz', { tz: tzName() }))}</p>`;
  if (!shown.length) html += `<p class="empty">${esc(t('cal.empty'))}</p>`;
  let day = '';
  for (const e of shown) {
    const k = dayKey(e.time);
    if (k !== day) {
      day = k;
      html += `<h4 class="day${k === today ? ' today' : ''}">${k === today ? esc(t('cal.today')) + ' · ' : ''}${esc(dayLabel(e.time))}</h4>`;
    }
    const past = new Date(e.time).getTime() < now;
    const extra = [e.actual && `${t('cal.a')} <b>${esc(e.actual)}</b>`, e.forecast && `${esc(t('cal.f'))} ${esc(e.forecast)}`, e.previous && `${esc(t('cal.p'))} ${esc(e.previous)}`].filter(Boolean).join(' · ');
    html += `<div class="ev ${e.impact}${past ? ' past' : ''}"><span class="mono tm">${clock(e.time)}</span><span class="imp ${e.impact}" title="${esc(t('cal.' + e.impact))}">${esc(e.country)}</span><div class="ev-t"><span>${esc(e.title)}</span>${extra ? `<small class="mono">${extra}</small>` : ''}</div></div>`;
  }
  if (!S.showPast && shown.length < byImpact.length) html += `<button type="button" class="more" data-past>${esc(t('cal.past'))} (${byImpact.length - shown.length})</button>`;
  return html;
}

function postsHtml() {
  const ls = store.state.lists;
  const guide = `<div class="guide"><h3>${esc(t('tw.guide'))}</h3><ol><li>${esc(t('tw.g1'))}</li><li>${esc(t('tw.g2'))}</li><li>${esc(t('tw.g3'))}</li></ol>${ls.length ? '' : `<div class="row"><button type="button" class="btn primary" data-chip="more" data-v="settings">${icon('settings')}${esc(t('more.settings'))}</button></div>`}</div>`;
  const listsHtml = ls.length
    ? `<div class="xlists">${ls
        .map(
          (l, i) => `<div class="xl" data-i="${i}"><div class="xl-h"><b>${esc(l.name)}</b><span class="mono dim">${esc(l.url.replace(/^https?:\/\/(www\.)?/, ''))}</span></div>
<div class="xl-b"><a class="btn primary" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(t('tw.open'))} ${icon('external')}</a><button type="button" class="btn" data-embed="${i}">${esc(t('tw.embed'))}</button></div><div class="xl-embed" data-embed-slot="${i}"></div></div>`
        )
        .join('')}</div><p class="note dim">${esc(t('tw.embed.note'))}</p>`
    : `<p class="empty">${esc(t('tw.none'))}</p>`;
  const cash = store.state.watchlist.length
    ? `<div class="sec">${sh('tw.cash')}<p class="note dim">${esc(t('tw.cash.d'))}</p><div class="cash">${store.state.watchlist
        .map((s) => `<a class="btn" href="https://x.com/search?q=${encodeURIComponent('$' + s.replace('.', ''))}&amp;f=live" target="_blank" rel="noopener noreferrer">$${esc(s)} ${icon('external')}</a>`)
        .join('')}</div></div>`
    : '';
  return `<p class="note">${esc(t('tw.intro', { name: APP.name }))}</p>${ls.length ? '' : guide}${listsHtml}${cash}${ls.length ? guide : ''}`;
}

function settingsHtml() {
  const st = store.state;
  return `
<section class="set"><h3>${esc(t('set.lang'))}</h3>${chips('lang', [['en', 'English'], ['es', 'Español']], getLang())}</section>
<section class="set"><h3>${esc(t('set.watch'))}</h3><p class="note">${esc(t('set.watch.help'))}</p>
<form class="row" data-form="watch"><input name="sym" type="text" autocomplete="off" autocapitalize="characters" placeholder="${esc(t('set.watch.ph'))}" maxlength="12"><button class="btn primary" type="submit">${esc(t('add'))}</button></form><p class="err" data-watch-err hidden></p>
<div class="kws">${st.watchlist.map((k, i) => `<span class="kwchip"><span>${esc(k)}</span><button type="button" class="ib" data-rm-watch="${i}" aria-label="${esc(t('remove'))} ${esc(k)}">${icon('x')}</button></span>`).join('')}</div></section>
<section class="set"><h3>${esc(t('set.kw'))}</h3><p class="note">${esc(t('set.kw.help'))}</p>
<form class="row" data-form="kw"><input name="kw" type="text" autocomplete="off" placeholder="${esc(t('set.kw.ph'))}" maxlength="40"><button class="btn primary" type="submit">${esc(t('add'))}</button></form>
<div class="kws">${st.keywords.map((k, i) => `<span class="kwchip"><span>${esc(k)}</span><button type="button" class="ib" data-rm-kw="${i}" aria-label="${esc(t('remove'))} ${esc(k)}">${icon('x')}</button></span>`).join('')}</div></section>
<section class="set"><h3>${esc(t('set.lists'))}</h3><p class="note">${esc(t('set.lists.help'))}</p>
<form class="col" data-form="list"><input name="name" type="text" autocomplete="off" placeholder="${esc(t('set.lists.name'))}" maxlength="40" required><input name="url" type="url" autocomplete="off" inputmode="url" placeholder="https://x.com/i/lists/…" required><button class="btn primary" type="submit">${esc(t('add'))}</button><p class="err" hidden></p></form>
<div class="lists">${st.lists.map((l, i) => `<div class="lrow"><div><b>${esc(l.name)}</b><span class="mono dim">${esc(l.url)}</span></div><button type="button" class="ib" data-rm-list="${i}" aria-label="${esc(t('remove'))} ${esc(l.name)}">${icon('x')}</button></div>`).join('')}</div></section>
<section class="set"><h3>${esc(t('set.data'))}</h3><p class="note">${esc(t('set.data.help'))}</p>
<div class="row"><button type="button" class="btn" data-export>${icon('download')}${esc(t('set.export'))}</button><button type="button" class="btn" data-import>${icon('upload')}${esc(t('set.import'))}</button><button type="button" class="btn" data-clearread>${icon('trash')}${esc(t('set.clearread'))}</button></div></section>
<section class="set"><h3>${esc(t('set.about'))}</h3><p class="note">${esc(t('set.about.text', { name: APP.name }))}</p></section>`;
}

function sourcesHtml() {
  const srcs = Object.entries(S.status?.sources || {});
  const row = (id, name, ok, detail) => `<div class="src-r" data-src="${esc(id)}"><span class="dot${ok ? '' : ' bad'}"></span><div><b>${esc(name)}</b><small>${esc(detail)}</small></div><span class="${ok ? 'up' : 'down'} mono">${esc(t(ok ? 'src.ok' : 'src.fail'))}</span></div>`;
  const lastOk = (iso) => (iso ? t('src.last', { t: `${dayKey(iso) === todayKey() ? '' : dayLabel(iso) + ' '}${clock(iso)}` }) : t('src.last', { t: t('src.never') }));
  const action = srcs.map(([id, s]) => row(id, s.name + (s.name === 'CNBC' && id !== 'cnbc-universe' && id !== 'cnbc-quotes' ? '' : ''), s.ok, [id, s.ok ? t('src.items', { n: s.count }) : s.error, lastOk(s.lastOk)].filter(Boolean).join(' · '))).join('');
  const memeAny = Object.values(S.memes).find((d) => d?.fetchedAt);
  const phone = [
    row('coingecko-markets', 'CoinGecko', !S.coinsErr && !!S.coins, lastOk(S.coins?.fetchedAt)),
    row('geckoterminal', 'GeckoTerminal / DEX Screener', !S.memeErr && !!memeAny, lastOk(memeAny?.fetchedAt)),
  ].join('');
  return `${freshHtml('news')}<p class="note">${esc(t('src.intro'))}</p>
<section class="set"><h3>${esc(t('set.sources'))}</h3><div class="srcs mono">${action || `<p class="note dim">${esc(t('updated.never'))}</p>`}</div></section>
<section class="set"><h3>${esc(t('src.phone'))}</h3><div class="srcs mono">${phone}</div></section>`;
}

// ---------- panel derecho ----------
function sideHtml() {
  const snap = [['.SPX', 'S&P 500'], ['.IXIC', 'Nasdaq'], ['.DJI', 'Dow'], ['.DXY', 'DXY'], ['US10Y', 'US 10Y'], ['@GC.1', assetLabel('XAU')], ['@CL.1', 'WTI'], ['MXN=', 'USD/MXN']];
  const coins = (S.coins?.coins || []).filter((c) => ['BTC', 'ETH', 'SOL'].includes(c.symbol));
  return `<div class="side-sec">${sh('watchlist')}<div data-slot="side-watch">${watchTableHtml()}</div></div>
<div class="side-sec">${sh('cal.next')}<div data-slot="side-next">${nextEventHtml()}</div></div>
<div class="side-sec">${sh('snapshot', `<span class="delay">CNBC · ${esc(t('delayed'))}</span>`)}${snap.filter(([s]) => anyQuote(s)).map(([s, l]) => quoteRow(s, { label: l, sub: '' })).join('')}
${coins.map((c) => `<button type="button" class="qr" data-open="C:${esc(c.symbol)}"><span class="nm"><b>${esc(c.symbol)}</b><small>CoinGecko</small></span><span class="px">$${num(c.price, c.price >= 1000 ? 0 : 2)}</span><span class="ch">${pct(c.change24)}</span><span class="sp">${sparkline(c.spark)}</span></button>`).join('')}</div>`;
}
let sideQueued = false;
// Panel derecho: se pinta en un rato libre; al abrirlo con el botón, en el acto (para no verlo vacío).
function renderSide(now = false) {
  const run = () => {
    sideQueued = false;
    const el = $('#side');
    if (getComputedStyle(el).display === 'none') return void (el.dataset.pending = '1');
    el.innerHTML = sideHtml();
    delete el.dataset.pending;
  };
  if (now) return run();
  if (sideQueued) return;
  sideQueued = true;
  (window.requestIdleCallback || ((f) => setTimeout(f, 30)))(run);
}

// ---------- barra de precios ----------
function tickerItems() {
  const parts = [];
  const cs = S.coins?.coins || [];
  for (const sym of ['BTC', 'ETH', 'SOL']) {
    const c = cs.find((x) => x.symbol === sym);
    parts.push(`<button type="button" class="tk" role="listitem" data-open="C:${sym}"><span class="tk-l">${sym}</span><span>${c ? '$' + num(c.price, c.price >= 1000 ? 0 : 2) : '—'}</span>${c ? pct(c.change24) : ''}</button>`);
  }
  for (const q of S.indices?.quotes || []) {
    parts.push(`<button type="button" class="tk" role="listitem" data-open="${esc(q.sym)}"><span class="tk-l">${esc(q.label)}</span><span>${num(q.last, q.last < 100 ? 3 : 2)}</span>${pct(q.changePct)}<small class="delay">${esc(t('delayed'))}</small></button>`);
  }
  for (const [sym, label] of [['EUR=', 'EUR/USD'], ['JPY=', 'USD/JPY'], ['@GC.1', assetLabel('XAU')], ['US10Y', 'US 10Y']]) {
    const q = quotes()[sym];
    if (q) parts.push(`<button type="button" class="tk" role="listitem" data-open="${esc(sym)}"><span class="tk-l">${esc(label)}</span><span>${quoteNum(q.last)}${q.unit || ''}</span>${pct(q.changePct)}</button>`);
  }
  return parts;
}
function renderTicker() {
  const parts = tickerItems();
  const dup = parts.map((p) => p.replace('<button ', '<button tabindex="-1" aria-hidden="true" ')).join('');
  $('#ticker').innerHTML = `<div class="tk-track" style="--tk-dur:${Math.max(30, parts.length * 4)}s">${parts.join('')}${dup}</div>`;
}

// ---------- render ----------
const viewEl = (v) => document.getElementById('v-' + v);
function render(v) {
  if (v === 'live' && liveMap) {
    liveMap.destroy();
    liveMap = null;
  }
  viewEl(v).innerHTML = views[v]();
  S.rendered.add(v);
  S.dirty.delete(v);
  if (v === 'live' && P.map) mountMap();
}
function markAllDirty() {
  for (const v of Object.keys(views)) if (v !== S.tab) S.dirty.add(v);
  idleRender();
}

// Las pestañas que no se ven se pintan en ratos libres (una por vez), así cambiar de pestaña solo las muestra.
let idleQueued = false;
function idleRender() {
  if (idleQueued || !window.p1?.ready) return;
  idleQueued = true;
  (window.requestIdleCallback || ((f) => setTimeout(f, 50)))(() => {
    idleQueued = false;
    const v = Object.keys(views).find((x) => x !== S.tab && (!S.rendered.has(x) || S.dirty.has(x)));
    if (!v) return;
    render(v);
    idleRender();
  }, { timeout: 200 });
}

function showTab(v) {
  if (v === S.tab && S.rendered.has(v)) {
    if (v === 'more' && S.more !== 'menu') {
      S.more = 'menu';
      render('more');
    }
    return;
  }
  S.scroll[S.tab] = window.scrollY;
  viewEl(S.tab).hidden = true;
  $(`.tabs [data-tab="${S.tab}"]`)?.setAttribute('aria-selected', 'false');
  if (S.tab === 'live') liveMap?.pause();
  S.tab = v;
  $(`.tabs [data-tab="${v}"]`).setAttribute('aria-selected', 'true');
  $('#view-title').textContent = t('title.' + v);
  if (!S.rendered.has(v) || S.dirty.has(v)) render(v);
  viewEl(v).hidden = false;
  if (v === 'live') liveMap?.resume();
  window.scrollTo(0, S.scroll[v] || 0);
  updatePill();
  if (v === 'memes') loadMemes();
}

// Noticias nuevas: no se meten en la lista visible; se cuentan y se avisa con la píldora.
const LIST_VIEW = { live: 'live', memes: 'memes', crypto: 'markets', forex: 'markets', stocks: 'markets', saved: 'more' };
function listVisible(listId) {
  if (listId === 'live') return !P.map;
  if (['stocks', 'crypto', 'forex'].includes(listId)) return S.mseg === listId;
  return listId === 'memes';
}
function absorbNews() {
  for (const listId of ['live', 'memes', 'crypto', 'forex', 'stocks']) {
    const v = LIST_VIEW[listId];
    if (!S.rendered.has(v) || !listVisible(listId)) continue;
    const L = lists[listId];
    if (!L || !L.ids.size) {
      if (S.tab === v) {
        const slot = $(`[data-slot="${listId}"]`, viewEl(v));
        if (slot) slot.innerHTML = newsListHtml(listId, listItems(listId));
      } else S.dirty.add(v);
      continue;
    }
    L.pending = listItems(listId).filter((i) => !L.ids.has(i.id));
  }
  updatePill();
}

function currentListId() {
  if (S.tab === 'live') return P.map ? null : 'live';
  if (S.tab === 'markets') return S.mseg;
  if (S.tab === 'memes') return 'memes';
  return null;
}

function updatePill() {
  const pill = $('#pill');
  const id = currentListId();
  const n = id ? lists[id]?.pending.length || 0 : 0;
  if (n > 0) {
    pill.textContent = t('new.n', { n });
    pill.dataset.kind = 'news';
    pill.hidden = false;
  } else if (S.tab === 'memes' && memePending.has) {
    pill.textContent = t('refreshed');
    pill.dataset.kind = 'memes';
    pill.hidden = false;
  } else pill.hidden = true;
}

function applyPill() {
  const pill = $('#pill');
  if (pill.dataset.kind === 'memes') {
    memePending.has = false;
    const slot = $('[data-slot="coins"]', viewEl('memes'));
    if (slot) slot.innerHTML = coinsHtml(S.memes[`${S.memeChain}.${S.memeView}`]);
    refreshUpd();
  } else {
    const id = currentListId();
    const slot = $(`[data-slot="${id}"]`, viewEl(S.tab));
    if (slot) slot.innerHTML = newsListHtml(id, listItems(id));
  }
  pill.hidden = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  updatePill();
}

// En la vista abierta se actualizan en su lugar las partes que no empujan la lista (precios, calendario, bloques de arriba).
function patchSlot(view, slot, html) {
  if (!S.rendered.has(view)) return;
  const el = $(`[data-slot="${slot}"]`, viewEl(view));
  if (S.tab !== view) {
    // Oculta: se actualiza en su lugar (no hay scroll que cuidar); si no tiene ese hueco, se repinta al abrirla.
    if (el) el.innerHTML = html;
    else S.dirty.add(view);
    return;
  }
  if (!el) return;
  const before = el.offsetHeight;
  const top = el.getBoundingClientRect().top;
  const y = window.scrollY;
  el.innerHTML = html;
  const diff = el.offsetHeight - before;
  if (diff && top < 0) window.scrollTo(0, y + diff);
}

// Mercados: si no se ve, se actualiza ya; si se ve, se repinta al volver (para no mover lo que se está leyendo).
function refreshMarkets() {
  if (!S.rendered.has('markets')) return;
  if (S.tab === 'markets') S.dirty.add('markets');
  else patchSlot('markets', 'mbody', marketsBody());
}

function refreshUpd() {
  for (const el of $$('[data-upd]')) {
    const iso = sectionInfo(el.dataset.upd).iso;
    el.textContent = iso ? t('updated', { t: ago(iso) }) : t('updated.never');
  }
  for (const el of $$('[data-cd]')) el.textContent = t('cal.in', { t: duration(new Date(el.dataset.cd) - Date.now()) });
}
function refreshFresh() {
  for (const el of $$('[data-slot^="fresh-"]')) {
    const sec = el.dataset.slot.slice(6);
    el.outerHTML = freshHtml(sec);
  }
}

// ---------- detalle (acción, par, índice, moneda, historia) ----------
function openDetail(key) {
  let title = '';
  let body = '';
  if (key.startsWith('N:')) {
    const s = findStory(key.slice(2));
    if (!s) return;
    title = s.source;
    body = `<div class="news">${storyRow(s, { open: true })}</div>`;
  } else if (key.startsWith('C:')) {
    const sym = key.slice(2);
    const c = (S.coins?.coins || []).find((x) => x.symbol === sym);
    title = c ? `${c.name} (${sym})` : sym;
    const rel = ranked(stories().filter((s) => (s.assets || []).includes(sym))).slice(0, 15);
    body = c
      ? `<div class="dt-price"><b>$${c.price >= 1 ? num(c.price, c.price >= 1000 ? 0 : 2) : String(c.price)}</b>${pct(c.change24)}<span class="dim">24h</span></div>
<p class="dt-meta">${esc(t('src.time', { src: 'CoinGecko', time: when(S.coins.fetchedAt) }))}</p>
<div class="dt-chart">${sparkline(c.spark, { w: 300, h: 96, cls: 'big' }) || `<small>${esc(t('chart.none'))}</small>`}<small>${esc(t('chart.7d'))}</small></div>
<div class="row" style="padding:0 12px"><a class="btn" href="https://www.coingecko.com/en/coins/${esc(c.id)}" target="_blank" rel="noopener noreferrer">${esc(t('link.cg'))} ${icon('external')}</a><a class="btn" href="https://www.tradingview.com/chart/?symbol=${encodeURIComponent('COINBASE:' + sym + 'USD')}" target="_blank" rel="noopener noreferrer">${esc(t('link.tv'))} ${icon('external')}</a></div>`
      : `<p class="empty">${esc(t('meme.loading'))}</p>`;
    body += `<div class="sec">${sh('news')}${rel.length ? `<div class="news">${rel.map((s) => storyRow(s)).join('')}</div>` : `<p class="note dim">${esc(t('stock.nonews', { s: sym }))}</p>`}</div>`;
  } else {
    const sym = key;
    const q = anyQuote(sym);
    const u = universeEntry(sym);
    const fx = FX_PAIRS.find((p) => p.sym === sym) || MACRO.find((m) => m.sym === sym);
    const idx = INDEX_SYMBOLS.find((i) => i.sym === sym);
    const label = u?.sym || fx?.label || idx?.label || sym;
    title = u ? `${u.name} (${u.sym})` : fx?.label || idx?.label || q?.name || sym;
    const asset = u ? u.sym : Object.entries(ASSET_SERIES).find(([, v]) => v === sym)?.[0] || fx?.asset;
    const vals = seriesValues(S.snapshots?.series?.[sym]);
    const rel = asset ? ranked(stories().filter((s) => (s.assets || []).includes(asset))).slice(0, 15) : [];
    const tv = u ? u.sym.replace('.', '.') : TV[sym] || null;
    if (!q) body = `<p class="empty">${esc(u ? t('updated.never') : t('stock.none', { q: sym }))}</p>`;
    else {
      body = `<div class="dt-price"><b>${u ? num(q.last, 2) : quoteNum(q.last)}${q.unit || ''}</b>${Number.isFinite(q.change) ? `<span class="${q.change > 0 ? 'up' : q.change < 0 ? 'down' : 'flat'}">${q.change > 0 ? '+' : ''}${u ? num(q.change, 2) : quoteNum(q.change)}</span>` : ''}${pct(q.changePct)}</div>
<p class="dt-meta">${esc(quoteSrc(q))} · ${esc(t('delayed'))} · ${esc(t('updated', { t: ago(S.markets?.generatedAt || S.indices?.generatedAt) }))}</p>
<div class="dt-chart">${vals.length >= 2 ? sparkline(vals, { w: 300, h: 96, cls: 'big' }) : `<small>${esc(t('chart.none'))}</small><br>`}<small>${esc(t('chart.5d'))}</small></div>`;
      if (q.earnings) body += `<dl class="kv"><dt>${esc(t('earnings'))}</dt><dd data-earnings>${esc(dateOnly(q.earnings.date))}${q.earnings.est ? `<span class="est" title="${esc(t('earn.est.d'))}">${esc(t('est'))}</span>` : ''}</dd></dl>${q.earnings.est ? `<p class="note dim">${esc(t('earn.est.d'))}</p>` : ''}`;
    }
    const watchBtn = u ? `<button type="button" class="btn${store.inWatchlist(u.sym) ? '' : ' primary'}" data-watch-toggle="${esc(u.sym)}">${icon(store.inWatchlist(u.sym) ? 'x' : 'plus')}${esc(t(store.inWatchlist(u.sym) ? 'watch.remove' : 'watch.add'))}</button>` : '';
    body += `<div class="row" style="padding:0 12px">${watchBtn}<a class="btn" href="https://www.cnbc.com/quotes/${encodeURIComponent(sym)}" target="_blank" rel="noopener noreferrer">${esc(t('link.cnbc'))} ${icon('external')}</a>${tv ? `<a class="btn" href="https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tv)}" target="_blank" rel="noopener noreferrer">${esc(t('link.tv'))} ${icon('external')}</a>` : ''}</div>`;
    if (asset) body += `<div class="sec">${sh('news')}${rel.length ? `<div class="news">${rel.map((s) => storyRow(s)).join('')}</div>` : `<p class="note dim">${esc(t('stock.nonews', { s: label }))}</p>`}</div>`;
  }
  $('#detail-title').textContent = title;
  $('#detail-body').innerHTML = body;
  $('#detail-body').dataset.key = key;
  openSheet('sheet-detail');
}
// Fuente y hora de una cotización de CNBC: hora exacta si la trae; si solo trae fecha (cierre), la fecha; si no, solo la fuente.
function quoteSrc(q) {
  const tm = String(q?.time || '');
  if (/T\d/.test(tm) && !Number.isNaN(Date.parse(tm))) return t('src.time', { src: 'CNBC', time: when(new Date(tm).toISOString()) });
  if (/^\d{4}-\d{2}-\d{2}$/.test(tm)) return t('src.time', { src: 'CNBC', time: dateOnly(tm) });
  return 'CNBC';
}
const TV = { 'EUR=': 'FX:EURUSD', 'GBP=': 'FX:GBPUSD', 'JPY=': 'FX:USDJPY', 'MXN=': 'FX:USDMXN', 'AUD=': 'FX:AUDUSD', 'CAD=': 'FX:USDCAD', 'CHF=': 'FX:USDCHF', 'EURJPY=': 'FX:EURJPY', 'CADJPY=': 'FX:CADJPY', '.DXY': 'TVC:DXY', US10Y: 'TVC:US10Y', '@GC.1': 'COMEX:GC1!', '@CL.1': 'NYMEX:CL1!', '.SPX': 'SP:SPX', '.IXIC': 'NASDAQ:IXIC', '.DJI': 'DJ:DJI', '.RUT': 'TVC:RUT', '.MXX': 'BMV:ME' };

// ---------- mapa en vivo ----------
function mapShellHtml() {
  return `<p class="note dim">${esc(t('map.note'))}</p><div class="map-wrap" data-map><canvas role="img" aria-label="${esc(t('map.label'))}"></canvas></div>`;
}
async function mountMap() {
  const wrap = $('[data-map]', viewEl('live'));
  if (!wrap) return;
  const { createLiveMap, mapSupported } = await import('./livemap.js');
  if (!mapSupported()) {
    wrap.outerHTML = `<div class="infoline">${icon('info')}<span>${esc(t('map.fallback'))}</span></div>${newsListHtml('live', listItems('live'))}`;
    return;
  }
  if (!wrap.isConnected) return;
  const items = listItems('live').filter((s) => s.level).slice(0, 48);
  liveMap = createLiveMap(wrap.querySelector('canvas'), items, { label: assetLabel, other: t('map.other'), onOpen: (id) => openDetail('N:' + id) });
}

// ---------- palabras clave ----------
let notified = new Set(store.cacheGet('notified') || []);
function checkKeywords(initial) {
  const re = kwRe();
  if (!re) return;
  const hits = allNews().filter((n) => !notified.has(n.id) && matchesKeyword(n, re));
  if (!hits.length) return;
  for (const h of hits) notified.add(h.id);
  store.cacheSet('notified', [...notified].slice(-2000));
  if (hits.length === 1) toast(`${t('kw.toast', { k: matchesKeyword(hits[0], re) })}: ${hits[0].title}`, matchesKeyword(hits[0], re), 'bell');
  else toast(t('kw.many', { n: hits.length }), initial ? store.state.keywords[0] : matchesKeyword(hits[0], re), 'bell');
}

let toastTimer;
function toast(text, query, ic = 'info') {
  const el = $('#toast');
  el.innerHTML = `${icon(ic)}<span>${esc(text)}</span>`;
  el.dataset.q = query || '';
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 7000);
}

// ---------- datos ----------
function setOffline(off) {
  S.offline = off;
  const el = $('#offline');
  el.hidden = !off;
  el.innerHTML = off ? `${icon('offline')}<span>${esc(t('offline'))}${S.news?.generatedAt ? ' · ' + esc(ago(S.news.generatedAt)) : ''}</span>` : '';
}

const DATA = ['news', 'stories', 'calendar', 'indices', 'status', 'markets', 'crypto'];
function applyData(name, json, { fromCache = false } = {}) {
  if (!json) return;
  if (name === 'news' || name === 'stories') {
    // Si las historias llegan después de las noticias, la lista se vuelve a pintar (antes mostraba noticias sin nivel).
    const firstFill = name === 'stories' ? !S.stories : !S.news && !S.stories;
    S[name] = json;
    if (firstFill) {
      for (const v of ['live', 'memes', 'markets', 'more']) if (S.rendered.has(v)) S.tab === v ? render(v) : S.dirty.add(v);
    } else {
      absorbNews();
      patchSlot('live', 'top3', top3Html());
    }
    if (name === 'news' && !fromCache) checkKeywords(firstFill);
  } else if (name === 'calendar') {
    S.calendar = json;
    patchSlot('calendar', 'cal', calendarHtml());
    patchSlot('calendar', 'next', nextEventHtml());
    patchSlot('live', 'next', nextEventHtml());
  } else if (name === 'indices' || name === 'markets') {
    S[name] = json;
    renderTicker();
    patchSlot('live', 'movers', moversHtml());
    refreshMarkets();
  } else if (name === 'crypto') {
    S.crypto = json;
    refreshMarkets();
  } else if (name === 'status') {
    S.status = json;
    if (!fromCache) refreshFresh();
  }
  renderSide();
  idleRender();
  refreshUpd();
}

async function loadData() {
  let failed = 0;
  await Promise.all(
    DATA.map(async (n) => {
      try {
        applyData(n, await freshData(n));
      } catch {
        failed++;
      }
    })
  );
  setOffline(failed === DATA.length || !navigator.onLine);
  refreshFresh();
}

async function loadSnapshots() {
  try {
    S.snapshots = await freshData('snapshots');
  } catch {
    S.snapshots ||= await cachedData('snapshots');
  }
  refreshMarkets();
  idleRender();
  renderSide();
}

async function loadCoins() {
  try {
    S.coins = await fetchCoins();
    S.coinsErr = null;
  } catch {
    S.coinsErr = new Date().toISOString();
    if (!S.coins) return;
  }
  renderTicker();
  if (S.mseg === 'crypto') patchSlot('markets', 'prices', pricesHtml());
  renderSide();
  refreshUpd();
  idleRender();
}

let memeBusy = false;
async function loadMemes(force) {
  const key = `${S.memeChain}.${S.memeView}`;
  const cur = S.memes[key];
  if (memeBusy || (!force && cur && Date.now() - new Date(cur.fetchedAt).getTime() < REFRESH.memes - 2000)) return;
  memeBusy = true;
  const [chain, view] = [S.memeChain, S.memeView];
  try {
    const data = await fetchMemes(chain, view);
    S.memes[`${chain}.${view}`] = data;
    S.memeErr = null;
  } catch {
    S.memeErr = new Date().toISOString();
    if (!S.memes[key]) S.memes[key] = { ...(lastMemes(chain, view) || { coins: [] }), error: true };
  } finally {
    memeBusy = false;
  }
  if (S.memeChain !== chain || S.memeView !== view || S.tab !== 'memes') return;
  const slot = $('[data-slot="coins"]', viewEl('memes'));
  if (!slot) return;
  const hadCoins = slot.querySelector('.coin');
  if (hadCoins && window.scrollY > 40) {
    memePending.has = true;
    updatePill();
  } else slot.innerHTML = coinsHtml(S.memes[key]);
  const fr = $('[data-slot="fresh-memes"]', viewEl('memes'));
  if (fr) fr.outerHTML = freshHtml('memes');
  refreshUpd();
}

// ---------- búsqueda ----------
function runSearch(q) {
  const box = $('#results');
  const s = q.trim().toLowerCase();
  if (s.length < 2) {
    box.innerHTML = '';
    return;
  }
  const has = (...xs) => xs.some((x) => String(x || '').toLowerCase().includes(s));
  const seen = new Set();
  const found = [...stories(), ...store.savedList()].filter((n) => !seen.has(n.id) && seen.add(n.id) && has(n.title, n.summary, n.source, ...(n.assets || []))).slice(0, 40);
  const coins = [];
  const ck = new Set();
  for (const d of Object.values(S.memes)) for (const c of d?.coins || []) if (!ck.has(c.key) && has(c.symbol, c.name, c.token) && ck.add(c.key)) coins.push(c);
  const tops = visibleCoins(S.coins?.coins).filter((c) => has(c.symbol, c.name));
  const uni = searchUniverse(q);
  const evs = (S.calendar?.events || []).filter((e) => has(e.title, e.country)).slice(0, 20);
  let html = '';
  if (uni.length) html += `<div class="panel">${uni.map((u) => quoteRow(u.sym)).join('')}</div>`;
  if (tops.length) html += `<div class="panel">${tops.map((c) => `<button type="button" class="qr" data-open="C:${esc(c.symbol)}"><span class="nm"><b>${esc(c.symbol)}</b><small>${esc(c.name)}</small></span><span class="px">$${num(c.price, c.price >= 1000 ? 0 : 2)}</span><span class="ch">${pct(c.change24)}</span><span class="sp">${sparkline(c.spark)}</span></button>`).join('')}</div>`;
  if (coins.length) {
    const keep = S.memeView;
    S.memeView = 'new'; // en la búsqueda no se aplican filtros
    html += coinsHtml({ coins: coins.slice(0, 20) });
    S.memeView = keep;
  }
  if (evs.length) html += evs.map((e) => `<div class="ev ${e.impact}"><span class="mono tm">${esc(dayLabel(e.time))} ${clock(e.time)}</span><span class="imp ${e.impact}">${esc(e.country)}</span><div class="ev-t"><span>${esc(e.title)}</span></div></div>`).join('');
  if (found.length) html += `<div class="news">${found.map((n) => storyRow(n)).join('')}</div>`;
  if (!html && /^\$?[A-Za-z.]{1,6}$/.test(q.trim())) html = `<p class="empty">${esc(t('stock.none', { q: q.trim().toUpperCase().replace(/^\$/, '') }))}</p>`;
  box.innerHTML = html || `<p class="empty">${esc(t('search.none'))}</p>`;
}

function openSheet(id) {
  $$('.sheet').forEach((s) => (s.hidden = s.id !== id));
  document.body.classList.add('locked');
  if (id === 'sheet-search') setTimeout(() => $('#q').focus(), 30);
}
function closeSheets() {
  $$('.sheet').forEach((s) => (s.hidden = true));
  document.body.classList.remove('locked');
}

function rerenderAll() {
  applyStaticI18n();
  S.rendered.clear();
  render(S.tab);
  markAllDirty();
  renderTicker();
  renderSide();
  if (!$('#sheet-search').hidden) runSearch($('#q').value);
  if (!$('#sheet-detail').hidden && $('#detail-body').dataset.key) openDetail($('#detail-body').dataset.key);
  updatePill();
  setOffline(S.offline);
}

function buildTabs() {
  $('#tabs').innerHTML = TABS.map(([v, ic]) => `<button type="button" role="tab" data-tab="${v}" aria-selected="${v === S.tab}">${icon(ic)}<span data-i18n="tab.${v}"></span></button>`).join('');
  $('#btn-search').innerHTML = icon('search');
  $('#btn-rail').innerHTML = icon('panel');
  for (const b of $$('[data-close]')) b.innerHTML = icon('x');
}

function applyStaticI18n() {
  for (const el of $$('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of $$('[data-i18n-label]')) el.setAttribute('aria-label', t(el.dataset.i18nLabel));
  for (const el of $$('[data-i18n-ph]')) el.setAttribute('placeholder', t(el.dataset.i18nPh));
  $('#view-title').textContent = t('title.' + S.tab);
  $('#btn-rail').setAttribute('aria-label', t(P.rail ? 'rail.hide' : 'rail.show'));
}

function exportFile() {
  const blob = new Blob([JSON.stringify(store.exportData(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `p1-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

// ---------- X embebido (solo al tocar «Ver aquí») ----------
let widgetsPromise;
function loadWidgets() {
  widgetsPromise ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://platform.twitter.com/widgets.js';
    s.async = true;
    s.onload = () => (window.twttr?.widgets ? res(window.twttr) : rej(new Error('sin widgets')));
    s.onerror = () => rej(new Error('bloqueado'));
    document.head.append(s);
  });
  return widgetsPromise;
}
async function embedList(i) {
  const l = store.state.lists[i];
  const slot = $(`[data-embed-slot="${i}"]`);
  if (!l || !slot) return;
  const fail = () => (slot.innerHTML = `<p class="note dim">${esc(t('tw.embed.fail'))}</p>`);
  slot.innerHTML = `<p class="note dim">…</p>`;
  const timer = setTimeout(() => {
    if (!slot.querySelector('iframe[style*="height"]')) fail();
  }, 9000);
  try {
    const tw = await loadWidgets();
    const a = document.createElement('a');
    a.className = 'twitter-timeline';
    a.href = l.url.replace('://x.com', '://twitter.com');
    a.dataset.theme = 'dark';
    a.dataset.height = '560';
    a.dataset.chrome = 'noheader nofooter transparent';
    slot.replaceChildren(a);
    const el = await tw.widgets.load(slot);
    if (!el) fail();
  } catch {
    clearTimeout(timer);
    fail();
  }
}

function validXUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && /^(www\.|mobile\.)?(x|twitter)\.com$/.test(url.hostname);
  } catch {
    return false;
  }
}

function syncRows(id) {
  const s = findStory(id);
  for (const r of $$(`.it[data-id="${CSS.escape(id)}"]`)) {
    const open = r.classList.contains('open');
    if (s) r.outerHTML = storyRow(s, { open });
  }
}

// ---------- eventos ----------
function onClick(e) {
  const tgt = e.target;
  const tab = tgt.closest('.tabs [data-tab]');
  if (tab) return showTab(tab.dataset.tab);
  const row = tgt.closest('.it');
  if (row) {
    const id = row.dataset.id;
    const item = findStory(id);
    if (tgt.closest('.act-save') && item) {
      store.toggleSaved(item);
      syncRows(id);
      S.dirty.add('more');
      return;
    }
    if (tgt.closest('.act-open')) {
      const open = !row.classList.contains('open');
      if (open) S.open.add(id);
      else S.open.delete(id);
      if (item) row.outerHTML = storyRow(item, { open });
      return;
    }
    if (tgt.closest('.act-read')) {
      store.setRead(id, !store.isRead(id));
      syncRows(id);
      return;
    }
    if (tgt.closest('.it-main')) {
      store.setRead(id, true);
      for (const r of $$(`.it[data-id="${CSS.escape(id)}"]`)) r.classList.add('read');
      return; // el enlace se abre normal
    }
  }
  const t3 = tgt.closest('[data-t3]');
  if (t3) store.setRead(t3.dataset.t3, true);
  const chip = tgt.closest('[data-chip]');
  if (chip) {
    const { chip: g, v } = chip.dataset;
    if (g === 'live') {
      S.liveFilter = v;
      if (lists.live) lists.live.limit = PAGE;
      render('live');
    } else if (g === 'sort') {
      store.setPref('sort', v);
      P.sort = v;
      render('live');
      markAllDirty();
    } else if (g === 'mapv') {
      store.setPref('map', v === 'map');
      P.map = v === 'map';
      render('live');
    } else if (g === 'mseg') {
      S.mseg = v;
      render('markets');
      window.scrollTo(0, 0);
    } else if (g === 'chain' || g === 'mview') {
      if (g === 'chain') S.memeChain = v;
      else {
        S.memeView = v;
        store.setPref('memeView', v);
      }
      memePending.has = false;
      S.coinLimit = COIN_PAGE;
      render('memes');
      loadMemes();
    } else if (g === 'calimp') {
      const cur = new Set(P.cal);
      cur.has(v) ? cur.delete(v) : cur.add(v);
      P.cal = ['high', 'medium', 'low'].filter((x) => cur.has(x));
      store.setPref('cal', P.cal);
      render('calendar');
    } else if (g === 'more') {
      if (S.tab !== 'more') showTab('more');
      S.more = v;
      render('more');
      window.scrollTo(0, 0);
    } else if (g === 'lang') {
      setLang(v);
      store.setLangPref(v);
      rerenderAll();
    }
    updatePill();
    return;
  }
  if (tgt.closest('[data-back]')) {
    S.more = 'menu';
    render('more');
    return;
  }
  const op = tgt.closest('[data-open]');
  if (op) {
    if (op.closest('.ticker')) $('#ticker').classList.add('hold');
    return openDetail(op.dataset.open);
  }
  const wt = tgt.closest('[data-watch-toggle]');
  if (wt) {
    const sym = wt.dataset.watchToggle;
    store.setWatchlist(store.inWatchlist(sym) ? store.state.watchlist.filter((x) => x !== sym) : [...store.state.watchlist, sym]);
    openDetail($('#detail-body').dataset.key);
    afterWatchChange();
    return;
  }
  const more = tgt.closest('[data-more]');
  if (more) {
    const id = more.dataset.more;
    lists[id].limit += PAGE;
    const slot = more.parentElement;
    const y = window.scrollY;
    slot.innerHTML = newsListHtml(id, listItems(id));
    window.scrollTo(0, y);
    return;
  }
  if (tgt.closest('[data-more-coins]')) {
    S.coinLimit += COIN_PAGE;
    const slot = $('[data-slot="coins"]', viewEl('memes'));
    const y = window.scrollY;
    slot.innerHTML = coinsHtml(S.memes[`${S.memeChain}.${S.memeView}`] || lastMemes(S.memeChain, S.memeView));
    window.scrollTo(0, y);
    return;
  }
  if (tgt.closest('[data-past]')) {
    S.showPast = true;
    render('calendar');
    return;
  }
  if (tgt.closest('#pill')) return applyPill();
  if (tgt.closest('#btn-search')) return openSheet('sheet-search');
  if (tgt.closest('#btn-rail')) {
    P.rail = !P.rail;
    store.setPref('rail', P.rail);
    $('#shell').classList.toggle('rail-closed', !P.rail);
    applyStaticI18n();
    renderSide(true);
    return;
  }
  if (tgt.closest('[data-close]')) {
    $('#ticker').classList.remove('hold');
    return closeSheets();
  }
  if (tgt.closest('#toast')) {
    const q = $('#toast').dataset.q;
    $('#toast').hidden = true;
    if (q) {
      openSheet('sheet-search');
      $('#q').value = q;
      runSearch(q);
    }
    return;
  }
  const emb = tgt.closest('[data-embed]');
  if (emb) return embedList(+emb.dataset.embed);
  const rmk = tgt.closest('[data-rm-kw]');
  if (rmk) {
    store.setKeywords(store.state.keywords.filter((_, i) => i !== +rmk.dataset.rmKw));
    rerenderAll();
    return;
  }
  const rmw = tgt.closest('[data-rm-watch]');
  if (rmw) {
    store.setWatchlist(store.state.watchlist.filter((_, i) => i !== +rmw.dataset.rmWatch));
    render('more');
    afterWatchChange();
    return;
  }
  const rml = tgt.closest('[data-rm-list]');
  if (rml) {
    store.setLists(store.state.lists.filter((_, i) => i !== +rml.dataset.rmList));
    render('more');
    return;
  }
  if (tgt.closest('[data-export]')) return exportFile();
  if (tgt.closest('[data-import]')) return $('#import-file').click();
  if (tgt.closest('[data-clearread]')) {
    store.clearRead();
    rerenderAll();
  }
}

function afterWatchChange() {
  for (const v of ['live', 'markets']) S.dirty.add(v);
  if (S.tab === 'live') patchSlot('live', 'movers', moversHtml());
  if (S.tab === 'markets' && S.mseg === 'stocks') patchSlot('markets', 'watch', watchTableHtml());
  renderSide();
}

function onSubmit(e) {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  if (f.dataset.form === 'kw') {
    const v = f.kw.value.trim();
    if (!v) return;
    store.setKeywords([...store.state.keywords, v]);
    rerenderAll();
    checkKeywords(true);
  } else if (f.dataset.form === 'watch') {
    const v = f.sym.value.trim().toUpperCase().replace(/^\$/, '');
    if (!v) return;
    if (!universeEntry(v)) {
      const err = $('[data-watch-err]');
      err.textContent = `${v}: ${t('set.watch.bad')}`;
      err.hidden = false;
      return;
    }
    store.setWatchlist([...store.state.watchlist, v]);
    render('more');
    afterWatchChange();
  } else if (f.dataset.form === 'list') {
    const name = f.name.value.trim();
    const url = f.url.value.trim();
    if (!name || !validXUrl(url)) {
      const err = f.querySelector('.err');
      err.textContent = t('set.lists.bad');
      err.hidden = false;
      return;
    }
    store.setLists([...store.state.lists, { name, url }]);
    render('more');
  }
}

function onInput(e) {
  const el = e.target;
  if (el.id === 'stock-q') {
    S.stockQ = el.value;
    const slot = $('[data-slot="stock-results"]', viewEl('markets'));
    if (slot) slot.innerHTML = stockResultsHtml();
  } else if (el.dataset.mf) {
    const v = Math.max(0, Number(el.value) || 0);
    P[el.dataset.mf] = v;
    store.setPref(el.dataset.mf, v);
    const slot = $('[data-slot="coins"]', viewEl('memes'));
    if (slot) slot.innerHTML = coinsHtml(S.memes[`${S.memeChain}.${S.memeView}`] || lastMemes(S.memeChain, S.memeView));
  }
}

async function onImport(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  let ok = false;
  try {
    ok = store.importData(JSON.parse(await file.text()));
  } catch {
    ok = false;
  }
  if (ok) {
    setLang(store.state.lang);
    notified = new Set();
    rerenderAll();
  }
  toast(t(ok ? 'set.import.ok' : 'set.import.bad'));
}

// Una pestaña oculta nunca se ha acomodado: se acomoda una vez en un rato libre (sin pintarla), así la primera vez que se abre es rápida.
function warmViews() {
  const queue = Object.keys(views).filter((v) => v !== S.tab);
  const step = () => {
    const v = queue.shift();
    if (!v) return;
    const el = viewEl(v);
    if (el.hidden) {
      el.style.contentVisibility = 'visible';
      el.style.visibility = 'hidden';
      el.style.height = 'auto';
      el.style.position = 'absolute';
      el.style.width = '100%';
      void el.offsetHeight;
      el.removeAttribute('style');
    }
    (window.requestIdleCallback || ((f) => setTimeout(f, 50)))(step, { timeout: 300 });
  };
  setTimeout(step, 0); // la primera (Mercados, la más pesada) en cuanto la app está lista
}

// ---------- arranque ----------
async function boot() {
  setLang(store.state.lang || APP.defaultLang);
  buildTabs();
  $('#shell').classList.toggle('rail-closed', !P.rail);
  applyStaticI18n();
  document.addEventListener('click', onClick);
  document.addEventListener('submit', onSubmit);
  document.addEventListener('input', onInput);
  $('#import-file').addEventListener('change', onImport);
  let qTimer;
  $('#q').addEventListener('input', (e) => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => runSearch(e.target.value), 120);
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && closeSheets());
  const ticker = $('#ticker');
  ticker.addEventListener('touchstart', () => ticker.classList.add('hold'), { passive: true });
  ticker.addEventListener('touchend', () => setTimeout(() => ticker.classList.remove('hold'), 2500), { passive: true });
  matchMedia('(min-width: 768px)').addEventListener('change', () => renderSide());

  // 1) Lo último guardado, al instante.
  const cached = await Promise.all(DATA.map(cachedData));
  DATA.forEach((n, i) => (S[n] = cached[i]));
  renderTicker();
  render(S.tab);
  // 2) Si no había nada guardado, se espera a la red antes de marcar «listo».
  const net = loadData();
  if (!S.news && !S.stories) await net;
  performance.mark('p1-ready');
  window.p1.ready = true;
  // Las otras pestañas se arman ya (ocultas no cuestan acomodo): al tocarlas solo se muestran.
  for (const v of Object.keys(views)) if (v !== S.tab && !S.rendered.has(v)) render(v);
  warmViews();
  loadCoins();
  net.then(loadSnapshots);
  idleRender();
  renderSide();

  setInterval(() => document.visibilityState === 'visible' && loadData(), REFRESH.data);
  setInterval(() => document.visibilityState === 'visible' && loadCoins(), REFRESH.prices);
  setInterval(() => document.visibilityState === 'visible' && S.tab === 'memes' && loadMemes(true), REFRESH.memes);
  setInterval(refreshUpd, 15000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      loadData();
      loadCoins();
      liveMap?.resume();
    } else liveMap?.pause();
  });
  window.addEventListener('online', () => (loadData(), loadCoins()));
  window.addEventListener('offline', () => setOffline(true));

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// Ganchos mínimos para pruebas y depuración (no exponen datos personales a la red).
window.p1 = { ready: false, refresh: loadData, refreshMemes: () => loadMemes(true), state: S, openDetail, go: showTab, map: () => liveMap };
window.p2 = window.p1;
boot();
