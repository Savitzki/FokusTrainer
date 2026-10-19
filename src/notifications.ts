export const notificationSupported = () =>
  typeof Notification !== "undefined" && window.isSecureContext;
export async function notify(
  title: string,
  body: string,
  tag = "fokus-reminder",
  stillAllowed: () => boolean = () => true,
): Promise<boolean> {
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
      if (!stillAllowed()) return false;
      await registration.showNotification(title, {
        body,
        icon,
        tag,
      });
    } else {
      if (!stillAllowed()) return false;
      new Notification(title, { body, icon, tag });
    }
    return true;
  } catch {
    return false;
  }
}
