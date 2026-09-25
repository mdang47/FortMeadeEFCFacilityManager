const CACHE_NAME = "efc-tools-v3";

const CORE_FILES = [
  // Main EFC landing page
  "./",
  "./index.html",
  "./manifest.json",

  // Main branding
  "./Facility%20Manager/Apps/Icons/EFC%20Brandmark.png",
  "./Facility%20Manager/Apps/Icons/Eagle%20Logo.png",

  // App icons
  "./Facility%20Manager/Apps/Icons/Inventory.png",
  "./Facility%20Manager/Apps/Icons/Leave.png",
  "./Facility%20Manager/Apps/Icons/Visitor.png",

  // FAC
  "./Facility%20Manager/FAC/index.html",
  "./Facility%20Manager/FAC/pfra_calculator.html",

  // Fitness Access
  "./Facility%20Manager/Apps/Fitness%20Access/fitness-access.html",
  "./Facility%20Manager/Apps/Fitness%20Access/review.html",
  "./Facility%20Manager/Apps/Fitness%20Access/signature.html",
  "./Facility%20Manager/Apps/Fitness%20Access/statement.html",

  // Inventory
  "./Facility%20Manager/Apps/Inventory/inventory.html",

  // Leave Tracker
  "./Facility%20Manager/Apps/Leave%20Tracker/Leave.html",

  // Visitor Counter
  "./Facility%20Manager/Apps/Visitor%20Counter/index.html",
];


// -------------------------
// INSTALL
// -------------------------

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_FILES);
    })
  );

  self.skipWaiting();
});


// -------------------------
// ACTIVATE
// -------------------------

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});


// -------------------------
// FETCH
// -------------------------

self.addEventListener("fetch", event => {

  // Only cache GET requests
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(

    fetch(event.request)

      .then(response => {

        // Only cache successful same-origin responses
        if (
          response &&
          response.status === 200 &&
          response.type === "basic"
        ) {

          const responseCopy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseCopy);
          });

        }

        return response;

      })

      // If internet isn't available, use cached version
      .catch(() => {
        return caches.match(event.request);
      })

  );

});
