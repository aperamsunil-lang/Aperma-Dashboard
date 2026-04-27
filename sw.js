const CACHE_NAME = "aperam-dashboard-v1";
const urlsToCache = [
  "./index.html",
  "./overview.html",
  "./opex-april.html",
  "./overallstock.html",
  "./inward.html",
  "./dispatch.html",
  "./scrap.html",
  "./opex.html",
  "./consumption.html",
  "./livestock.html",
  "./gantt.html",
  "./insights.html",
  "./analytics.html",
  "./settings.html",
  "./manifest.json",
  "./icon-512.png"
];

// Install Service Worker and Cache App Shell
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Serve from Cache for fast loading
self.addEventListener("fetch", event => {
  // Hum API data ko cache nahi karenge taaki hamesha fresh data mile
  if (event.request.url.includes('script.google.com')) {
    return; 
  }
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// Yeh code har us cheez ko cache (save) kar lega jo page par load hoti hai

self.addEventListener("fetch", (event) => {
  // Sirf data laane wali (GET) requests ko hi save karenge
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 1. Agar internet band hai, toh pehle se save ki hui file de do
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. Agar internet chal raha hai, toh internet se laao aur memory mein save kar lo
      return fetch(event.request).then((networkResponse) => {
        return caches.open("aperam-auto-cache").then((cache) => {
          // File ko chupke se save kiya ja raha hai offline ke liye
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      });
    })
  );
});