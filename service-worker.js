const CACHE_NAME = "kintai-maker-v9";
const ASSET_PATHS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js?v=pwa6",
  "./offline-generator.js?v=pwa4",
  "./manifest.json",
  "./template.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./vendor/pdfjs/pdf.min.mjs",
  "./vendor/pdfjs/pdf.worker.min.mjs",
];
const ASSETS = ASSET_PATHS.map((path) => new URL(path, self.registration.scope).toString());
const INDEX_URL = new URL("./index.html", self.registration.scope).toString();

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match(INDEX_URL)));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      const withoutSearch = new URL(event.request.url);
      withoutSearch.search = "";
      return caches.match(withoutSearch.toString()).then((fallback) => fallback || fetch(event.request));
    }),
  );
});
