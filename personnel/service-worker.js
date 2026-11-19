/* Scope is this folder only (./), so a copy hosted at
 * /FortMeadeEFCFacilityManager/personnel/ does not control the parent site.
 * Only caches named personnel-management- are created or deleted here,
 * so this worker cannot wipe the parent EFC cache.
 */
var CACHE_NAME = 'personnel-management-v3';

var CORE_FILES = [
  './',
  './index.html',
  './login.html',
  './status.html',
  './leave.html',
  './personnel.html',
  './manifest.json',
  './css/app.css',
  './js/config.js',
  './js/dom.js',
  './js/api.js',
  './js/session.js',
  './js/brand.js',
  './js/access.js',
  './js/home.js',
  './js/login.js',
  './js/status.js',
  './js/leave.js',
  './js/personnel.js',
  './js/logic/dates.js',
  './js/logic/eastern.js',
  './js/logic/auth.js',
  './js/logic/manning.js',
  './js/logic/personnel-metrics.js',
  './js/logic/leave.js',
  './mock/backend.js',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CORE_FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key.indexOf('personnel-management-') === 0 && key !== CACHE_NAME;
      }).map(function (key) {
        return caches.delete(key);
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  var scopePath = new URL('./', self.location.href).pathname;
  if (scopePath.charAt(scopePath.length - 1) !== '/') scopePath += '/';
  if (url.pathname.indexOf(scopePath) !== 0) return;

  event.respondWith(
    fetch(event.request).then(function (response) {
      if (response && response.status === 200 && response.type === 'basic') {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, copy);
        });
      }
      return response;
    }).catch(function () {
      return caches.match(event.request);
    })
  );
});
