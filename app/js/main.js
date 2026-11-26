import { APP, MARKETS, CHAINS, MEME_LIMITS, REFRESH } from './config.js';
import { setLang, getLang, t } from './i18n.js';
import * as store from './store.js';
import { cachedData, freshData, fetchCoins, lastCoins, fetchMemes, lastMemes } from './api.js';
import { $, $$, esc, clock, dayLabel, dayKey, ago, duration, age, num, usdCompact, price, pct, keywordRegex, highlight, matchesKeyword } from './util.js';

const PAGE = 40;
const COIN_PAGE = 20;
const S = {
  news: null, calendar: null, indices: null, status: null, coins: lastCoins(),
  memes: {}, coinLimit: COIN_PAGE, tab: 'live', liveFilter: 'all', memeChain: 'solana', memeView: 'new', forexSeg: 'cal', showPast: false,
  offline: false, scroll: {}, rendered: new Set(), dirty: new Set(),
};
const lists = {}; // id de lista → { ids:Set, pending:[], limit }
const memePending = { has: false };

// ---------- utilidades de lista de noticias ----------
const allNews = () => S.news?.items || [];
const byTag = (tag) => allNews().filter((n) => (n.tags || [n.market]).includes(tag));
const kwRe = () => keywordRegex(store.state.keywords);

function newsRow(it) {
  const re = kwRe();
  const kw = matchesKeyword(it, re);
  const tags = (it.tags || [it.market]).slice(0, 2);
  const saved = store.isSaved(it.id);
  const read = store.isRead(it.id);
  return `<article class="it${read ? ' read' : ''}${kw ? ' kw' : ''}" data-id="${esc(it.id)}" style="--mc:${MARKETS[it.market]?.color || '#888'}">
<a class="it-main" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer" lang="${esc(it.lang || 'en')}">
<div class="it-meta">${tags.map((m) => `<span class="tag" style="--tc:${MARKETS[m]?.color}">${esc(t('m.' + m))}</span>`).join('')}<span class="src">${esc(it.source)}</span><time class="mono" datetime="${esc(it.time)}">${clock(it.time)}</time></div>
<h3>${highlight(it.title, re)}</h3>${it.summary ? `<p>${highlight(it.summary, re)}</p>` : ''}</a>
<div class="it-act"><button type="button" class="ib act-save${saved ? ' on' : ''}" aria-pressed="${saved}" aria-label="${esc(t(saved ? 'unsave' : 'save'))}">${saved ? '★' : '☆'}</button><button type="button" class="ib act-read${read ? ' on' : ''}" aria-pressed="${read}" aria-label="${esc(t(read ? 'unread' : 'read'))}">✓</button></div>
</article>`;
}

function newsListHtml(listId, items) {
  const L = (lists[listId] ||= { ids: new Set(), pending: [], limit: PAGE });
  L.ids = new Set(items.map((i) => i.id));
  L.pending = [];
  if (!items.length) return `<p class="empty">${esc(t(listId === 'saved' ? 'empty.saved' : 'empty.news'))}</p>`;
  const shown = items.slice(0, L.limit);
  return `<div class="news" data-list="${listId}">${shown.map(newsRow).join('')}</div>${
    items.length > shown.length ? `<button type="button" class="more" data-more="${listId}">${esc(t('more'))} (${items.length - shown.length})</button>` : ''
  }`;
}

function listItems(listId) {
  switch (listId) {
    case 'live': return S.liveFilter === 'all' ? allNews() : byTag(S.liveFilter);
    case 'memes': return byTag('meme');
    case 'crypto': return byTag('crypto');
    case 'forex': return byTag('forex');
    case 'stocks': return byTag('stocks');
    case 'saved': return store.savedList();
    default: return [];
  }
}

