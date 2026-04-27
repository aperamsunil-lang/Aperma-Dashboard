const CACHE_NAME = "aperam-dashboard-v1";
const urlsToCache = [
  "./index.html",
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