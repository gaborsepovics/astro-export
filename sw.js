/* Astro Export service worker — network-first so updates always propagate,
   with a cache fallback for offline use. */
var CACHE = 'astro-export-v3';
var ASSETS = [
  './',
  './index.html',
  './css/styles.css?v=8',
  './js/astronomy.browser.min.js',
  './js/cities.js',
  './js/chiron.js',
  './js/astro.js?v=8',
  './js/app.js?v=8',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Network-first: always try the network (fresh content, new script tags, etc.);
// cache same-origin successes for offline; fall back to cache when offline.
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var sameOrigin = new URL(req.url).origin === self.location.origin;
  e.respondWith(
    fetch(req).then(function (res) {
      if (sameOrigin && res && res.status === 200) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        return hit || (sameOrigin ? caches.match('./index.html') : Response.error());
      });
    })
  );
});
