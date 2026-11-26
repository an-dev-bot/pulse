// Única fuente del nombre de la app y de los ajustes compartidos entre la app y la Action.
// Este archivo se importa tanto en el navegador como en Node (scripts/), así que no usa APIs de navegador.

export const APP = {
  name: 'Pulse',
  themeColor: '#05070a',
  timeZone: 'America/Mexico_City',
  defaultLang: 'en', // P2: la primera vez abre en inglés; si ya eligió idioma, se respeta
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
  'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&page=1&sparkline=true&price_change_percentage=24h';
export const COINGECKO_GLOBAL_URL = 'https://api.coingecko.com/api/v3/global';
export const COINGECKO_SIMPLE_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true';
export const FNG_URL = 'https://api.alternative.me/fng/?limit=1';

// Cripto que no se muestra en la lista: stablecoins y activos tokenizados que no son cripto.
// Además se ocultan las que valen ≈ $1 y no se mueven (regla en app/js/rank.js).
export const CRYPTO_DENY = [
  'usdt', 'usdc', 'dai', 'usde', 'usds', 'fdusd', 'pyusd', 'tusd', 'usd1', 'busd', 'usdd', 'frax', 'usdg', 'rlusd', 'usd0', 'gho',
  'eurc', 'usdtb', 'usdf', 'susde', 'bfusd', 'usyc', 'buidl', 'ousg', 'ustb', 'figr_heloc', 'xaut', 'paxg',
];

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

// Memecoins: filtros con los que abre la pestaña (se pueden cambiar en la app).
export const MEME_DEFAULTS = { view: 'volume', minLiquidity: 10000, minAgeHours: 1 };

// Datos más viejos que esto muestran el aviso tranquilo de «datos con X de antigüedad».
export const STALE_MIN = 45;

// Orden «Top» en el dispositivo: impacto × recencia + fuentes + lo personal (mi lista y palabras clave).
export const RANK = { weight: { high: 3, medium: 1.8, low: 1 }, halfLifeHours: 8, perExtraSource: 0.25, maxSourceBonus: 1, watchBoost: 1.2, keywordBoost: 1.2 };

// ---------- P2: universo de acciones, forex y activos ----------
// Para seguir otra acción: agrégala aquí (símbolo de CNBC, nombre y nombres con los que sale en titulares).
// kind: stock | etf | sector | adr. `names` se buscan en titulares respetando mayúsculas.
// tickerInText:false cuando el símbolo es una palabra común (V, MA, KO…): entonces solo cuenta como $V o (V).
const S = (sym, name, kind, names = [], extra = {}) => ({ sym, name, kind, names, ...extra });
export const UNIVERSE = [
  S('NVDA', 'NVIDIA', 'stock', ['Nvidia', 'NVIDIA'], { mega: true }),
  S('AAPL', 'Apple', 'stock', ['Apple', 'iPhone'], { mega: true }),
  S('MSFT', 'Microsoft', 'stock', ['Microsoft'], { mega: true }),
  S('AMZN', 'Amazon', 'stock', ['Amazon'], { mega: true }),
  S('GOOGL', 'Alphabet', 'stock', ['Alphabet', 'Google'], { mega: true }),
  S('META', 'Meta Platforms', 'stock', ['Meta Platforms', 'Meta', 'Facebook', 'Instagram'], { mega: true, tickerInText: false }),
  S('TSLA', 'Tesla', 'stock', ['Tesla'], { mega: true }),
  S('AVGO', 'Broadcom', 'stock', ['Broadcom'], { mega: true }),
  S('BRK.B', 'Berkshire Hathaway', 'stock', ['Berkshire Hathaway', 'Berkshire'], { mega: true }),
  S('LLY', 'Eli Lilly', 'stock', ['Eli Lilly']),
  S('JPM', 'JPMorgan Chase', 'stock', ['JPMorgan', 'JP Morgan']),
  S('V', 'Visa', 'stock', ['Visa'], { tickerInText: false }),
  S('WMT', 'Walmart', 'stock', ['Walmart']),
  S('XOM', 'Exxon Mobil', 'stock', ['ExxonMobil', 'Exxon']),
  S('UNH', 'UnitedHealth', 'stock', ['UnitedHealth']),
  S('MA', 'Mastercard', 'stock', ['Mastercard'], { tickerInText: false }),
  S('ORCL', 'Oracle', 'stock', ['Oracle']),
  S('COST', 'Costco', 'stock', ['Costco'], { tickerInText: false }),
  S('HD', 'Home Depot', 'stock', ['Home Depot'], { tickerInText: false }),
  S('PG', 'Procter & Gamble', 'stock', ['Procter & Gamble', 'P&G'], { tickerInText: false }),
  S('JNJ', 'Johnson & Johnson', 'stock', ['Johnson & Johnson', 'J&J']),
  S('NFLX', 'Netflix', 'stock', ['Netflix']),
  S('BAC', 'Bank of America', 'stock', ['Bank of America', 'BofA']),
  S('ABBV', 'AbbVie', 'stock', ['AbbVie']),
  S('KO', 'Coca-Cola', 'stock', ['Coca-Cola(?! [Ff][Ee][Mm][Ss][Aa])'], { tickerInText: false }),
  S('CRM', 'Salesforce', 'stock', ['Salesforce']),
  S('CVX', 'Chevron', 'stock', ['Chevron']),
  S('MRK', 'Merck', 'stock', ['Merck']),
  S('PEP', 'PepsiCo', 'stock', ['PepsiCo', 'Pepsi'], { tickerInText: false }),
  S('ADBE', 'Adobe', 'stock', ['Adobe']),
  S('CSCO', 'Cisco', 'stock', ['Cisco']),
  S('TMO', 'Thermo Fisher', 'stock', ['Thermo Fisher']),
  S('DIS', 'Disney', 'stock', ['Disney'], { tickerInText: false }),
  S('NKE', 'Nike', 'stock', ['Nike']),
  S('BA', 'Boeing', 'stock', ['Boeing'], { tickerInText: false }),
  S('GS', 'Goldman Sachs', 'stock', ['Goldman Sachs', 'Goldman'], { tickerInText: false }),
  S('IBM', 'IBM', 'stock', ['IBM']),
  S('CAT', 'Caterpillar', 'stock', ['Caterpillar'], { tickerInText: false }),
  S('QCOM', 'Qualcomm', 'stock', ['Qualcomm']),
  S('MU', 'Micron', 'stock', ['Micron'], { tickerInText: false }),
  S('INTC', 'Intel', 'stock', ['Intel']),
  S('AMD', 'AMD', 'stock', ['Advanced Micro Devices']),
  S('PLTR', 'Palantir', 'stock', ['Palantir']),
  S('COIN', 'Coinbase', 'stock', ['Coinbase'], { tickerInText: false }),
  S('MSTR', 'Strategy (MicroStrategy)', 'stock', ['MicroStrategy', 'Saylor']),
  S('SMCI', 'Super Micro Computer', 'stock', ['Super Micro', 'Supermicro']),
  S('UBER', 'Uber', 'stock', ['Uber'], { tickerInText: false }),
  S('SHOP', 'Shopify', 'stock', ['Shopify'], { tickerInText: false }),
  S('HOOD', 'Robinhood', 'stock', ['Robinhood'], { tickerInText: false }),
  S('ARM', 'Arm Holdings', 'stock', ['Arm Holdings'], { tickerInText: false }),
  S('SPY', 'SPDR S&P 500 ETF', 'etf'),
  S('QQQ', 'Invesco QQQ (Nasdaq 100)', 'etf'),
  S('DIA', 'SPDR Dow Jones ETF', 'etf', [], { tickerInText: false }),
  S('IWM', 'iShares Russell 2000 ETF', 'etf'),
  // Sectores (ETFs SPDR): de aquí salen los «movimientos por sector». `sector` es la clave del texto en i18n.
  S('XLK', 'Technology Select Sector SPDR', 'sector', [], { sector: 'tech' }),
  S('XLF', 'Financial Select Sector SPDR', 'sector', [], { sector: 'fin' }),
  S('XLE', 'Energy Select Sector SPDR', 'sector', [], { sector: 'energy' }),
  S('XLV', 'Health Care Select Sector SPDR', 'sector', [], { sector: 'health' }),
  S('XLY', 'Consumer Discretionary Select Sector SPDR', 'sector', [], { sector: 'disc' }),
  S('XLP', 'Consumer Staples Select Sector SPDR', 'sector', [], { sector: 'staples' }),
  S('XLI', 'Industrial Select Sector SPDR', 'sector', [], { sector: 'ind' }),
  S('XLU', 'Utilities Select Sector SPDR', 'sector', [], { sector: 'util' }),
  S('XLB', 'Materials Select Sector SPDR', 'sector', [], { sector: 'mat' }),
  S('XLRE', 'Real Estate Select Sector SPDR', 'sector', [], { sector: 're' }),
  S('XLC', 'Communication Services Select Sector SPDR', 'sector', [], { sector: 'comm' }),
  // México: CNBC no devuelve la BMV (*.MX); estas son las ADR que cotizan en EE. UU.
  S('AMX', 'América Móvil (ADR)', 'adr', ['América Móvil', 'America Movil']),
  S('FMX', 'FEMSA (ADR)', 'adr', ['FEMSA(?! Coca)', 'Femsa(?! Coca)']),
  S('KOF', 'Coca-Cola FEMSA (ADR)', 'adr', ['Coca-Cola [Ff][Ee][Mm][Ss][Aa]']),
  S('CX', 'Cemex (ADR)', 'adr', ['Cemex'], { tickerInText: false }),
];

export const DEFAULT_WATCHLIST = ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'SPY', 'QQQ'];

