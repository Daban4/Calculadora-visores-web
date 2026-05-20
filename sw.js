const CACHE_NAME = 'visor-cache-v6';
const urlsToCache = [
  './index.html',
  './style.css',
  './app.js',
  './icon.png',
  './manifest.json',
  './github_logo.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// ESTRATEGIA: RED PRIMERO, LUEGO CACHÉ (Para archivos críticos)
self.addEventListener('fetch', event => {
  const isCritical = urlsToCache.some(url => event.request.url.includes(url.replace('./', '')));
  
  if (isCritical) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
  } else {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then(response => response || fetch(event.request))
    );
  }
});
