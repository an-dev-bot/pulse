// Textos de la interfaz. Las noticias se muestran en su idioma original.
// Regla: ningún texto recomienda comprar o vender. Lo pagado se llama «Promocionado».
export const STRINGS = {
  es: {
    'tab.live': 'En vivo', 'tab.memes': 'Memes', 'tab.crypto': 'Cripto', 'tab.forex': 'Forex', 'tab.stocks': 'Acciones', 'tab.tweets': 'Tuits', 'tab.saved': 'Guardados',
    'title.live': 'En vivo', 'title.memes': 'Memecoins', 'title.crypto': 'Cripto', 'title.forex': 'Forex', 'title.stocks': 'Acciones', 'title.tweets': 'Tuits', 'title.saved': 'Guardados',
    'm.all': 'Todo', 'm.meme': 'Memes', 'm.crypto': 'Cripto', 'm.forex': 'Forex', 'm.stocks': 'Acciones',
    'updated': 'Actualizado {t}', 'updated.never': 'Sin datos todavía', 'offline': 'Sin conexión · mostrando lo último guardado',
    'delayed': 'con retraso', 'new.n': '{n} nuevas ↑', 'refreshed': 'Hay datos nuevos ↑',
    'search': 'Buscar', 'search.ph': 'Buscar en todo lo cargado…', 'search.none': 'Nada coincide.', 'close': 'Cerrar',
    'settings': 'Ajustes', 'save': 'Guardar', 'unsave': 'Quitar de guardados', 'read': 'Marcar leída', 'unread': 'Marcar no leída',
    'more': 'Ver más', 'empty.news': 'Aún no hay noticias aquí.', 'empty.saved': 'Toca ☆ en una noticia para guardarla aquí.',
    'news': 'Noticias', 'prices': 'Precios principales', 'indices': 'Índices', 'calendar': 'Calendario económico de la semana',
    'cal.next': 'Próximo evento de alto impacto', 'cal.none': 'No quedan eventos de alto impacto esta semana.', 'cal.in': 'en {t}',
    'cal.tz': 'Hora de Ciudad de México', 'cal.f': 'Pronóstico', 'cal.p': 'Anterior', 'cal.a': 'Real', 'cal.high': 'Alto', 'cal.medium': 'Medio', 'cal.low': 'Bajo', 'cal.holiday': 'Feriado',
    'cal.past': 'Mostrar pasados', 'cal.short': 'Calendario', 'cal.today': 'Hoy',
    'meme.new': 'Nuevos', 'meme.gainers': 'Más suben', 'meme.volume': 'Más volumen', 'meme.promoted': 'Promocionados',
    'meme.chain': 'Cadena', 'meme.all': 'Todas', 'meme.price': 'Precio', 'meme.vol': 'Vol 24 h', 'meme.liq': 'Liquidez', 'meme.age': 'Edad', 'meme.chg': '24 h',
    'meme.promo': 'Promocionado', 'meme.promo.note': 'Los «boosts» de DEX Screener son pagados por quien promueve la moneda. Aquí solo se muestran como promocionados.',
    'meme.lowliq': 'Liquidez muy baja', 'meme.young': '{h} de vida', 'meme.risk': 'Revisar riesgo', 'meme.dex': 'DEX Screener',
    'meme.news': 'Noticias de memecoins', 'meme.loading': 'Cargando monedas…', 'meme.error': 'No se pudo cargar esta lista ahora. Se reintentará sola.',
    'meme.disclaimer': 'Información, no recomendación. Las memecoins pueden perder todo su valor.',
    'tw.intro': 'X cobra por sus datos, así que aquí tienes un botón por cada lista que agregues en Ajustes.',
    'tw.none': 'Aún no agregas listas de X. Ve a Ajustes → Listas de X.', 'tw.open': 'Abrir en X', 'tw.embed': 'Ver aquí',
    'tw.embed.fail': 'X no deja mostrar esta lista aquí. Ábrela en X.', 'tw.embed.note': 'Al tocar «Ver aquí», X recibe el enlace de esa lista.',
    'set.lang': 'Idioma', 'set.kw': 'Palabras clave', 'set.kw.help': 'Las noticias que las mencionen se resaltan y te avisan dentro de la app.',
    'set.kw.ph': 'p. ej. Fed, Solana, CPI', 'add': 'Agregar', 'remove': 'Quitar',
    'set.lists': 'Listas de X', 'set.lists.help': 'Nombre y enlace de cada lista (x.com/i/lists/…). Se guardan solo en este teléfono.',
    'set.lists.name': 'Nombre', 'set.lists.url': 'Enlace de la lista', 'set.lists.bad': 'El enlace debe ser de x.com o twitter.com.',
    'set.data': 'Tus datos', 'set.data.help': 'Listas, palabras clave, guardados y leídos viven solo en este teléfono.',
    'set.export': 'Exportar', 'set.import': 'Importar', 'set.import.ok': 'Datos importados.', 'set.import.bad': 'Ese archivo no es un respaldo válido.',
    'set.clearread': 'Borrar leídos', 'set.sources': 'Estado de fuentes', 'set.about': 'Acerca de',
    'set.about.text': '{name} reúne titulares con enlace al original y datos de mercado. Informa, no recomienda. Datos: CoinGecko, GeckoTerminal, DEX Screener, CNBC, Forex Factory y los medios citados.',
    'src.ok': 'bien', 'src.fail': 'falla',
    'kw.toast': 'Palabra clave «{k}»', 'kw.many': '{n} noticias mencionan tus palabras clave',
    'ago.now': 'ahora', 'h': '{n} h', 'min': '{n} min', 'd': '{n} d',
  },
  en: {
    'tab.live': 'Live', 'tab.memes': 'Memes', 'tab.crypto': 'Crypto', 'tab.forex': 'Forex', 'tab.stocks': 'Stocks', 'tab.tweets': 'Posts', 'tab.saved': 'Saved',
    'title.live': 'Live', 'title.memes': 'Memecoins', 'title.crypto': 'Crypto', 'title.forex': 'Forex', 'title.stocks': 'Stocks', 'title.tweets': 'Posts', 'title.saved': 'Saved',
    'm.all': 'All', 'm.meme': 'Memes', 'm.crypto': 'Crypto', 'm.forex': 'Forex', 'm.stocks': 'Stocks',
    'updated': 'Updated {t}', 'updated.never': 'No data yet', 'offline': 'Offline · showing the last saved data',
    'delayed': 'delayed', 'new.n': '{n} new ↑', 'refreshed': 'New data ↑',
    'search': 'Search', 'search.ph': 'Search everything loaded…', 'search.none': 'No matches.', 'close': 'Close',
    'settings': 'Settings', 'save': 'Save', 'unsave': 'Remove from saved', 'read': 'Mark read', 'unread': 'Mark unread',
    'more': 'Show more', 'empty.news': 'No news here yet.', 'empty.saved': 'Tap ☆ on a story to keep it here.',
    'news': 'News', 'prices': 'Top prices', 'indices': 'Indices', 'calendar': 'Economic calendar this week',
    'cal.next': 'Next high-impact event', 'cal.none': 'No high-impact events left this week.', 'cal.in': 'in {t}',
    'cal.tz': 'Mexico City time', 'cal.f': 'Forecast', 'cal.p': 'Previous', 'cal.a': 'Actual', 'cal.high': 'High', 'cal.medium': 'Medium', 'cal.low': 'Low', 'cal.holiday': 'Holiday',
    'cal.past': 'Show past', 'cal.short': 'Calendar', 'cal.today': 'Today',
    'meme.new': 'New', 'meme.gainers': 'Top gainers', 'meme.volume': 'Top volume', 'meme.promoted': 'Promoted',
    'meme.chain': 'Chain', 'meme.all': 'All', 'meme.price': 'Price', 'meme.vol': 'Vol 24h', 'meme.liq': 'Liquidity', 'meme.age': 'Age', 'meme.chg': '24h',
    'meme.promo': 'Promoted', 'meme.promo.note': 'DEX Screener “boosts” are paid for by whoever promotes the coin. They are only shown here as promoted.',
    'meme.lowliq': 'Very low liquidity', 'meme.young': '{h} old', 'meme.risk': 'Check risk', 'meme.dex': 'DEX Screener',
    'meme.news': 'Memecoin news', 'meme.loading': 'Loading coins…', 'meme.error': 'This list could not load right now. It will retry on its own.',
    'meme.disclaimer': 'Information, not advice. Memecoins can lose all their value.',
    'tw.intro': 'X charges for its data, so here is one button for each list you add in Settings.',
    'tw.none': 'No X lists yet. Go to Settings → X lists.', 'tw.open': 'Open in X', 'tw.embed': 'Show here',
    'tw.embed.fail': 'X does not allow showing this list here. Open it in X.', 'tw.embed.note': 'Tapping “Show here” sends that list link to X.',
    'set.lang': 'Language', 'set.kw': 'Keywords', 'set.kw.help': 'Stories that mention them are highlighted and trigger an in-app alert.',
    'set.kw.ph': 'e.g. Fed, Solana, CPI', 'add': 'Add', 'remove': 'Remove',
    'set.lists': 'X lists', 'set.lists.help': 'Name and link of each list (x.com/i/lists/…). Stored only on this phone.',
    'set.lists.name': 'Name', 'set.lists.url': 'List link', 'set.lists.bad': 'The link must be from x.com or twitter.com.',
    'set.data': 'Your data', 'set.data.help': 'Lists, keywords, saved and read items live only on this phone.',
    'set.export': 'Export', 'set.import': 'Import', 'set.import.ok': 'Data imported.', 'set.import.bad': 'That file is not a valid backup.',
    'set.clearread': 'Clear read', 'set.sources': 'Source status', 'set.about': 'About',
    'set.about.text': '{name} gathers headlines linking to the original plus market data. It informs, it does not advise. Data: CoinGecko, GeckoTerminal, DEX Screener, CNBC, Forex Factory and the cited outlets.',
    'src.ok': 'ok', 'src.fail': 'failing',
    'kw.toast': 'Keyword “{k}”', 'kw.many': '{n} stories mention your keywords',
    'ago.now': 'now', 'h': '{n}h', 'min': '{n}m', 'd': '{n}d',
  },
};

let lang = 'es';
export function setLang(l) {
  lang = STRINGS[l] ? l : 'es';
  document.documentElement.lang = lang;
}
export function getLang() {
  return lang;
}
export function t(key, vars) {
  let s = STRINGS[lang][key] ?? STRINGS.es[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}
