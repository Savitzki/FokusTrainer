// A service worker displays notifications on browsers that require it (including Android).
// Scheduled delivery still requires an open app. Background push needs a backend.
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