// Forex y macro (símbolos de CNBC). `asset`: la moneda o activo que representa en las fichas de noticias.
export const FX_PAIRS = [
  { sym: 'EUR=', label: 'EUR/USD', asset: 'EUR' },
  { sym: 'GBP=', label: 'GBP/USD', asset: 'GBP' },
  { sym: 'JPY=', label: 'USD/JPY', asset: 'JPY' },
  { sym: 'MXN=', label: 'USD/MXN', asset: 'MXN' },
  { sym: 'AUD=', label: 'AUD/USD', asset: 'AUD' },
  { sym: 'CAD=', label: 'USD/CAD', asset: 'CAD' },
  { sym: 'CHF=', label: 'USD/CHF', asset: 'CHF' },
  { sym: 'EURJPY=', label: 'EUR/JPY', asset: null },
  { sym: 'CADJPY=', label: 'CAD/JPY', asset: null },
];
export const MACRO = [
  { sym: '.DXY', label: 'DXY', asset: 'USD' },
  { sym: 'US10Y', label: 'US 10Y', asset: 'US10Y' },
  { sym: '@GC.1', label: 'Gold', asset: 'XAU' },
  { sym: '@CL.1', label: 'WTI', asset: 'OIL' },
];

// Series de precio que guarda la Action en cada corrida (≈15 min) para mini-gráficas y reacciones.
// Clave de la serie = símbolo de CNBC; las cripto usan BTC/ETH/SOL (precio de CoinGecko).
export const SNAPSHOT = { maxDays: 7, maxPoints: 800, coverMin: 30 };
export const CRYPTO_SNAP = [
  { key: 'BTC', id: 'bitcoin' },
  { key: 'ETH', id: 'ethereum' },
  { key: 'SOL', id: 'solana' },
];

