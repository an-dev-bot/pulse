# P1 · noticias de trading en un solo lugar

PWA personal para el teléfono: memecoins, cripto, forex, acciones, calendario económico y listas de X.
Sin servidor propio, sin cuentas, sin claves de API, sin anuncios. Se publica gratis en GitHub Pages.
El nombre de la app vive solo en `app/js/config.js` (`APP.name`).

## Cómo funciona

| Qué | Cómo llega | Cada cuánto |
| --- | --- | --- |
| Noticias (RSS), calendario de Forex Factory, índices | Una GitHub Action los junta y los publica como JSON junto con la app (`data/*.json`) | cada 15 min (GitHub puede atrasarla un poco) |
| BTC/ETH/SOL y precios principales | El teléfono los pide directo a CoinGecko (permite CORS) | cada 60 s |
| Memecoins (nuevos, más suben, más volumen) | Directo a GeckoTerminal | cada 60 s con la pestaña abierta |
| Memecoins promocionadas | Directo a DEX Screener (`token-boosts`, son **pagadas** → «Promocionado») | cada 60 s con la pestaña abierta |

Lo personal (listas de X, palabras clave, guardados, leídos, idioma) vive solo en el `localStorage` del teléfono.
Ninguna petición lo manda. Se respalda con **Ajustes → Exportar / Importar**.

Sin internet la app abre con lo último guardado (service worker para la app; Cache API y `localStorage` para los datos),
y cada sección dice cuándo se actualizó.

## Fuentes

Noticias (solo título, fuente, hora, una línea de resumen y enlace al original):

- Cripto: CoinDesk, Cointelegraph, Decrypt, The Block
- Memecoins: Cointelegraph (etiqueta memecoin) + noticias de cripto que mencionan memecoins
- Forex: FXStreet (inglés), FXStreet en español, investingLive (antes ForexLive)
- Acciones: CNBC (portada y mercados), MarketWatch
- Calendario: archivo público semanal de Forex Factory (`nfs.faireconomy.media/ff_calendar_thisweek.json`)
- Índices: servicio de cotizaciones de CNBC (S&P 500, Nasdaq, Dow, Russell 2000, IPC México, DXY, USD/MXN), siempre marcados «con retraso»

Descartadas: Stooq (bloquea descargas automáticas: 403/404), Yahoo Finance RSS (404 y sus condiciones no permiten
uso automatizado), Cointelegraph en español (410, ya no existe), El Economista y El Financiero (bloqueo / no es RSS).

## Comandos

```
npm install            # solo para las pruebas (playwright-core usa el Chrome o Edge que ya tienes)
npm run p1             # TODAS las pruebas (sin internet, con copias guardadas)
npm run p1:fuentes     # revisa las fuentes reales (con internet)
npm run p1:fixtures    # vuelve a guardar copias reales para las pruebas (recortadas: nunca artículos completos)
npm run p1:capturas    # capturas a 375 px en capturas/
npm run p1:local       # junta datos reales y sirve la app en http://127.0.0.1:8080/
```

## Publicarla (una sola vez)

1. En GitHub crea un repositorio **público** llamado `pulse` (github.com/new), sin README.
2. Sube esta carpeta desde PowerShell, dentro de `Desktop\pulse` (cambia `TU_USUARIO`):
   ```
   git init
   git add .
   git commit -m "Primera versión"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/pulse.git
   git push -u origin main
   ```
3. En el repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Pestaña **Actions**: si pide activarlas, actívalas. Abre «Datos y publicación» → **Run workflow**.
   En ~1 minuto queda en `https://TU_USUARIO.github.io/pulse/`. Desde ahí se actualiza sola cada 15 min.
5. Instalar en el teléfono:
   - **Android (Chrome):** abre la dirección → menú ⋮ → **Instalar app** (o «Agregar a la pantalla principal»).
   - **iPhone (Safari):** abre la dirección → botón Compartir → **Agregar a inicio**.

Nota: GitHub pausa las Actions programadas de un repo público si pasan 60 días sin cambios en el repo.
Si un día las noticias dejan de actualizarse, entra a **Actions** y vuelve a activarla (o haz cualquier cambio).

## Estructura

- `app/` la PWA (HTML, CSS y JS sin dependencias). `app/js/config.js` tiene el nombre y los ajustes.
- `scripts/collect.mjs` lo que corre la Action; `scripts/sources.mjs` la lista de fuentes; `scripts/build.mjs` arma `dist/`.
- `.github/workflows/datos.yml` la Action (cada 15 min + al subir cambios).
- `tests/` pruebas `p1-*` y copias guardadas de cada fuente en `tests/fixtures/`.
