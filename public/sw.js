/* Stock Alert PWA — Service Worker */
const CACHE = "stock-alert-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL, "/sounds/chime.wav"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Navigation: network-first with offline fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match(OFFLINE_URL)) ?? new Response("Offline", { status: 503 });
        }
      })(),
    );
    return;
  }

  // Static assets (icons/sounds): stale-while-revalidate.
  const url = new URL(req.url);
  if (url.origin === self.location.origin && (url.pathname.startsWith("/icons/") || url.pathname.startsWith("/sounds/"))) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req);
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached ?? fetchPromise;
      })(),
    );
  }
});

// ----- Web Push -----
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Stock Alert", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Stock Alert";
  const options = {
    body: payload.body || "",
    tag: payload.tag || "stock-alert",
    renotify: true,
    requireInteraction: false,
    // Custom sounds from the page payload are NOT guaranteed when backgrounded:
    // most platforms use the system notification sound. We never advertise 100% support.
    silent: false,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/", symbol: payload.symbol, alertEventId: payload.alertEventId },
    actions: payload.symbol ? [{ action: "open", title: "เปิดดูราคา" }] : [],
  };

  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);
    // Mirror to open pages so the foreground UI can play a custom sound + toast.
    const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientList) {
      client.postMessage({ type: "PUSH_RECEIVED", payload });
    }
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if ("focus" in client) {
          client.postMessage({ type: "NOTIFICATION_CLICK", url: target });
          try {
            await client.focus();
            if ("navigate" in client) await client.navigate(target);
          } catch {
            /* best effort */
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

// ----- Update flow -----
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
