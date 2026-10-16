export const notificationSupported = () =>
  typeof Notification !== "undefined" && window.isSecureContext;
export async function notify(title: string, body: string): Promise<boolean> {
  if (!notificationSupported() || Notification.permission !== "granted")
    return false;
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.register("/sw.js");
      // ready waits until an active worker is available on the first visit.
      await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon: "/icon.svg",
        tag: "fokus-reminder",
      });
    } else {
      new Notification(title, { body, icon: "/icon.svg" });
    }
    return true;
  } catch {
    return false;
  }
}
