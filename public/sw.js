// The build inserts the precise file list and a content-based cache version.
// In Vite development mode these placeholders leave offline caching disabled.
const PRECACHE_FILES = "__FOKUS_PRECACHE__";
const CACHE_PREFIX = `fokus-trainer:${self.registration.scope}:`;
const CACHE_NAME = `${CACHE_PREFIX}__FOKUS_CACHE_VERSION__`;
const appURL = self.registration.scope;

if (Array.isArray(PRECACHE_FILES)) {
  self.addEventListener("install", (event) => {
    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then((cache) =>
          cache.addAll(
            PRECACHE_FILES.map((file) => new URL(file, appURL).href),
          ),
        ),
    );
    // Updates activate once existing app windows close, keeping each shell coherent.
  });
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        );
        await self.clients.claim();
      })(),
    );
  });
  self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET" || !event.request.url.startsWith(appURL))
      return;
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        if (event.request.mode === "navigate") {
          try {
            const response = await fetch(event.request);
            if (response.ok) return response;
          } catch {
            /* Use the installed shell when offline. */
          }
          return (
            (await cache.match(new URL("index.html", appURL).href)) ||
            Response.error()
          );
        }
        return (
          (await cache.match(event.request, { ignoreSearch: true })) ||
          fetch(event.request)
        );
      })(),
    );
  });
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    /* Always show a visible notification. */
  }
  event.waitUntil(
    self.registration.showNotification(
      typeof payload.title === "string"
        ? payload.title.slice(0, 100)
        : "Sua chama te chamou 🔥",
      {
        body:
          typeof payload.body === "string"
            ? payload.body.slice(0, 300)
            : "Abra o FokusTrainer para acompanhar sua ofensiva.",
        icon: new URL("icons/icon-192.png", appURL).href,
        badge: new URL("icons/icon-192.png", appURL).href,
        tag: typeof payload.tag === "string" ? payload.tag : "fokus-push",
        data: { url: appURL },
      },
    ),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windows) => {
        const appURL = self.registration.scope;
        const target = windows.find((client) => client.url.startsWith(appURL));
        if (target) return target.focus();
        return clients.openWindow(appURL);
      }),
  );
});
