// Peticiones desde el teléfono. Ninguna lleva datos personales: solo URLs públicas fijas.
import { CHAINS, COINGECKO_MARKETS_URL, GT_BASE, DS_BASE, MEME_LIMITS } from './config.js';
import { cacheGet, cacheSet } from './store.js';

const DATA_CACHE = 'p1-data';

async function getJson(url, timeoutMs = 12000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

// Datos que publica la Action junto con la app.
export async function cachedData(name) {
  try {
    const c = await caches.open(DATA_CACHE);
    const r = await c.match(`data/${name}.json`);
    return r ? await r.json() : null;
  } catch {
    return null;
  }
}
export async function freshData(name) {
  const r = await fetch(`data/${name}.json?t=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const copy = r.clone();
  const json = await r.json();
  try {
    const c = await caches.open(DATA_CACHE);
    await c.put(`data/${name}.json`, copy);
  } catch {
    /* sin Cache API */
  }
  return json;
}

// Precios principales (CoinGecko, CORS permitido).
export async function fetchCoins() {
  const list = await getJson(COINGECKO_MARKETS_URL);
  if (!Array.isArray(list)) throw new Error('Formato inesperado');
  const coins = list.map((c) => ({
    id: c.id, symbol: String(c.symbol || '').toUpperCase(), name: c.name, rank: c.market_cap_rank,
    price: c.current_price, change24: c.price_change_percentage_24h, volume: c.total_volume, mcap: c.market_cap,
  }));
  const out = { fetchedAt: new Date().toISOString(), coins };
  cacheSet('coins', out);
  return out;
}
export const lastCoins = () => cacheGet('coins') || null;

// ---------- Memecoins ----------
const GT_TO_DS = { eth: 'ethereum', polygon_pos: 'polygon', avax: 'avalanche', 'sui-network': 'sui', arbitrum: 'arbitrum', optimism: 'optimism', ton: 'ton', tron: 'tron' };
const EVM_IDS = { ethereum: 1, bsc: 56, base: 8453, arbitrum: 42161, polygon: 137, optimism: 10, avalanche: 43114 };
const MAJORS = new Set(['SOL', 'WSOL', 'USDC', 'USDT', 'ETH', 'WETH', 'BNB', 'WBNB', 'BTC', 'WBTC', 'CBBTC', 'JITOSOL', 'MSOL', 'BSOL', 'JUP', 'DAI', 'USD1', 'PYUSD', 'USDE', 'EURC', 'CBETH', 'STETH', 'WSTETH', 'USDS', 'FDUSD', 'USDB', 'TRX', 'TON', 'SUI', 'AVAX', 'POL', 'MATIC', 'ARB', 'OP', 'JLP', 'INF', 'JUPSOL', 'USDG', 'CASH', 'XAUT', 'PAXG', 'RAY']);

const f = (x) => {
  const n = parseFloat(x);
  return Number.isFinite(n) ? n : null;
};

export function riskUrl(dsChain, token) {
  if (dsChain === 'solana') return `https://rugcheck.xyz/tokens/${token}`;
  const id = EVM_IDS[dsChain];
  return id ? `https://gopluslabs.io/token-security/${id}/${token}` : null;
}

export function gtPoolsToCoins(json) {
  const tokens = new Map((json.included || []).filter((x) => x.type === 'token').map((x) => [x.id, x.attributes]));
  const out = [];
  for (const p of json.data || []) {
    const a = p.attributes || {};
    const net = p.id.slice(0, p.id.length - (a.address || '').length - 1) || p.id.split('_')[0];
    const baseId = p.relationships?.base_token?.data?.id || '';
    const tk = tokens.get(baseId) || {};
    const token = tk.address || baseId.slice(net.length + 1);
    const dsChain = GT_TO_DS[net] || net;
    const symbol = tk.symbol || String(a.name || '').split(' / ')[0] || '?';
    out.push({
      key: `${dsChain}:${token}`,
      chain: dsChain,
      symbol,
      name: tk.name || a.name || symbol,
      token,
      pool: a.address,
      priceUsd: f(a.base_token_price_usd),
      change1h: f(a.price_change_percentage?.h1),
      change24: f(a.price_change_percentage?.h24),
      volume24: f(a.volume_usd?.h24),
      liquidity: f(a.reserve_in_usd),
      createdAt: a.pool_created_at || null,
      promoted: false,
      dexUrl: `https://dexscreener.com/${dsChain}/${a.address}`,
      riskUrl: riskUrl(dsChain, token),
    });
  }
  return out;
}

export function dsPairsToCoins(pairs, boosts) {
  const best = new Map();
  for (const p of pairs || []) {
    const token = p.baseToken?.address;
    if (!token) continue;
    const k = `${p.chainId}:${token}`.toLowerCase();
    const cur = best.get(k);
    if (!cur || (p.liquidity?.usd || 0) > (cur.liquidity?.usd || 0)) best.set(k, p);
  }
  const out = [];
  for (const b of boosts) {
    const p = best.get(`${b.chainId}:${b.tokenAddress}`.toLowerCase());
    if (!p) continue;
    out.push({
      key: `${p.chainId}:${b.tokenAddress}`,
      chain: p.chainId,
      symbol: p.baseToken.symbol,
      name: p.baseToken.name,
      token: b.tokenAddress,
      pool: p.pairAddress,
      priceUsd: f(p.priceUsd),
      change1h: f(p.priceChange?.h1),
      change24: f(p.priceChange?.h24),
      volume24: f(p.volume?.h24),
      liquidity: f(p.liquidity?.usd),
      createdAt: p.pairCreatedAt ? new Date(p.pairCreatedAt).toISOString() : null,
      promoted: true, // los boosts son pagados: siempre «Promocionado»
      boost: b.totalAmount || b.amount || null,
      dexUrl: p.url || `https://dexscreener.com/${p.chainId}/${p.pairAddress}`,
      riskUrl: riskUrl(p.chainId, b.tokenAddress),
    });
  }
  return out;
}

const uniqByToken = (coins) => {
  const seen = new Map();
  for (const c of coins) {
    const k = c.key.toLowerCase();
    const cur = seen.get(k);
    if (!cur || (c.liquidity || 0) > (cur.liquidity || 0)) seen.set(k, c);
  }
  return [...seen.values()];
};
const notMajor = (c) => !MAJORS.has(String(c.symbol).toUpperCase());

function chainCfg(chainId) {
  return CHAINS.find((c) => c.id === chainId) || CHAINS[0];
}
const realChains = () => CHAINS.filter((c) => c.gt);

async function gtVolume(chain) {
  const nets = chain.gt ? [chain] : realChains();
  const lists = await Promise.all(nets.map((n) => getJson(`${GT_BASE}/networks/${n.gt}/pools?sort=h24_volume_usd_desc&include=base_token`).then(gtPoolsToCoins)));
  return lists.flat();
}

export async function fetchMemes(chainId, view) {
  const chain = chainCfg(chainId);
  let coins;
  if (view === 'new') {
    const url = chain.gt ? `${GT_BASE}/networks/${chain.gt}/new_pools?include=base_token` : `${GT_BASE}/networks/new_pools?include=base_token`;
    coins = gtPoolsToCoins(await getJson(url)).filter(notMajor);
    coins.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } else if (view === 'volume') {
    coins = uniqByToken((await gtVolume(chain)).filter(notMajor));
    coins.sort((a, b) => (b.volume24 || 0) - (a.volume24 || 0));
  } else if (view === 'gainers') {
    const trendUrl = chain.gt ? `${GT_BASE}/networks/${chain.gt}/trending_pools?include=base_token` : `${GT_BASE}/networks/trending_pools?include=base_token`;
    const [vol, tr] = await Promise.all([gtVolume(chain), getJson(trendUrl).then(gtPoolsToCoins).catch(() => [])]);
    coins = uniqByToken([...vol, ...tr].filter(notMajor)).filter(
      (c) => (c.liquidity || 0) >= MEME_LIMITS.gainersMinLiquidityUsd && (c.volume24 || 0) >= MEME_LIMITS.gainersMinVolumeUsd && c.change24 != null
    );
    coins.sort((a, b) => b.change24 - a.change24);
  } else {
    const all = await getJson(`${DS_BASE}/token-boosts/top/v1`);
    const boosts = (Array.isArray(all) ? all : []).filter((b) => !chain.ds || b.chainId === chain.ds).slice(0, 30);
    const byChain = new Map();
    for (const b of boosts) byChain.set(b.chainId, [...(byChain.get(b.chainId) || []), b.tokenAddress]);
    const pairs = (
      await Promise.all([...byChain].map(([c, addrs]) => getJson(`${DS_BASE}/tokens/v1/${c}/${addrs.slice(0, 30).join(',')}`).catch(() => [])))
    ).flat();
    coins = dsPairsToCoins(pairs, boosts);
  }
  const out = { fetchedAt: new Date().toISOString(), coins: coins.slice(0, 40) };
  cacheSet(`meme.${chainId}.${view}`, out);
  return out;
}
export const lastMemes = (chainId, view) => cacheGet(`meme.${chainId}.${view}`) || null;
