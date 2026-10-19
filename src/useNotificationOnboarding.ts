import { useEffect, useRef, useState } from "react";
import { accountConfigured, backendRpc } from "./backend";
import { useSyncedResource } from "./useSyncedResource";
import {
  currentPushSubscription,
  declinePush,
  enableAutomaticPush,
  notificationInstallation,
  pushPublicKey,
  pushSupported,
  readNotificationConsent,
  requestPushPermission,
} from "./push";

export function useNotificationOnboarding(
  userId: string | null,
  profileComplete: boolean,
) {
  const [installationId] = useState(notificationInstallation);
  const [dismissed, setDismissed] = useState(false);
  const [forced, setForced] = useState(false);
  const restored = useRef(false);
  useEffect(() => {
    setDismissed(false);
    setForced(false);
    restored.current = false;
  }, [userId]);
  const resource = useSyncedResource({
    userId,
    resource: "notifications",
    queryKey: `notifications:${installationId}`,
    enabled: Boolean(accountConfigured && userId && profileComplete),
    parse: readNotificationConsent,
    read: async () => {
      const subscription = await currentPushSubscription();
      return backendRpc("get_notification_consent", {
        p_installation_id: installationId,
        p_endpoint: subscription?.endpoint ?? null,
      });
    },
  });
  const supported = Boolean(pushPublicKey && pushSupported());
  const permission =
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission;
  const state = resource.state;
  const needsEnrollment = Boolean(
    state && state.decision !== "declined" && !state.registered,
  );
  useEffect(() => {
    if (
      !needsEnrollment ||
      permission !== "granted" ||
      !supported ||
      restored.current ||
      dismissed
    )
      return;
    restored.current = true;
    // Previously accepted device after logout: restore without requesting permission.
    void resource.mutate(
      () => enableAutomaticPush(installationId, resource.isCurrent),
      "enable_push_notifications",
    );
  }, [needsEnrollment, permission, supported, installationId, dismissed]);
  return {
    prompt:
      supported &&
      permission === "default" &&
      !dismissed &&
      (forced || state?.decision === "pending" || needsEnrollment),
    allowed: state?.decision === "accepted" && permission === "granted",
    request: () => {
      if (supported && permission === "default") {
        setDismissed(false);
        setForced(true);
      }
    },
    dismiss: () => {
      setDismissed(true);
      setForced(false);
    },
    enable: async () => {
      if (
        !accountConfigured ||
        !userId ||
        !profileComplete ||
        !resource.isCurrent()
      )
        throw new Error("Conclua seu perfil antes de ativar os avisos");
      if (!navigator.onLine)
        throw new Error("Conecte-se à internet para ativar os avisos");
      // The operating-system dialog may remain open longer than a network timeout.
      // Start that timeout only after the user makes their native permission choice.
      await requestPushPermission(resource.isCurrent);
      let failure: unknown;
      const result = await resource.mutate(async () => {
        try {
          return await enableAutomaticPush(installationId, resource.isCurrent);
        } catch (e) {
          failure = e;
          throw e;
        }
      }, "enable_push_notifications");
      if (!result.committed)
        throw (
          failure ??
          new Error(
            "Não foi possível ativar os avisos. Confira a conexão e tente novamente",
          )
        );
      setForced(false);
      setDismissed(true);
    },
    decline: async () => {
      let failure: unknown;
      const result = await resource.mutate(async () => {
        try {
          return await declinePush(installationId, resource.isCurrent);
        } catch (e) {
          failure = e;
          throw e;
        }
      }, "decline_push_notifications");
      if (!result.committed)
        throw (
          failure ??
          new Error(
            "Não foi possível guardar sua escolha. Confira a conexão e tente novamente",
          )
        );
      setForced(false);
      setDismissed(true);
    },
  };
}
