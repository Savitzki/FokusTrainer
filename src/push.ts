import { backendRpc } from "./backend";
import { deviceTimezone } from "./social";

export const pushPublicKey =
  import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() ?? "";
export const pushSupported = () =>
  window.isSecureContext &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;
export type PushPreferences = { hour: number; tone: "gentle" | "dramatic" };
export function decodePushKey(key: string): Uint8Array<ArrayBuffer> {
  const binary = atob(
    key.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (key.length % 4)) % 4),
  );
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
export async function enablePush(preferences: PushPreferences) {
  if (!pushSupported() || !pushPublicKey)
    throw new Error(
      "Push ainda indisponível. No iPhone, instale o app na Tela de Início e abra por lá.",
    );
  // Keep this permission request directly in the user's click gesture (iOS requirement).
  if ((await Notification.requestPermission()) !== "granted")
    throw new Error(
      "Permissão não concedida. Você pode liberar os avisos nas configurações do navegador.",
    );
  await navigator.serviceWorker.register(
    new URL("sw.js", document.baseURI).href,
  );
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const existingKey = subscription.options.applicationServerKey;
    const nextKey = decodePushKey(pushPublicKey);
    if (
      existingKey &&
      (existingKey.byteLength !== nextKey.length ||
        new Uint8Array(existingKey).some((b, i) => b !== nextKey[i]))
    ) {
      await backendRpc("disable_push_device", {
        p_endpoint: subscription.endpoint,
      });
      await subscription.unsubscribe();
      subscription = null;
    }
  }
  const created = !subscription;
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodePushKey(pushPublicKey),
  });
  try {
    const json = subscription.toJSON();
    await backendRpc("save_push_device", {
      p_endpoint: json.endpoint,
      p_p256dh: json.keys?.p256dh,
      p_auth: json.keys?.auth,
      p_vapid_key: pushPublicKey,
      p_timezone: deviceTimezone(),
      p_hour: preferences.hour,
      p_tone: preferences.tone,
    });
    return subscription;
  } catch (error) {
    if (created) await subscription.unsubscribe();
    throw error;
  }
}
export async function disablePush() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return;
  await backendRpc("disable_push_device", {
    p_endpoint: subscription.endpoint,
  });
  await subscription.unsubscribe();
}