function updHtml(key, iso) {
  return `<span class="upd mono" data-upd="${key}" data-time="${esc(iso || '')}">${iso ? esc(t('updated', { t: ago(iso) })) : esc(t('updated.never'))}</span>`;
}
function head(view, updKey, iso) {
  return `<div class="vh"><h2>${esc(t('title.' + view))}</h2>${updKey ? updHtml(updKey, iso) : ''}</div>`;
}
function chips(group, options, current) {
  return `<div class="chips" role="group" data-group="${group}">${options
    .map(([v, label]) => `<button type="button" class="chip${v === current ? ' sel' : ''}" data-chip="${group}" data-v="${esc(v)}" aria-pressed="${v === current}">${esc(label)}</button>`)
    .join('')}</div>`;
}

// ---------- vistas ----------
const views = {
  live() {
    return `${head('live', 'news', S.news?.generatedAt)}${chips('live', [['all', t('m.all')], ['meme', t('m.meme')], ['crypto', t('m.crypto')], ['forex', t('m.forex')], ['stocks', t('m.stocks')]], S.liveFilter)}
<div data-slot="live">${newsListHtml('live', listItems('live'))}</div>`;
  },
  memes() {
    const chainOpts = CHAINS.map((c) => [c.id, c.id === 'all' ? t('meme.all') : c.label]);
    const viewOpts = [['new', t('meme.new')], ['gainers', t('meme.gainers')], ['volume', t('meme.volume')], ['promoted', t('meme.promoted')]];
    const key = `${S.memeChain}.${S.memeView}`;
    const data = S.memes[key] || lastMemes(S.memeChain, S.memeView);
    return `${head('memes', 'memes', data?.fetchedAt)}${chips('chain', chainOpts, S.memeChain)}${chips('mview', viewOpts, S.memeView)}
<p class="note">${esc(t('meme.disclaimer'))}</p>${S.memeView === 'promoted' ? `<p class="note promo-note">${esc(t('meme.promo.note'))}</p>` : ''}
<div data-slot="coins">${coinsHtml(data)}</div>
<h3 class="sub">${esc(t('meme.news'))}</h3><div data-slot="memes">${newsListHtml('memes', listItems('memes'))}</div>`;
  },
  crypto() {
    return `${head('crypto', 'news', S.news?.generatedAt)}<h3 class="sub">${esc(t('prices'))} ${updHtml('coins', S.coins?.fetchedAt)}</h3>
<div data-slot="prices">${pricesHtml()}</div><h3 class="sub">${esc(t('news'))}</h3><div data-slot="crypto">${newsListHtml('crypto', listItems('crypto'))}</div>`;
  },
  forex() {
    return `${head('forex', 'calendar', S.calendar?.generatedAt)}<div data-slot="next">${nextEventHtml()}</div>
${chips('fx', [['cal', t('cal.short')], ['news', t('news')]], S.forexSeg)}
${S.forexSeg === 'cal' ? `<div data-slot="cal">${calendarHtml()}</div>` : `${updHtml('news', S.news?.generatedAt)}<div data-slot="forex">${newsListHtml('forex', listItems('forex'))}</div>`}`;
  },
  stocks() {
    return `${head('stocks', 'news', S.news?.generatedAt)}<h3 class="sub">${esc(t('indices'))} ${updHtml('indices', S.indices?.generatedAt)}</h3>
<div data-slot="indices">${indicesHtml()}</div><h3 class="sub">${esc(t('news'))}</h3><div data-slot="stocks">${newsListHtml('stocks', listItems('stocks'))}</div>`;
  },
  tweets() {
    const ls = store.state.lists;
    return `${head('tweets')}<p class="note">${esc(t('tw.intro'))}</p>${
      ls.length
        ? `<div class="xlists">${ls
            .map(
              (l, i) => `<div class="xl" data-i="${i}"><div class="xl-h"><b>${esc(l.name)}</b><span class="mono dim">${esc(l.url.replace(/^https?:\/\/(www\.)?/, ''))}</span></div>
<div class="xl-b"><a class="btn primary" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(t('tw.open'))} ↗</a><button type="button" class="btn" data-embed="${i}">${esc(t('tw.embed'))}</button></div><div class="xl-embed" data-embed-slot="${i}"></div></div>`
            )
            .join('')}</div><p class="note dim">${esc(t('tw.embed.note'))}</p>`
        : `<p class="empty">${esc(t('tw.none'))}</p><button type="button" class="btn primary" data-open-settings>${esc(t('settings'))}</button>`
    }`;
  },
  saved() {
    return `${head('saved')}<div data-slot="saved">${newsListHtml('saved', listItems('saved'))}</div>`;
  },
};

