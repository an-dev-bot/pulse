// Service worker: guarda la app para abrir sin internet. Los datos (data/*.json) los guarda la propia página (Cache API).
const VERSION = '__VERSION__';
const SHELL = __SHELL__;
const CACHE = 'p1-shell-' + VERSION;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('p1-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // lo externo va directo
  // Datos: siempre a la red; la página guarda la última copia y la usa si no hay internet.
  if (url.pathname.includes('/data/')) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(caches.match('./index.html', { ignoreSearch: true }).then((r) => r || fetch(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
