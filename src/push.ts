import { backendRpc } from "./backend";
import { deviceTimezone } from "./social";

export const pushPublicKey =
  import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() ?? "";
export const pushSupported = () =>
  window.isSecureContext &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  typeof Notification !== "undefined";
export type PushPreferences = { hour: number; tone: "gentle" | "dramatic" };
export function decodePushKey(key: string): Uint8Array<ArrayBuffer> {
  const binary = atob(
    key.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (key.length % 4)) % 4),
  );
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
export type NotificationConsent = {
  decision: "pending" | "accepted" | "declined";
  registered: boolean;
};
export function readNotificationConsent(value: unknown): NotificationConsent {
  const state = value as NotificationConsent;
  if (
    !state ||
    !["pending", "accepted", "declined"].includes(state.decision) ||
    typeof state.registered !== "boolean"
  )
    throw new Error("Não foi possível verificar os avisos deste aparelho");
  return state;
}
let installation: string | undefined;
/** Random first-party installation marker, with no profile data; survives logout. */
export function notificationInstallation() {
  const key = "capibora:notification-installation";
  try {
    const stored = localStorage.getItem(key);
    if (
      stored &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        stored,
      )
    )
      return stored;
    installation ??= crypto.randomUUID();
    localStorage.setItem(key, installation);
  } catch {
    installation ??= crypto.randomUUID();
  }
  return installation;
}
export async function currentPushSubscription() {
  if (!("serviceWorker" in navigator)) return null;
  return (
    (
      await navigator.serviceWorker.getRegistration()
    )?.pushManager?.getSubscription() ?? null
  );
}
/** Native permission is not a network request: never time it out while the user decides. */
export async function requestPushPermission(
  isCurrent: () => boolean = () => true,
) {
  if (!pushSupported() || !pushPublicKey)
    throw Object.assign(
      new Error(
        "Push ainda indisponível. No iPhone, instale o app na Tela de Início e abra por lá.",
      ),
      { kind: "validation" },
    );
  // Keep this permission request directly in the user's click gesture (iOS requirement).
  if (!isCurrent())
    throw new Error("A conta mudou. Entre novamente para ativar os avisos");
  if (Notification.permission === "denied")
    throw Object.assign(
      new Error(
        "Libere as notificações nas permissões do celular ou navegador",
      ),
      { kind: "validation" },
    );
  if (
    Notification.permission !== "granted" &&
    (await Notification.requestPermission()) !== "granted"
  )
    throw Object.assign(
      new Error(
        "Permissão não concedida. Você pode liberar os avisos nas configurações do navegador.",
      ),
      { kind: "validation" },
    );
  if (!isCurrent())
    throw new Error("A conta mudou. Entre novamente para ativar os avisos");
}
export async function enablePush(
  preferences: PushPreferences | null,
  installationId?: string,
  isCurrent: () => boolean = () => true,
) {
  await requestPushPermission(isCurrent);
  await navigator.serviceWorker.register(
    new URL("sw.js", document.baseURI).href,
  );
  const registration = await navigator.serviceWorker.ready;
  if (!isCurrent())
    throw new Error("A conta mudou. Entre novamente para ativar os avisos");
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
    if (!isCurrent())
      throw new Error("A conta mudou. Entre novamente para ativar os avisos");
    const json = subscription.toJSON();
    await backendRpc(
      preferences ? "save_push_device" : "enable_push_notifications",
      {
        p_endpoint: json.endpoint,
        p_p256dh: json.keys?.p256dh,
        p_auth: json.keys?.auth,
        p_vapid_key: pushPublicKey,
        p_timezone: deviceTimezone(),
        ...(preferences
          ? { p_hour: preferences.hour, p_tone: preferences.tone }
          : { p_installation_id: installationId }),
      },
    );
    if (!isCurrent()) {
      // The provider subscription is invalidated even if logout happened mid-RPC.
      await subscription.unsubscribe();
      throw new Error("A conta mudou. Entre novamente para ativar os avisos");
    }
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

export async function enableAutomaticPush(
  installationId: string,
  isCurrent: () => boolean,
) {
  await enablePush(null, installationId, isCurrent);
  return {
    decision: "accepted",
    registered: true,
  } satisfies NotificationConsent;
}
export async function declinePush(
  installationId: string,
  isCurrent: () => boolean = () => true,
) {
  const subscription = await currentPushSubscription();
  if (!isCurrent())
    throw new Error("A conta mudou. Entre novamente para salvar sua escolha");
  const result = readNotificationConsent(
    await backendRpc("decline_push_notifications", {
      p_installation_id: installationId,
      p_endpoint: subscription?.endpoint ?? null,
    }),
  );
  // Once the server has disabled it, a browser cleanup failure must not report
  // that the user's refusal was lost. Delivery remains disabled on the server.
  try {
    if (isCurrent()) await subscription?.unsubscribe();
  } catch {
    /* Server opt-out is definitive. */
  }
  return result;
}
