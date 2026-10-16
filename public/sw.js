// A service worker displays notifications on browsers that require it (including Android).
// Scheduled delivery still requires an open app. Background push needs a backend.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windows) => {
        const target = windows.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );
        if (target) return target.focus();
        return clients.openWindow("/");
      }),
  );
});
