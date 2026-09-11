const BUILD_ID = "__BUILD_ID__";
const CACHE_VERSION = `parfum-app-${BUILD_ID}`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const APP_SHELL = [
  "/", "/index.html", "/productos.html", "/ofertas.html", "/contacto.html",
  "/login.html", "/registro.html", "/carrito.html", "/pedidos.html", "/offline.html", "/manifest.webmanifest",
  "/css/index.css", "/css/app.css", "/css/layout.css",
  "/js/theme-init.js", "/js/config.js", "/js/api.js", "/js/store.js",
  "/js/layout.js", "/js/pwa.js", "/js/carrito.js", "/js/pedidos.js", "/js/fallback-products.js",
  "/icons/icon-192.png", "/icons/icon-512.png", "/imagen/pagos/yape-william-lopez.png",
  "/imagen/decants/decant-3ml.png", "/imagen/decants/decant-5ml.png",
  "/imagen/decants/decant-10ml-premium.png", "/favicon.ico"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith("parfum-app-") && ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.hostname.includes("onrender.com")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(response => {
        const clone = response.clone();
        caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone));
        return response;
      }).catch(async () => (await caches.match(request)) || caches.match("/offline.html"))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    // Network-first: después de un push se ven CSS/JS/imágenes nuevos inmediatamente.
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) caches.open(RUNTIME_CACHE).then(cache => cache.put(request, response.clone()));
        return response;
      }).catch(() => caches.match(request))
    );
  }
});
