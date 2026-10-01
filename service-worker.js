const CACHE_NAME = "efc-tools-v9";

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
  "./Facility%20Manager/Apps/Fitness%20Access/fitness-access-db.js",

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

  // Only handle GET requests
  if (event.request.method !== "GET") {
    return;
  }


  const url = new URL(event.request.url);


  // -------------------------------------------------
  // 2-MILE RUN COUNTER
  //
  // This tool must always be online.
  // Do NOT serve it from cache and do NOT save it
  // to the cache.
  // -------------------------------------------------

  if (
    url.origin === self.location.origin &&
    url.pathname.includes(
      "/Facility%20Manager/FAC/2%20Mile%20Run/"
    )
  ) {

    event.respondWith(
      fetch(event.request, {
        cache: "no-store"
      })
    );

    return;

  }


  // -------------------------------------------------
  // NORMAL EFC TOOLS
  //
  // Network first.
  // Save successful responses for offline use.
  // If the network fails, use the cached version.
  // -------------------------------------------------

  event.respondWith(

    fetch(event.request)

      .then(response => {

        // Only cache successful
        // same-origin responses
        if (
          response &&
          response.status === 200 &&
          response.type === "basic"
        ) {

          const responseCopy =
            response.clone();


          caches.open(CACHE_NAME)
            .then(cache => {

              cache.put(
                event.request,
                responseCopy
              );

            });

        }

        return response;

      })


      // If internet isn't available,
      // use cached version
      .catch(() => {

        return caches.match(
          event.request
        );

      })

  );

});
