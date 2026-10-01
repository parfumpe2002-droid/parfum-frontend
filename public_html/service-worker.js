const BUILD_ID = "__BUILD_ID__";
const CACHE_VERSION = `parfum-app-${BUILD_ID}`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const META_CACHE = "parfum-meta";
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

async function savePushContext(context) {
  const cache = await caches.open(META_CACHE);
  const safe = {
    mode: context?.mode === "admin" ? "admin" : "client",
    url: context?.mode === "admin" ? "/admin.html#orders" : "/pedidos.html"
  };
  await cache.put("/__parfum_push_context__", new Response(JSON.stringify(safe), {
    headers: {"Content-Type":"application/json"}
  }));
}

async function readPushContext() {
  try {
    const cache = await caches.open(META_CACHE);
    const response = await cache.match("/__parfum_push_context__");
    return response ? await response.json() : {mode:"client", url:"/pedidos.html"};
  } catch {
    return {mode:"client", url:"/pedidos.html"};
  }
}

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (event.data?.type === "CONFIG_PUSH_CONTEXT") {
    event.waitUntil(savePushContext(event.data.context || {}));
  }
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


self.addEventListener("push", event => {
  event.waitUntil((async () => {
    let data = {};
    try {
      data = event.data ? event.data.json() : {};
    } catch {
      data = {body:event.data?.text() || ""};
    }

    const context = await readPushContext();
    const admin = context?.mode === "admin";
    const title = data.title || (admin ? "Nuevo pedido en Parfum" : "Parfum");
    const body = data.body || (admin
      ? "Tienes un pedido nuevo. Toca la notificación para revisarlo."
      : "Tienes una novedad en tu pedido.");
    const url = data.url || context?.url || (admin ? "/admin.html#orders" : "/pedidos.html");

    await self.registration.showNotification(title, {
      body,
      icon:data.icon || "/icons/icon-192.png",
      badge:data.badge || "/icons/icon-72.png",
      tag:data.tag || (admin ? "parfum-admin-pedido" : "parfum-pedido"),
      renotify:true,
      data:{url},
      vibrate:[160, 80, 160, 80, 220]
    });
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type:"window", includeUncontrolled:true});
    for (const win of windows) {
      if ("focus" in win) {
        await win.navigate(destination);
        return win.focus();
      }
    }
    return self.clients.openWindow ? self.clients.openWindow(destination) : null;
  })());
});
