/* STBCOr Gestión de Aulas · Service Worker */
const CACHE_VERSION = 'stbcor-gestion-v1.0.0';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/config.js',
  './js/api.js',
  './js/app.js',
  './js/pwa.js',
  './assets/logo.png',
  './assets/stbcor-gestion-icon.svg',
  './assets/stbcor-gestion-maskable.svg',
  './vendor/fonts/fonts.css',
  './vendor/fonts/merriweather-latin-400-normal.woff2',
  './vendor/fonts/merriweather-latin-700-normal.woff2',
  './vendor/fonts/open-sans-latin-400-normal.woff2',
  './vendor/fonts/open-sans-latin-600-normal.woff2',
  './vendor/fonts/open-sans-latin-700-normal.woff2',
  './vendor/fa/all.min.css',
  './vendor/fa/webfonts/fa-brands-400.woff2',
  './vendor/fa/webfonts/fa-regular-400.woff2',
  './vendor/fa/webfonts/fa-solid-900.woff2'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(SHELL_FILES)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('stbcor-gestion-') && key !== CACHE_VERSION).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/functions/v1/') || url.pathname.includes('/rest/v1/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_VERSION);
        cache.put('./index.html', response.clone());
        return response;
      } catch (_) {
        return (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  if (url.pathname.includes('/recursos/')) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      const fresh = fetch(request).then(response => {
        if (response && response.ok) caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone()));
        return response;
      }).catch(() => cached);
      return cached || fresh;
    })());
    return;
  }

  const isShellAsset = /\.(?:css|js|woff2|png|svg|webmanifest)$/i.test(url.pathname) || url.pathname.endsWith('/index.html');
  if (!isShellAsset) return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  })());
});
