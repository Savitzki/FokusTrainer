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
    const badge = new URL("icons/notification-badge.png", document.baseURI)
      .href;
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.register(
        new URL("sw.js", document.baseURI).href,
      );
      // ready waits until an active worker is available on the first visit.
      await navigator.serviceWorker.ready;
      if (!stillAllowed() || Notification.permission !== "granted")
        return false;
      const options = {
        body,
        icon,
        badge,
        vibrate: [120, 60, 120],
        tag,
        data: {
          url: new URL(
            tag.endsWith("-weight") ? "#/peso" : "./",
            document.baseURI,
          ).href,
        },
      };
      await registration.showNotification(title, options);
    } else {
      if (!stillAllowed() || Notification.permission !== "granted")
        return false;
      new Notification(title, { body, icon, badge, tag });
    }
    return true;
  } catch {
    return false;
  }
}
