/* GymBro — Service Worker (network-first, offline fallback) */
const CACHE = "gymbro.v5";
const ASSETS = [
  "./",
  "./style.css",
  "./planner.js",
  "./app.js",
  "./favicon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./data/exercises.json",
  "./selftest.html",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(e.request)
    )
  );
});
