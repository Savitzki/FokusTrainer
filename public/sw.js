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
          // This cache contains only the app's public static build assets.
          // Module/CSS requests send Origin, unlike cache.addAll(). A host's
          // Vary: Origin must not turn these identical public files into misses.
          (await cache.match(event.request, { ignoreSearch: true, ignoreVary: true })) ||
          fetch(event.request)
        );
      })(),
    );
  });
}

function notificationURL(tag) {
  if (typeof tag === "string" && tag.startsWith("capibora-taunt-"))
    return appURL;
  if (typeof tag === "string" && tag.startsWith("fokus-group-"))
    return new URL("#/arena?aba=groups", appURL).href;
  if (typeof tag === "string" && /^fokus-\d{4}-\d{2}-\d{2}-weight$/.test(tag))
    return new URL("#/peso", appURL).href;
  return appURL;
}

function isAppWindow(client) {
  try {
    const url = new URL(client.url), base = new URL(appURL);
    return url.origin === base.origin &&
      [base.pathname, new URL("index.html", appURL).pathname].includes(url.pathname);
  } catch { return false; }
}

function confirmTauntReceipt(client, tag) {
  const id = tag.slice("capibora-taunt-".length);
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id)) return Promise.resolve(false);
  return new Promise((resolve) => {
    let channel;
    let settled = false;
    const finish = (received) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      channel?.port1.close();
      channel?.port2.close();
      resolve(received);
    };
    const timer = setTimeout(() => finish(false), 1200);
    try {
      channel = new MessageChannel();
      channel.port1.onmessage = (event) => finish(event.data?.received === true);
      channel.port1.onmessageerror = () => finish(false);
      client.postMessage({ type: "capibora:taunt-push", id }, [channel.port2]);
    } catch { finish(false); }
  });
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    /* Always show a visible notification. */
  }
  event.waitUntil((async () => {
    const taunt = typeof payload.tag === "string" && payload.tag.startsWith("capibora-taunt-");
    if (taunt) {
      try {
        const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
        const visible = windows.filter((client) => isAppWindow(client) && client.visibilityState === "visible");
        const received = await Promise.all(visible.map((client) => confirmTauntReceipt(client, payload.tag)));
        if (received.some(Boolean)) return;
      } catch { /* Delivery still gets a generic system notification if window discovery fails. */ }
    }
    await self.registration.showNotification(
      taunt ? "Capibora" : typeof payload.title === "string" ? payload.title.slice(0, 100) : "Capibora",
      {
        body: taunt ? "Psiu, alguém mandou uma provocação" : typeof payload.body === "string" ? payload.body.slice(0, 300) : "Abra a Capibora para acompanhar seus treinos.",
        icon: new URL(taunt ? "mascot/web/julgando.webp" : "icons/icon-192.png", appURL).href,
        badge: new URL("icons/notification-badge.png", appURL).href,
        tag: typeof payload.tag === "string" ? payload.tag : "fokus-push",
        data: { url: notificationURL(payload.tag) },
      },
    );
  })());
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
        const target = windows.find(isAppWindow);
        if (target) {
          if (typeof event.notification.tag === "string" && event.notification.tag.startsWith("capibora-taunt-")) {
            // The global inbox can open on this page after any critical operation.
            // Do not reload a form or replace the user's navigation history.
            try { target.postMessage({ type: "capibora:taunt-push" }); }
            catch { /* Focus also triggers the existing resume synchronization. */ }
            return target.focus();
          }
          if (target.url !== destination) await target.navigate(destination);
          return target.focus();
        }
        return clients.openWindow(destination);
      }),
  );
});
