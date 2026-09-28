const CACHE_NAME = "facility-manager-v5";

const FILES_TO_CACHE = [
  // Visitor Counter
  "./Visitor Counter/index.html",
  "./visitor-manifest.json",
  "./Icons/Visitor.png",

  // Inventory
  "./Inventory/inventory.html",
  "./inventory-manifest.json",
  "./Icons/Inventory.png",

  // Leave Tracker
  "./Leave Tracker/leave.html",
  "./leave-manifest.json",
  "./Icons/Leave.png"

  // Fitness Access
  "./Fitness Access/fitness-access.html",
  "./Fitness Access/statement.html",
  "./Fitness Access/signature.html",
  "./Fitness Access/review.html",
  "./Fitness Access/fitness-access-db.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request);
    })
  );
});
