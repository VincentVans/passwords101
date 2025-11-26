// Simple service worker for Passwords 101 PWA

const CACHE_NAME = "passwords101-pwa-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./pwa.js",
  "./manifest.webmanifest",
  "../core.js",
  "../sjcl.js",
  "../Icons/Shield48.png",
  "../Icons/Shield64.png",
  "../Icons/Shield96.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).catch(() => cached);
    })
  );
});