function coinsHtml(data) {
  if (!data) return `<p class="empty">${esc(t('meme.loading'))}</p>`;
  if (data.error && !data.coins?.length) return `<p class="empty">${esc(t('meme.error'))}</p>`;
  if (!data.coins.length) return `<p class="empty">${esc(t('empty.news'))}</p>`;
  const now = Date.now();
  const rest = data.coins.length - S.coinLimit;
  return `<div class="coins">${data.coins
    .slice(0, S.coinLimit)
    .map((c) => {
      const hours = c.createdAt ? (now - new Date(c.createdAt).getTime()) / 3600e3 : null;
      const warns = [];
      if (c.liquidity != null && c.liquidity < MEME_LIMITS.lowLiquidityUsd) warns.push(`<span class="warn">⚠ ${esc(t('meme.lowliq'))}</span>`);
      if (hours != null && hours < MEME_LIMITS.youngHours) warns.push(`<span class="warn">⏱ ${esc(t('meme.young', { h: age(c.createdAt, now) }))}</span>`);
      return `<div class="coin${c.promoted ? ' promo' : ''}" data-key="${esc(c.key)}">
<div class="coin-h"><b class="sym">${esc(c.symbol)}</b><span class="cname">${esc(c.name)}</span><span class="cprice mono" title="${esc(t('meme.price'))}">${price(c.priceUsd)}</span></div>
<div class="coin-s"><span class="chain mono">${esc(c.chain)}</span>${c.promoted ? `<span class="badge-promo">${esc(t('meme.promo'))}</span>` : ''}</div>
<div class="coin-g mono"><div><small>${esc(t('meme.chg'))}</small>${pct(c.change24)}</div><div><small>${esc(t('meme.vol'))}</small><span>${usdCompact(c.volume24)}</span></div><div><small>${esc(t('meme.liq'))}</small><span>${usdCompact(c.liquidity)}</span></div><div><small>${esc(t('meme.age'))}</small><span>${age(c.createdAt, now)}</span></div></div>
${warns.length ? `<div class="warns">${warns.join('')}</div>` : ''}
<div class="coin-b"><a class="btn" href="${esc(c.dexUrl)}" target="_blank" rel="noopener noreferrer">${esc(t('meme.dex'))} ↗</a>${c.riskUrl ? `<a class="btn" href="${esc(c.riskUrl)}" target="_blank" rel="noopener noreferrer">${esc(t('meme.risk'))} ↗</a>` : ''}</div></div>`;
    })
    .join('')}</div>${rest > 0 ? `<button type="button" class="more" data-more-coins>${esc(t('more'))} (${rest})</button>` : ''}`;
}

function pricesHtml() {
  const cs = S.coins?.coins;
  if (!cs?.length) return `<p class="empty">${esc(t('meme.loading'))}</p>`;
  return `<div class="ptable mono">${cs
    .slice(0, 10)
    .map((c) => `<div class="pr"><span class="rk dim">${c.rank ?? ''}</span><b>${esc(c.symbol)}</b><span class="pv">${c.price >= 1 ? '$' + num(c.price, c.price >= 1000 ? 0 : 2) : price(c.price)}</span>${pct(c.change24)}</div>`)
    .join('')}</div>`;
}

