// Fuentes que junta la GitHub Action. Todas comprobadas (ver `npm run p1:fuentes`).
// type: rss | ff-calendar | cnbc-quotes
import { cnbcQuoteUrl, COINGECKO_GLOBAL_URL, COINGECKO_SIMPLE_URL, FNG_URL } from '../app/js/config.js';
import { universeUrls } from './markets.mjs';

export const NEWS_SOURCES = [
  // Cripto
  { id: 'coindesk', name: 'CoinDesk', type: 'rss', market: 'crypto', lang: 'en', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { id: 'cointelegraph', name: 'Cointelegraph', type: 'rss', market: 'crypto', lang: 'en', url: 'https://cointelegraph.com/rss' },
  { id: 'decrypt', name: 'Decrypt', type: 'rss', market: 'crypto', lang: 'en', url: 'https://decrypt.co/feed' },
  { id: 'theblock', name: 'The Block', type: 'rss', market: 'crypto', lang: 'en', url: 'https://www.theblock.co/rss.xml' },
  // Memecoins
  { id: 'ct-memecoin', name: 'Cointelegraph', type: 'rss', market: 'meme', lang: 'en', url: 'https://cointelegraph.com/rss/tag/memecoin', maxAgeHours: 24 * 30, maxItems: 15 },
  // Forex
  { id: 'fxstreet', name: 'FXStreet', type: 'rss', market: 'forex', lang: 'en', url: 'https://www.fxstreet.com/rss/news' },
  { id: 'fxstreet-es', name: 'FXStreet ES', type: 'rss', market: 'forex', lang: 'es', url: 'https://www.fxstreet.es/rss/news' },
  { id: 'investinglive', name: 'investingLive', type: 'rss', market: 'forex', lang: 'en', url: 'https://investinglive.com/feed/news' },
  // Acciones
  { id: 'cnbc-top', name: 'CNBC', type: 'rss', market: 'stocks', lang: 'en', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { id: 'cnbc-markets', name: 'CNBC Markets', type: 'rss', market: 'stocks', lang: 'en', url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html' },
  { id: 'marketwatch', name: 'MarketWatch', type: 'rss', market: 'stocks', lang: 'en', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
];

export const CALENDAR_SOURCE = {
  id: 'forexfactory', name: 'Forex Factory', type: 'ff-calendar', url: 'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
};

export const INDICES_SOURCE = {
  id: 'cnbc-quotes', name: 'CNBC', type: 'cnbc-quotes', url: cnbcQuoteUrl(),
};

// P2: cotizaciones del universo (acciones, ETFs, sectores, ADR, forex, macro) en tandas de 40 símbolos.
export const UNIVERSE_SOURCE = { id: 'cnbc-universe', name: 'CNBC', type: 'cnbc-universe', urls: universeUrls() };
// P2: datos globales de cripto. Se piden desde la Action (así el teléfono sigue hablando solo con los servidores de P1).
export const CRYPTO_SOURCES = [
  { id: 'coingecko-global', name: 'CoinGecko', type: 'json', url: COINGECKO_GLOBAL_URL },
  { id: 'coingecko-simple', name: 'CoinGecko', type: 'json', url: COINGECKO_SIMPLE_URL },
  { id: 'fng', name: 'alternative.me', type: 'json', url: FNG_URL },
];
// Cada URL que pide la Action con el nombre de su copia guardada en tests/fixtures.
export const UNIVERSE_FIXTURES = UNIVERSE_SOURCE.urls.map((url, i) => ({ id: `cnbc-universe-${i + 1}`, url }));

export const ALL_SOURCES = [...NEWS_SOURCES, CALENDAR_SOURCE, INDICES_SOURCE];
export const P2_FETCHES = [...UNIVERSE_FIXTURES, ...CRYPTO_SOURCES];

// Fuentes que la app pide directo desde el teléfono (permiten CORS). Solo para la revisión de fuentes reales.
export const DIRECT_SOURCES = [
  { id: 'coingecko', name: 'CoinGecko', url: 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=5&page=1' },
  { id: 'gt-new', name: 'GeckoTerminal (nuevos)', url: 'https://api.geckoterminal.com/api/v2/networks/solana/new_pools?include=base_token' },
  { id: 'gt-volume', name: 'GeckoTerminal (volumen)', url: 'https://api.geckoterminal.com/api/v2/networks/solana/pools?sort=h24_volume_usd_desc&include=base_token' },
  { id: 'ds-boosts', name: 'DEX Screener (boosts)', url: 'https://api.dexscreener.com/token-boosts/top/v1' },
];

// Límites de lo que se guarda.
export const LIMITS = {
  summaryChars: 180, // una línea de resumen como máximo
  perSource: 40,
  maxItems: 500,
  maxAgeHours: 72,
};
