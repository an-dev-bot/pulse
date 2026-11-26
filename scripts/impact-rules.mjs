// Reglas de impacto. Están aquí para que sea fácil ajustarlas sin tocar el resto del código.
// Cada regla: id (también la clave del texto «Por qué importa» en app/js/i18n.js → why.<id>), nivel y patrón.
// El patrón se busca en el TÍTULO (y en el resumen si `inSummary`). Sin banderas: se usa /i.
// `needs`: la regla solo aplica si la historia toca uno de esos grupos de activos (ver GROUPS).
// Gana la regla de nivel más alto; después pueden subir un nivel el calendario, las fuentes y la reacción observada.
// Nada de esto predice dirección: solo dice qué suele moverse.

export const LEVELS = ['low', 'medium', 'high'];

// Grupos de activos que usan las reglas con `needs`.
export const GROUPS = {
  top: ['BTC', 'ETH', 'SOL', 'XRP', 'NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AVGO', 'BRK.B'],
  mega: ['NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AVGO', 'BRK.B'],
  crypto: ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'COIN', 'MSTR', 'HOOD'],
};

export const RULES = [
  // ---------- High ----------
  { id: 'rates', level: 'high', re: '\\b(rate decision|rates? (hike|cut)s?|(hikes?|cuts?|holds?|raises?|lowers?|keeps?|leaves?) (interest )?rates|interest[- ]rate decision|policy decision|FOMC (decision|statement)|decisión de (política monetaria|tasas)|(recorte|alza|aumento) de tasas?|(recorta|sube|mantiene) (la )?tasas?)\\b' },
  { id: 'inflation', level: 'high', re: '\\b(CPI|PCE|consumer price|inflation (data|report|rate|rises?|falls?|cools?|eases?|accelerates?|hits|jumps?|slows?)|inflación|INPC)\\b' },
  { id: 'jobs', level: 'high', re: '\\b(nonfarm|non-farm|payrolls|NFP|jobs report|unemployment rate|jobless rate|nóminas no agrícolas|tasa de desempleo)\\b' },
  { id: 'gdp', level: 'high', re: '\\b(GDP|PIB|gross domestic product)\\b' },
  { id: 'tariffs', level: 'high', re: '\\b(tariffs?|aranceles?|sanctions?|sanciones|trade war|guerra comercial|export (ban|controls?))\\b' },
  { id: 'default', level: 'high', re: '\\b(bankrupt\\w*|Chapter 11|insolven\\w*|defaults? on|debt default|quiebra|impago)\\b' },
  { id: 'hack', level: 'high', re: '\\b(hack(ed|er|ers)?|exploit(ed)?|drained|stolen|heist|breach)\\b', needsWord: 'crypto' },
  { id: 'etf', level: 'high', re: '(\\bETFs?\\b.*\\b(approv\\w*|reject\\w*|den(y|ies|ied|ial)|green ?light\\w*)|\\b(approv\\w*|reject\\w*|den(y|ies|ied)|green ?light\\w*)\\b.*\\bETFs?\\b)' },
  { id: 'enforcement', level: 'high', re: '\\b(SEC (sues|charges)|sued by|lawsuit|indict\\w*|DOJ|Justice Department|enforcement action|antitrust|fined|penalty|demanda)\\b', needs: ['top', 'crypto'] }, // grandes nombres o cripto (p. ej. «SEC sues Coinbase»)
  { id: 'megaEarnings', level: 'high', re: '\\b(earnings|results|quarterly|guidance|outlook|revenue|beats?|miss(es)?|forecasts?|Q[1-4])\\b', needs: 'mega' },
  // ---------- Medium ----------
  { id: 'earnings', level: 'medium', re: '\\b(earnings|quarterly results|guidance|revenue|profit|EPS|beats? estimates|miss(es)? estimates|reportes? trimestral(es)?|utilidades)\\b' },
  { id: 'regulation', level: 'medium', re: '\\b(bill|regulat\\w*|regulación|proposal|propuesta|framework|MiCA|legislation|Congress|Senate|lawmakers|rulemaking|ley)\\b' },
  // «upgrade» solo cuenta como de analista si luego dice a qué (to/rating/stock): «network upgrade» no es una recomendación.
  { id: 'analyst', level: 'medium', re: '(\\b(up|down)grade[sd]?\\b(?=[^.]*\\b(to|rating|stock|shares)\\b)|\\b(price target|initiates? coverage|rating (cut|raised)|overweight|underweight|outperform|underperform)\\b)' },
  { id: 'macro', level: 'medium', re: '\\b(Fed|FOMC|ECB|BoE|BoJ|Banxico|central bank|banco central|Powell|Lagarde|minutes|yields?|Treasur(y|ies)|bond market|recession|recesión|PMI|retail sales|ventas minoristas|ISM|jobless claims|housing starts|consumer confidence|speech|discurso)\\b' },
  // ---------- Low ----------
  { id: 'feature', level: 'low', re: '(\\b(how to|what is|what are|explained|explainer|guide|opinion|op-ed|podcast|newsletter|recap|interview|review|tips|cómo|qué es|guía|opinión)\\b|\\?$)' },
];