function indicesHtml() {
  const qs = S.indices?.quotes;
  if (!qs?.length) return `<p class="empty">${esc(t('updated.never'))}</p>`;
  return `<div class="ptable mono">${qs
    .map((q) => `<div class="pr"><b>${esc(q.label)}</b><span class="pv">${num(q.last, q.last < 100 ? 3 : 2)}</span>${pct(q.changePct)}<small class="delay">${esc(t('delayed'))}</small></div>`)
    .join('')}</div>`;
}

function nextHigh() {
  const now = Date.now();
  return (S.calendar?.events || []).find((e) => e.impact === 'high' && new Date(e.time).getTime() > now) || null;
}
function nextEventHtml() {
  const e = nextHigh();
  if (!S.calendar) return '';
  if (!e) return `<div class="next"><span class="dim">${esc(t('cal.none'))}</span></div>`;
  return `<div class="next"><small>${esc(t('cal.next'))}</small><div class="next-r"><span class="imp high">${esc(e.country)}</span><b>${esc(e.title)}</b></div>
<div class="next-r mono"><span class="cd" data-cd="${esc(e.time)}">${esc(t('cal.in', { t: duration(new Date(e.time) - Date.now()) }))}</span><span class="dim">${esc(dayLabel(e.time))} · ${clock(e.time)}</span></div></div>`;
}

function calendarHtml() {
  const evs = S.calendar?.events || [];
  if (!evs.length) return `<p class="empty">${esc(t('updated.never'))}</p>`;
  const now = Date.now();
  const today = dayKey(new Date().toISOString());
  const shown = S.showPast ? evs : evs.filter((e) => dayKey(e.time) >= today);
  let html = `<p class="note mono dim">${esc(t('calendar'))} · ${esc(t('cal.tz'))}</p>`;
  if (!S.showPast && shown.length < evs.length) html += `<button type="button" class="more" data-past>${esc(t('cal.past'))} (${evs.length - shown.length})</button>`;
  let day = '';
  for (const e of shown) {
    const k = dayKey(e.time);
    if (k !== day) {
      day = k;
      html += `<h4 class="day">${k === today ? esc(t('cal.today')) + ' · ' : ''}${esc(dayLabel(e.time))}</h4>`;
    }
    const past = new Date(e.time).getTime() < now;
    const extra = [e.actual && `${t('cal.a')} ${e.actual}`, e.forecast && `${t('cal.f')} ${e.forecast}`, e.previous && `${t('cal.p')} ${e.previous}`].filter(Boolean).join(' · ');
    html += `<div class="ev ${e.impact}${past ? ' past' : ''}"><span class="mono tm">${clock(e.time)}</span><span class="imp ${e.impact}" title="${esc(t('cal.' + e.impact))}">${esc(e.country)}</span><div class="ev-t"><span>${esc(e.title)}</span>${extra ? `<small class="mono">${esc(extra)}</small>` : ''}</div></div>`;
  }
  return html;
}

function tickerHtml() {
  const parts = [];
  const want = ['BTC', 'ETH', 'SOL'];
  const cs = S.coins?.coins || [];
  for (const sym of want) {
    const c = cs.find((x) => x.symbol === sym);
    parts.push(`<div class="tk" role="listitem"><span class="tk-l">${sym}</span><span class="mono">${c ? '$' + num(c.price, c.price >= 1000 ? 0 : 2) : '—'}</span>${c ? pct(c.change24) : ''}</div>`);
  }
  for (const q of S.indices?.quotes || []) {
    parts.push(`<div class="tk" role="listitem"><span class="tk-l">${esc(q.label)}</span><span class="mono">${num(q.last, q.last < 100 ? 3 : 2)}</span>${pct(q.changePct)}<small class="delay">${esc(t('delayed'))}</small></div>`);
  }
  return parts.join('');
}

