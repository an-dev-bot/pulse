# Especificación: P1, Pulse (25-nov-2026)

App personal de la dueña: **todas las noticias de trading en un solo lugar** (memecoins, cripto, forex, acciones,
calendario económico y tuits). Proyecto aparte en `~/Desktop/pulse`; no toca ni reutiliza nada de Vero, Ghost Desk ni
Bows & Billions. El nombre **Pulse** vive en un solo lugar del código.

## Reglas
1. **PWA para el teléfono, publicada gratis en GitHub Pages**, instalable, rápida. Sin cuentas, sin claves de API, sin
   anuncios, sin cobros. Nada secreto en el repo (el repo es público).
2. **Sin servidor propio.** Lo que se pueda pedir directo desde el teléfono (APIs públicas que permiten CORS, como
   DEX Screener y CoinGecko) se pide directo. Lo que no (RSS de noticias, calendario, índices de acciones) lo junta una
   **GitHub Action programada** (cada 10–15 min; GitHub puede atrasarla un poco) que escribe archivos JSON y los publica
   en Pages junto con la app. Comprueba cada fuente antes de usarla; si una no responde o bloquea, se quita o se
   reemplaza, y se dice en el resumen. Nada de saltarse bloqueos ni de usar fuentes que lo prohíban.
3. **Noticias con respeto a los medios:** título, fuente, hora, una línea de resumen como máximo y el enlace al
   original. Nunca se copia el artículo completo.
4. **Neutral:** Pulse informa, no recomienda. Ningún texto dice comprar o vender. Lo promocionado se marca como
   promocionado (en DEX Screener los «boosts» son pagados: se etiquetan «Promocionado», nunca «Tendencia»).
5. **Estilo terminal oscuro y elegante:** fondo negro o casi negro, texto claro, acentos neón (verde para sube, rojo o
   rosa para baja, cian o violeta para lo seleccionado), fuente monoespaciada para números y horas, líneas finas,
   nada de sombras pesadas. Denso pero legible. Solo modo oscuro.
6. Español e inglés en la interfaz (Ajustes, sin recargar); las noticias se muestran en su idioma original.
7. Hecho para el pulgar: vertical, 375 y 320 px, botones de 44 px o más, el scroll nunca salta al llegar algo nuevo
   (aviso «N nuevas ↑» en vez de empujar la lista).
8. Lo personal (listas de X, palabras clave, guardados, leídos) vive solo en el teléfono, con exportar e importar.

## Pantallas
- **Barra de precios** arriba, siempre visible y deslizable: BTC, ETH, SOL y los índices principales de acciones y del
  dólar, con su cambio del día. Los que vengan con retraso dicen «con retraso».
- Pestañas:
  1. 🔥 **En vivo:** todo mezclado, lo más nuevo arriba, con una etiqueta de color por mercado. Filtro rápido por
     mercado.
  2. 🐸 **Memecoins:** nuevos lanzamientos, los que más suben, los de más volumen y los promocionados (marcados).
     Cadena a elegir; **Solana primero** y luego todas. Cada moneda: precio, cambio, volumen, liquidez, edad y botones
     a DEX Screener y a un revisor de riesgo (por ejemplo RugCheck en Solana). Avisos visibles cuando la liquidez es
     muy baja o la moneda tiene horas de vida. Más noticias de memecoins.
  3. 🪙 **Cripto:** noticias (CoinDesk, The Block, Cointelegraph, Decrypt u otras que funcionen) y precios principales.
  4. 💱 **Forex:** noticias y el **calendario económico** de la semana (el que usa Forex Factory si su archivo público
     funciona), con alto impacto en rojo, cuenta regresiva al siguiente evento fuerte y hora local de la dueña
     (Ciudad de México).
  5. 📊 **Acciones:** noticias de mercados y los índices.
  6. 🐦 **Tuits:** X cobra caro por sus datos, así que: un botón por cada lista privada de X que la dueña agregue en
     Ajustes (nombre + enlace), que abre la lista en X. Si el timeline incrustado de X carga, se muestra dentro; si
     no, solo el botón, sin errores feos.
  7. ⭐ **Guardados.**
- **Buscar** en todo lo cargado.
- **Palabras clave** (Ajustes): noticias que las mencionen se resaltan y suben un aviso dentro de la app.
- Marcar leído; las leídas se ven más apagadas.
- Cada sección dice cuándo se actualizó por última vez («hace 3 min»). Sin internet: muestra lo último guardado
  con su hora.

## Pruebas (prefijo `p1`, un solo comando)
1. Cada fuente configurada responde y se lee bien (en la prueba se usan copias guardadas, sin internet; aparte, un
   comando que revisa las fuentes reales).
2. La Action junta, quita duplicados, ordena por hora y escribe JSON válido; si una fuente falla, las demás siguen.
3. Ninguna noticia trae el artículo completo; todas traen enlace y fuente.
4. Los promocionados nunca salen como tendencia; ningún texto de la app recomienda comprar o vender.
5. Listas de X, palabras clave, guardados y leídos se quedan en el teléfono (ninguna petición los manda), y exportar
   e importar deja todo igual.
6. El scroll no salta al llegar noticias; 375 y 320 px sin nada fuera; botones de 44 px; los dos idiomas.
7. Sin internet abre con lo último; rapidez: abrir < 2 s y cambiar de pestaña < 150 ms con la CPU 4× más lenta.

## Entrega
Después de cada parte corre las pruebas. Al final manda un solo resumen con las fuentes que quedaron (y las que no y
por qué), capturas a 375 px en `capturas/` y los pasos para crear el repo `pulse`, activar Pages y la Action, e
instalarla en el teléfono. `.gitignore` con `capturas/` y `node_modules/`. **No hagas commit.**
