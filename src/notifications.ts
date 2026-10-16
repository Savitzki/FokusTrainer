export const notificationSupported = () =>
  typeof Notification !== "undefined" && window.isSecureContext;
export async function notify(title: string, body: string): Promise<boolean> {
  if (!notificationSupported() || Notification.permission !== "granted")
    return false;
  try {
    const icon = new URL("icon.svg", document.baseURI).href;
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.register(
        new URL("sw.js", document.baseURI).href,
      );
      // ready waits until an active worker is available on the first visit.
      await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon,
        tag: "fokus-reminder",
      });
    } else {
      new Notification(title, { body, icon });
    }
    return true;
  } catch {
    return false;
  }
}
