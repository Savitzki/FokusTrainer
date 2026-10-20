// The build inserts the precise file list and a content-based cache version.
// In Vite development mode these placeholders leave offline caching disabled.
const PRECACHE_FILES = "__FOKUS_PRECACHE__";
const CACHE_PREFIX = `fokus-trainer:${self.registration.scope}:`;
const CACHE_NAME = `${CACHE_PREFIX}__FOKUS_CACHE_VERSION__`;
const appURL = self.registration.scope;
const MANIFEST_URLS = new Set(
  [
    "manifest.webmanifest",
    "manifest-dark.webmanifest",
    "manifest-light.webmanifest",
  ].map((file) => new URL(file, appURL).href),
);

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
        const resourceURL = new URL(event.request.url);
        resourceURL.search = "";
        if (MANIFEST_URLS.has(resourceURL.href)) {
          // Installed Android apps keep their own theme metadata. Never serve a
          // stale manifest online just because the current shell precached it.
          try {
            const response = await fetch(event.request, {
              cache: "no-store",
              signal: AbortSignal.timeout(5000),
            });
            if (response.ok) {
              try {
                await cache.put(resourceURL.href, response.clone());
              } catch {
                /* A full cache must not prevent reading the current manifest. */
              }
              return response;
            }
          } catch {
            /* Keep the latest known installation settings available offline. */
          }
          return (await cache.match(resourceURL.href)) || Response.error();
        }
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

function notificationURL(tag) {
  if (typeof tag === "string" && tag.startsWith("capibora-taunt-"))
    return new URL("#/arena?aba=friends", appURL).href;
  if (typeof tag === "string" && tag.startsWith("fokus-group-"))
    return new URL("#/arena?aba=groups", appURL).href;
  if (typeof tag === "string" && /^fokus-\d{4}-\d{2}-\d{2}-weight$/.test(tag))
    return new URL("#/peso", appURL).href;
  return appURL;
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
        : "Capibora",
      {
        body:
          typeof payload.body === "string"
            ? payload.body.slice(0, 300)
            : "Abra a Capibora para acompanhar seus treinos.",
        icon: new URL("icons/icon-192.png", appURL).href,
        badge: new URL("icons/notification-badge.png", appURL).href,
        tag: typeof payload.tag === "string" ? payload.tag : "fokus-push",
        data: { url: notificationURL(payload.tag) },
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
        let destination = notificationURL(event.notification.tag);
        try {
          const url = new URL(event.notification.data?.url ?? destination);
          const base = new URL(appURL);
          if (url.origin === base.origin && url.pathname === base.pathname && url.search === base.search &&
              ["", "#/", "#/peso", "#/arena?aba=groups", "#/arena?aba=friends"].includes(url.hash))
            destination = url.href;
        } catch { /* Older notifications keep a safe in-app destination. */ }
        const target = windows.find((client) => client.url.startsWith(appURL));
        if (target) {
          if (target.url !== destination) await target.navigate(destination);
          return target.focus();
        }
        return clients.openWindow(destination);
      }),
  );
});