// P2.1: «alto» pide algo que ya pasó. Un título que solo comenta o anticipa (apuestas, «ahead of», «outlook»,
// «stays below»…) se queda en «medio» salvo que haya un evento del calendario a ±2 h o una reacción del precio.
// EVENT: decisión, dato publicado, fallo, acuerdo, quiebra, aprobación, demanda o hackeo que ya ocurrió.
// Un verbo precedido de «to / will / could / may / expected to…» es una previsión, no un evento.
const NOT_YET = '(?<!\\b(to|will|could|may|might|would|set to|expected to|likely to|poised to|va a|podría) )';
export const EVENT = NOT_YET + '\\b(' + [
  '(raise[sd]?|hike[sd]?|cuts?|holds?|held|keeps?|kept|lower(s|ed)?|leaves?|left|slash(es|ed)?|trims?|trimmed) (its |the |key |benchmark |interest |policy |overnight )*(rates?|tasas?)',
  'holds steady|stands? pat|leaves? policy unchanged',
  '(recorta|recortó|sube|subió|eleva|elevó|mantiene|mantuvo|baja|bajó) (la |las |su |sus )?(tasas?|tipos?)',
  'beat(s)?|miss(es|ed)|tops? estimates|topped|(jobs )?added|adds \\d',
  'fil(es|ed) (for|a |suit|lawsuit)|agree[sd]? to|settles?|settled|settlement',
  'approv(es|ed)|greenlights?|green-lights?|reject(s|ed)|den(ies|ied)|aprueba|aprobó|rechaza',
  'ruled|ruling|court rules|verdict|fallo',
  'sues|sued|charge[sd]|indicted|fined|convicted|pleads? guilty|arrested|demanda a|multa',
  'hacked|exploited|drained|stolen|breached|hackeo',
  'announce[sd]?|impose[sd]?|unveil(s|ed)|sign(s|ed)|anuncia|impone',
  'defaults? on|defaulted|declares? bankruptcy|bankruptcy filing|enters? Chapter 11|se declara en quiebra',
  '(report(s|ed)|post(s|ed)) (record|a |quarterly|Q[1-4]|\\$)',
  '[-+]?\\d[\\d.,]*\\s?[%KMB]?( [mqy]/[mqy]| YoY| MoM)? vs\\.? [-+]?\\d[\\d.,]*\\s?[%KMB]?( [mqy]/[mqy])? ?(estimated?|expected|forecast|consensus|prior|previous)',
].join('|') + ')\\b';
// Un dato publicado con su cifra («CPI rises 0.3%», «sube a 4.5%»): el verbo va pegado al nombre del dato.
// En «hot PCE data as Nasdaq drops 4%» la cifra es del precio (después de «as»), no un evento.
export const DATA_EVENT = '(CPI|PCE|inflation|inflación|INPC|GDP|PIB|payrolls|nonfarm|non-farm|NFP|unemployment|jobless|desempleo|price index|inflation gauge)\\b((?!\\b(as|amid|while|after|on|but|mientras|tras)\\b)[^,;:])*?\\b(rises?|rose|falls?|fell|grows?|grew|jumps?|jumped|slows?|slowed|climbs?|climbed|drops?|dropped|eases?|eased|cools?|cooled|accelerates?|accelerated|increases?|increased|declines?|declined|contracts?|contracted|expands?|expanded|edges? (up|down)|ticks? (up|down)|comes? in|came in|lands?|landed|sube|baja|cae|crece|repunta|se acelera)( to| a| by| at| en)? [-+]?\\d[\\d.,]*\\s?%';
export const DATA_RULES = ['inflation', 'jobs', 'gdp', 'macro'];
// Comentario o previa: si el título no trae un evento, se queda en «medio» como mucho, aunque haya calendario o reacción.
export const COMMENTARY = '\\b(bets?|ahead of|outlook|expectations?|weighs?|stays?|steady|steadies|falters?|extends?|range|preview|due|could|may|might|eyes|awaits?|in focus|braces?|priced in|to blame|worst-case|scenario|seen|what to (watch|expect)|apuestas|perspectivas?|se mantiene|antes de|rango|podría|se espera|se prevé)\\b';

// Palabras que dicen que un hackeo es del mundo cripto (para no subir a «alto» un hackeo de otra cosa).
export const CRYPTO_WORD = '\\b(crypto|cripto|exchange|DeFi|protocol|bridge|wallet|token|Bitcoin|Ethereum|Solana|blockchain|on-chain|stablecoin)\\b';

// El orden «Top» (impacto × recencia + fuentes + lo personal) se calcula en el dispositivo: ver RANK en app/js/config.js.

// Cuántas fuentes hacen que una historia suba un nivel.
export const SOURCES_BUMP = 4;
// Ventana del calendario: un evento de alto impacto a ±2 h de la noticia, de la misma moneda.
export const CALENDAR_WINDOW_H = 2;
// Agrupación: ventana y umbral de parecido de títulos.
export const GROUP = { windowHours: 72, minShared: 3, overlap: 0.6, jaccard: 0.45 };
// Una historia que vuelve a salir pasado este tiempo se marca como «repetida».
export const REPEAT_AFTER_H = 6;
