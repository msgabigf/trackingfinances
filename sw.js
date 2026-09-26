// Offline: the whole app is cached on install and served from the cache.
// Bump VERSION on every deploy so both phones pick up the new files.
const VERSION = 'gy-v1.0.2';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js', 'js/data.js', 'js/store.js', 'js/seed.js', 'js/sample.js',
  'js/core/calc.js', 'js/core/money.js', 'js/core/dates.js',
  'js/ui/chart.js', 'js/ui/dom.js', 'js/ui/forms.js', 'js/ui/icons.js', 'js/ui/overlay.js', 'js/ui/screens.js', 'js/ui/views.js',
  'assets/fonts/cormorant-garamond-latin-wght-normal.woff2',
  'assets/fonts/inter-latin-wght-normal.woff2',
  'assets/art/casal.png', 'assets/art/casal-mini.png',
  'assets/art/sketch/casa.png', 'assets/art/sketch/aviao.png', 'assets/art/sketch/mapa.png', 'assets/art/sketch/cartao.png',
  'assets/art/sketch/lampada.png', 'assets/art/sketch/hamburguer.png', 'assets/art/sketch/grafico.png',
  'assets/icons/apple-touch-icon.png', 'assets/icons/favicon.png',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Google Sheets sync goes straight to the network
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch(req, { signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(timer);
        if (res.ok) (await caches.open(VERSION)).put('index.html', res.clone());
        return res;
      } catch (err) {
        return (await caches.match('index.html')) || Response.error();
      }
    })());
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req)));
});
