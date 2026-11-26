// Única fuente del nombre de la app y de los ajustes compartidos entre la app y la Action.
// Este archivo se importa tanto en el navegador como en Node (scripts/), así que no usa APIs de navegador.

export const APP = {
  name: 'Pulse',
  themeColor: '#05070a',
  timeZone: 'America/Mexico_City',
  defaultLang: 'es',
};

// Prefijo para todo lo que la app guarda en el teléfono (localStorage).
export const STORE_PREFIX = 'p1.';

// Mercados y su color de etiqueta.
export const MARKETS = {
  meme: { color: '#c6ff3d' },
  crypto: { color: '#ffb020' },
  forex: { color: '#22d3ee' },
  stocks: { color: '#a78bfa' },
};

// Cadenas para memecoins: id de GeckoTerminal, id de DEX Screener, id numérico EVM (para GoPlus).
export const CHAINS = [
  { id: 'solana', label: 'Solana', gt: 'solana', ds: 'solana', evm: null },
  { id: 'all', label: '*', gt: null, ds: null, evm: null },
  { id: 'base', label: 'Base', gt: 'base', ds: 'base', evm: 8453 },
  { id: 'ethereum', label: 'Ethereum', gt: 'eth', ds: 'ethereum', evm: 1 },
  { id: 'bsc', label: 'BNB', gt: 'bsc', ds: 'bsc', evm: 56 },
];

// Avisos de riesgo en memecoins.
export const MEME_LIMITS = {
  lowLiquidityUsd: 10000, // liquidez menor a esto: aviso «liquidez muy baja»
  youngHours: 24, // menos horas de vida que esto: aviso «N h de vida»
  gainersMinLiquidityUsd: 5000,
  gainersMinVolumeUsd: 10000,
};

// Índices de la barra de precios (símbolos de CNBC).
export const INDEX_SYMBOLS = [
  { sym: '.SPX', label: 'S&P 500' },
  { sym: '.IXIC', label: 'Nasdaq' },
  { sym: '.DJI', label: 'Dow' },
  { sym: '.RUT', label: 'Russell 2K' },
  { sym: '.MXX', label: 'IPC MX' },
  { sym: '.DXY', label: 'DXY' },
  { sym: 'MXN=', label: 'USD/MXN' },
];

export const CNBC_QUOTE_URL =
  'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1&symbols=';

export function cnbcQuoteUrl() {
  return CNBC_QUOTE_URL + encodeURIComponent(INDEX_SYMBOLS.map((s) => s.sym).join('|'));
}

// Lista de coins principales de la pestaña Cripto (CoinGecko).
export const COINGECKO_MARKETS_URL =
  'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&price_change_percentage=24h';

export const GT_BASE = 'https://api.geckoterminal.com/api/v2';
export const DS_BASE = 'https://api.dexscreener.com';

// Palabras que marcan una noticia de cripto también como de memecoins.
export const MEME_WORDS = [
  'memecoin', 'meme coin', 'meme-coin', 'memecoins', 'pump.fun', 'pumpfun', 'dogecoin', 'doge', 'shiba', 'shib',
  'pepe', 'bonk', 'dogwifhat', 'wif', 'floki', 'trump coin', '$trump', 'fartcoin', 'popcat', 'brett', 'letsbonk',
];

// Cada cuánto se refresca cada cosa en el teléfono (ms).
export const REFRESH = {
  data: 3 * 60 * 1000,
  prices: 60 * 1000,
  memes: 60 * 1000,
};