// ---------- render ----------
function viewEl(v) {
  return document.getElementById('v-' + v);
}
function render(v) {
  viewEl(v).innerHTML = views[v]();
  S.rendered.add(v);
  S.dirty.delete(v);
}
function markAllDirty() {
  for (const v of Object.keys(views)) if (v !== S.tab) S.dirty.add(v);
}
function renderTicker() {
  $('#ticker').innerHTML = tickerHtml();
}

function showTab(v) {
  if (v === S.tab && S.rendered.has(v)) return;
  S.scroll[S.tab] = window.scrollY;
  viewEl(S.tab).hidden = true;
  const btnOld = $(`.tabs [data-tab="${S.tab}"]`);
  btnOld?.setAttribute('aria-selected', 'false');
  S.tab = v;
  $(`.tabs [data-tab="${v}"]`).setAttribute('aria-selected', 'true');
  if (!S.rendered.has(v) || S.dirty.has(v)) render(v);
  viewEl(v).hidden = false;
  window.scrollTo(0, S.scroll[v] || 0);
  updatePill();
  if (v === 'memes') loadMemes();
}

// Noticias nuevas: no se meten en la lista visible; se cuentan y se avisa con la píldora.
function absorbNews() {
  for (const listId of ['live', 'memes', 'crypto', 'forex', 'stocks']) {
    const L = lists[listId];
    const v = listId;
    if (!S.rendered.has(v)) continue;
    if (!L || !L.ids.size) {
      // lista vacía: no hay nada que se mueva, se pinta directo
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
  if (S.tab === 'forex') return S.forexSeg === 'news' ? 'forex' : null;
  return ['live', 'memes', 'crypto', 'stocks'].includes(S.tab) ? S.tab : null;
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

// En la vista abierta se actualizan en su lugar las partes que no cambian de alto (precios, índices, calendario).
function patchSlot(view, slot, html) {
  if (!S.rendered.has(view)) return;
  if (S.tab !== view) {
    S.dirty.add(view);
    return;
  }
  const el = $(`[data-slot="${slot}"]`, viewEl(view));
  if (!el) return;
  const before = el.offsetHeight;
  const top = el.getBoundingClientRect().top;
  const y = window.scrollY;
  el.innerHTML = html;
  // Si el bloque cambió de alto por encima de lo que se está viendo, se compensa para que nada salte.
  const diff = el.offsetHeight - before;
  if (diff && top < 0) window.scrollTo(0, y + diff);
}

function refreshUpd() {
  for (const el of $$('[data-upd]')) {
    const key = el.dataset.upd;
    const iso = key === 'news' ? S.news?.generatedAt : key === 'calendar' ? S.calendar?.generatedAt : key === 'indices' ? S.indices?.generatedAt : key === 'coins' ? S.coins?.fetchedAt : key === 'memes' ? (S.memes[`${S.memeChain}.${S.memeView}`] || lastMemes(S.memeChain, S.memeView))?.fetchedAt : el.dataset.time;
    el.textContent = iso ? t('updated', { t: ago(iso) }) : t('updated.never');
  }
  for (const el of $$('[data-cd]')) el.textContent = t('cal.in', { t: duration(new Date(el.dataset.cd) - Date.now()) });
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
  if (hits.length === 1) toast(`🔔 ${t('kw.toast', { k: matchesKeyword(hits[0], re) })}: ${hits[0].title}`, matchesKeyword(hits[0], re));
  else toast(`🔔 ${t('kw.many', { n: hits.length })}`, initial ? store.state.keywords[0] : matchesKeyword(hits[0], re));
}

let toastTimer;
function toast(text, query) {
  const el = $('#toast');
  el.textContent = text;
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
  el.textContent = off ? `⚡ ${t('offline')}${S.news?.generatedAt ? ' · ' + ago(S.news.generatedAt) : ''}` : '';
}

function applyData(name, json, { fromCache = false } = {}) {
  if (!json) return;
  if (name === 'news') {
    const firstFill = !S.news;
    S.news = json;
    if (firstFill) {
      for (const v of ['live', 'memes', 'crypto', 'forex', 'stocks']) if (S.rendered.has(v)) S.tab === v ? render(v) : S.dirty.add(v);
    } else absorbNews();
    if (!fromCache) checkKeywords(firstFill);
  } else if (name === 'calendar') {
    S.calendar = json;
    patchSlot('forex', 'cal', calendarHtml());
    patchSlot('forex', 'next', nextEventHtml());
  } else if (name === 'indices') {
    S.indices = json;
    renderTicker();
    patchSlot('stocks', 'indices', indicesHtml());
  } else if (name === 'status') S.status = json;
  refreshUpd();
}

async function loadData() {
  let failed = 0;
  await Promise.all(
    ['news', 'calendar', 'indices', 'status'].map(async (n) => {
      try {
        applyData(n, await freshData(n));
      } catch {
        failed++;
      }
    })
  );
  setOffline(failed === 4 || !navigator.onLine);
}

async function loadCoins() {
  try {
    S.coins = await fetchCoins();
  } catch {
    if (!S.coins) return;
  }
  renderTicker();
  patchSlot('crypto', 'prices', pricesHtml());
  refreshUpd();
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
  } catch {
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
  } else {
    slot.innerHTML = coinsHtml(S.memes[key]);
  }
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
  const news = [...allNews(), ...store.savedList()].filter((n) => !seen.has(n.id) && seen.add(n.id) && has(n.title, n.summary, n.source)).slice(0, 40);
  const coins = [];
  const ck = new Set();
  for (const d of Object.values(S.memes)) for (const c of d?.coins || []) if (!ck.has(c.key) && has(c.symbol, c.name, c.token) && ck.add(c.key)) coins.push(c);
  const tops = (S.coins?.coins || []).filter((c) => has(c.symbol, c.name));
  const evs = (S.calendar?.events || []).filter((e) => has(e.title, e.country)).slice(0, 20);
  let html = '';
  if (tops.length) html += `<div class="ptable mono">${tops.map((c) => `<div class="pr"><b>${esc(c.symbol)}</b><span class="pv">$${num(c.price, c.price >= 1000 ? 0 : 2)}</span>${pct(c.change24)}</div>`).join('')}</div>`;
  if (coins.length) html += coinsHtml({ coins: coins.slice(0, 20) });
  if (evs.length) html += evs.map((e) => `<div class="ev ${e.impact}"><span class="mono tm">${esc(dayLabel(e.time))} ${clock(e.time)}</span><span class="imp ${e.impact}">${esc(e.country)}</span><div class="ev-t"><span>${esc(e.title)}</span></div></div>`).join('');
  if (news.length) html += `<div class="news">${news.map(newsRow).join('')}</div>`;
  box.innerHTML = html || `<p class="empty">${esc(t('search.none'))}</p>`;
}

function openSheet(id) {
  $$('.sheet').forEach((s) => (s.hidden = s.id !== id));
  document.body.classList.add('locked');
  if (id === 'sheet-search') setTimeout(() => $('#q').focus(), 30);
  if (id === 'sheet-settings') renderSettings();
}
function closeSheets() {
  $$('.sheet').forEach((s) => (s.hidden = true));
  document.body.classList.remove('locked');
}

// ---------- ajustes ----------
function renderSettings() {
  const st = store.state;
  const srcs = Object.entries(S.status?.sources || {});
  $('#settings-body').innerHTML = `
<section class="set"><h3>${esc(t('set.lang'))}</h3>${chips('lang', [['es', 'Español'], ['en', 'English']], getLang())}</section>
<section class="set"><h3>${esc(t('set.kw'))}</h3><p class="note">${esc(t('set.kw.help'))}</p>
<form class="row" data-form="kw"><input name="kw" type="text" autocomplete="off" placeholder="${esc(t('set.kw.ph'))}" maxlength="40"><button class="btn primary" type="submit">${esc(t('add'))}</button></form>
<div class="kws">${st.keywords.map((k, i) => `<span class="kwchip"><span>${esc(k)}</span><button type="button" class="ib" data-rm-kw="${i}" aria-label="${esc(t('remove'))} ${esc(k)}">✕</button></span>`).join('')}</div></section>
<section class="set"><h3>${esc(t('set.lists'))}</h3><p class="note">${esc(t('set.lists.help'))}</p>
<form class="col" data-form="list"><input name="name" type="text" autocomplete="off" placeholder="${esc(t('set.lists.name'))}" maxlength="40" required><input name="url" type="url" autocomplete="off" inputmode="url" placeholder="https://x.com/i/lists/…" required><button class="btn primary" type="submit">${esc(t('add'))}</button><p class="err" hidden></p></form>
<div class="lists">${st.lists.map((l, i) => `<div class="lrow"><div><b>${esc(l.name)}</b><span class="mono dim">${esc(l.url)}</span></div><button type="button" class="ib" data-rm-list="${i}" aria-label="${esc(t('remove'))} ${esc(l.name)}">✕</button></div>`).join('')}</div></section>
<section class="set"><h3>${esc(t('set.data'))}</h3><p class="note">${esc(t('set.data.help'))}</p>
<div class="row"><button type="button" class="btn" data-export>${esc(t('set.export'))}</button><button type="button" class="btn" data-import>${esc(t('set.import'))}</button><button type="button" class="btn" data-clearread>${esc(t('set.clearread'))}</button></div></section>
<section class="set"><h3>${esc(t('set.sources'))}</h3><div class="srcs mono">${srcs
    .map(([id, s]) => `<div class="src-r"><span class="${s.ok ? 'up' : 'down'}">●</span><span>${esc(s.name)}</span><span class="dim">${s.ok ? esc(t('src.ok')) + ' · ' + s.count : esc(t('src.fail'))}</span></div>`)
    .join('')}</div></section>
<section class="set"><h3>${esc(t('set.about'))}</h3><p class="note">${esc(t('set.about.text', { name: APP.name }))}</p></section>`;
}

function rerenderAll() {
  applyStaticI18n();
  S.rendered.clear();
  render(S.tab);
  markAllDirty();
  renderTicker();
  if (!$('#sheet-settings').hidden) renderSettings();
  if (!$('#sheet-search').hidden) runSearch($('#q').value);
  updatePill();
  setOffline(S.offline);
}

function applyStaticI18n() {
  for (const el of $$('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of $$('[data-i18n-label]')) el.setAttribute('aria-label', t(el.dataset.i18nLabel));
  for (const el of $$('[data-i18n-ph]')) el.setAttribute('placeholder', t(el.dataset.i18nPh));
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

// ---------- eventos ----------
function onClick(e) {
  const tgt = e.target;
  const tab = tgt.closest('.tabs [data-tab]');
  if (tab) return showTab(tab.dataset.tab);
  const row = tgt.closest('.it');
  if (row) {
    const id = row.dataset.id;
    const item = allNews().find((n) => n.id === id) || store.savedList().find((n) => n.id === id);
    if (tgt.closest('.act-save') && item) {
      const on = store.toggleSaved(item);
      for (const b of $$(`.it[data-id="${CSS.escape(id)}"] .act-save`)) {
        b.classList.toggle('on', on);
        b.textContent = on ? '★' : '☆';
        b.setAttribute('aria-pressed', on);
        b.setAttribute('aria-label', t(on ? 'unsave' : 'save'));
      }
      S.dirty.add('saved');
      return;
    }
    if (tgt.closest('.act-read')) {
      const on = !store.isRead(id);
      store.setRead(id, on);
      for (const r of $$(`.it[data-id="${CSS.escape(id)}"]`)) {
        r.classList.toggle('read', on);
        const b = r.querySelector('.act-read');
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on);
        b.setAttribute('aria-label', t(on ? 'unread' : 'read'));
      }
      return;
    }
    if (tgt.closest('.it-main')) {
      store.setRead(id, true);
      for (const r of $$(`.it[data-id="${CSS.escape(id)}"]`)) {
        r.classList.add('read');
        r.querySelector('.act-read')?.classList.add('on');
      }
      return; // el enlace se abre normal
    }
  }
  const chip = tgt.closest('[data-chip]');
  if (chip) {
    const { chip: g, v } = chip.dataset;
    if (g === 'live') {
      S.liveFilter = v;
      lists.live && (lists.live.limit = PAGE);
      render('live');
      window.scrollTo(0, 0);
    } else if (g === 'chain' || g === 'mview') {
      if (g === 'chain') S.memeChain = v;
      else S.memeView = v;
      memePending.has = false;
      S.coinLimit = COIN_PAGE;
      render('memes');
      loadMemes();
    } else if (g === 'fx') {
      S.forexSeg = v;
      render('forex');
    } else if (g === 'lang') {
      setLang(v);
      store.setLangPref(v);
      rerenderAll();
    }
    updatePill();
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
    render('forex');
    return;
  }
  if (tgt.closest('#pill')) return applyPill();
  if (tgt.closest('#btn-search')) return openSheet('sheet-search');
  if (tgt.closest('#btn-settings') || tgt.closest('[data-open-settings]')) return openSheet('sheet-settings');
  if (tgt.closest('[data-close]')) return closeSheets();
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
    renderSettings();
    rerenderAll();
    return;
  }
  const rml = tgt.closest('[data-rm-list]');
  if (rml) {
    store.setLists(store.state.lists.filter((_, i) => i !== +rml.dataset.rmList));
    renderSettings();
    S.dirty.add('tweets');
    return;
  }
  if (tgt.closest('[data-export]')) return exportFile();
  if (tgt.closest('[data-import]')) return $('#import-file').click();
  if (tgt.closest('[data-clearread]')) {
    store.clearRead();
    rerenderAll();
  }
}

function onSubmit(e) {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  if (f.dataset.form === 'kw') {
    const v = f.kw.value.trim();
    if (!v) return;
    store.setKeywords([...store.state.keywords, v]);
    renderSettings();
    rerenderAll();
    checkKeywords(true);
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
    renderSettings();
    S.dirty.add('tweets');
    if (S.tab === 'tweets') render('tweets');
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

// ---------- arranque ----------
async function boot() {
  setLang(store.state.lang || APP.defaultLang);
  applyStaticI18n();
  document.addEventListener('click', onClick);
  document.addEventListener('submit', onSubmit);
  $('#import-file').addEventListener('change', onImport);
  let qTimer;
  $('#q').addEventListener('input', (e) => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => runSearch(e.target.value), 120);
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && closeSheets());

  // 1) Lo último guardado, al instante.
  const [news, calendar, indices, status] = await Promise.all(['news', 'calendar', 'indices', 'status'].map(cachedData));
  S.news = news;
  S.calendar = calendar;
  S.indices = indices;
  S.status = status;
  renderTicker();
  render(S.tab);
  // 2) Si no había nada guardado, se espera a la red antes de marcar «listo».
  const net = loadData();
  if (!news) await net;
  performance.mark('p1-ready');
  window.p1.ready = true;
  loadCoins();

  setInterval(() => document.visibilityState === 'visible' && loadData(), REFRESH.data);
  setInterval(() => document.visibilityState === 'visible' && loadCoins(), REFRESH.prices);
  setInterval(() => document.visibilityState === 'visible' && S.tab === 'memes' && loadMemes(true), REFRESH.memes);
  setInterval(refreshUpd, 15000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && (loadData(), loadCoins()));
  window.addEventListener('online', () => (loadData(), loadCoins()));
  window.addEventListener('offline', () => setOffline(true));

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// Ganchos mínimos para pruebas y depuración (no exponen datos personales a la red).
window.p1 = { ready: false, refresh: loadData, refreshMemes: () => loadMemes(true), state: S };
boot();