// Activo de una ficha → serie con la que se mide la reacción observada.
// Monedas: el par contra el dólar (USD/JPY sube cuando el yen se debilita; por eso se muestra el par, no «JPY»).
export const ASSET_SERIES = {
  USD: '.DXY', EUR: 'EUR=', GBP: 'GBP=', JPY: 'JPY=', MXN: 'MXN=', AUD: 'AUD=', CAD: 'CAD=', CHF: 'CHF=',
  SPX: '.SPX', NDX: '.IXIC', DJI: '.DJI', RUT: '.RUT', IPC: '.MXX', XAU: '@GC.1', OIL: '@CL.1',
  BTC: 'BTC', ETH: 'ETH', SOL: 'SOL',
};

// Diccionario de activos que no son acciones (cripto, monedas, bancos centrales, índices, materias primas).
// Cada `re` es una expresión regular (con mayúsculas tal cual) que se busca en título + resumen.
export const ASSET_WORDS = [
  { asset: 'BTC', re: '\\b(Bitcoin|bitcoin|BTC)\\b' },
  { asset: 'ETH', re: '\\b(Ethereum|Ether|ether|ETH)\\b' },
  { asset: 'SOL', re: '\\b(Solana|SOL)\\b' },
  { asset: 'XRP', re: '\\b(XRP|Ripple)\\b' },
  { asset: 'DOGE', re: '\\b(Dogecoin|DOGE)\\b' },
  { asset: 'BNB', re: '\\b(BNB)\\b' },
  { asset: 'ADA', re: '\\b(Cardano|ADA)\\b' },
  { asset: 'USD', re: '(\\b(U\\.S\\. dollar|US dollar|greenback|USD|DXY)\\b|(?<!(Australian|Canadian|New Zealand|Hong Kong|Singapore|Taiwan) )\\b[Dd]ollar\\b|\\b[Dd]ólar(?! (australiano|canadiense|neozelandés)))' },
  { asset: 'USD', re: '\\b(US|U\\.S\\.|EE\\. ?UU\\.|Estados Unidos)(?!\\p{L})', weak: true }, // débil: cuenta en títulos, no en resúmenes («US prosecutors» no es el dólar)
  { asset: 'USD', re: '\\b(Fed|FOMC|Federal Reserve|Powell|Reserva Federal)\\b' },
  { asset: 'EUR', re: '\\b(euro|Euro|EUR|EU|[Ee]urozone|ECB|Lagarde|BCE)\\b' },
  { asset: 'GBP', re: '\\b(pound|[Ss]terling|GBP|BoE|Bank of England|libra esterlina)\\b' },
  { asset: 'JPY', re: '\\b(yen|Yen|JPY|BoJ|BOJ|Bank of Japan|Ueda)\\b' },
  { asset: 'MXN', re: '\\b(Mexican peso|peso mexicano|[Pp]eso|MXN|Banxico|Banco de México|Mexico|México)\\b' },
  { asset: 'CAD', re: '\\b(Canadian [Dd]ollar|[Dd]ólar canadiense|loonie|CAD|BoC|Bank of Canada)\\b' },
  { asset: 'AUD', re: '\\b(Australian [Dd]ollar|[Dd]ólar australiano|Aussie|AUD|RBA|Reserve Bank of Australia)\\b' },
  { asset: 'NZD', re: '\\b(New Zealand [Dd]ollar|[Dd]ólar neozelandés|Kiwi|NZD|RBNZ)\\b' },
  { asset: 'CHF', re: '\\b(Swiss franc|CHF|SNB|Swiss National Bank)\\b' },
  { asset: 'CNY', re: '\\b(yuan|Yuan|CNY|PBOC|PBoC|renminbi|China|Chinese)\\b' },
  { asset: 'SPX', re: '(S&P 500|S&P|\\bSPX\\b|Wall Street|Wall St\\b|U\\.S\\. stocks|US stocks|[Ss]tock market)' },
  { asset: 'NDX', re: '\\b(Nasdaq)\\b' },
  { asset: 'DJI', re: '\\b(Dow Jones|Dow)\\b' },
  { asset: 'RUT', re: '\\b(Russell 2000|small caps|small-caps?)\\b' },
  { asset: 'IPC', re: '\\b(BMV|Bolsa Mexicana)\\b' },
  { asset: 'XAU', re: '\\b(gold|Gold|XAU|oro|Oro)\\b' },
  { asset: 'OIL', re: '\\b(oil|Oil|crude|Crude|WTI|Brent|OPEC|petróleo)\\b' },
  { asset: 'US10Y', re: '\\b(Treasury yields?|Treasuries|10-year|bond yields?)\\b' },
];

// Etiqueta corta de cada activo en las fichas (las acciones usan su símbolo).
export const ASSET_LABELS = { SPX: 'S&P 500', NDX: 'Nasdaq', DJI: 'Dow', RUT: 'Russell 2K', IPC: 'IPC MX', XAU: 'Gold', OIL: 'Oil', US10Y: 'US 10Y' };

// Reacción observada (en %) a partir de la cual una historia sube un nivel de impacto.
export const REACTION_BUMP = { stock: 3, index: 1, fx: 0.5, crypto: 3, commodity: 2 };
