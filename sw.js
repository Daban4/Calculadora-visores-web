const CACHE_NAME = 'visor-cache-v4';
const urlsToCache = [
  './index.html',
  './style.css',
  './app.js',
  './icon.png',
  './manifest.json',
  './github_logo.png'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Forzar la activación inmediata
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

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
