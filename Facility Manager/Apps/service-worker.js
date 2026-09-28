const CACHE_NAME = "facility-manager-v5";

const FILES_TO_CACHE = [
  // Visitor Counter
  "./Facility Manager/Apps/Visitor Counter/index.html",
  "./Facility Manager/Apps/visitor-manifest.json",
  "./Facility Manager/Apps/Icons/Visitor.png",

  // Inventory
  "./Facility Manager/Apps/Inventory/inventory.html",
  "./Facility Manager/Apps/inventory-manifest.json",
  "./Facility Manager/Apps/Icons/Inventory.png",

  // Leave Tracker
  "./Facility Manager/Apps/Leave Tracker/leave.html",
  "./Facility Manager/Apps/leave-manifest.json",
  "./Facility Manager/Apps/Icons/Leave.png",

  // Fitness Access
  "./Facility Manager/Apps/Fitness Access/fitness-access.html",
  "./Facility Manager/Apps/Fitness Access/statement.html",
  "./Facility Manager/Apps/Fitness Access/signature.html",
  "./Facility Manager/Apps/Fitness Access/review.html",
  "./Facility Manager/Apps/Fitness Access/fitness-access-db.js"
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
