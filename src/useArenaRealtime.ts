import { useEffect } from "react";
import { getBackendClient } from "./backend";
import { invalidateSync } from "./sync";

/** Realtime carries only an invalidation counter. Content/access always comes from the RPC. */
export function useArenaRealtime(userId: string) {
  useEffect(() => {
    let disposed = false;
    let release: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (disposed || timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (!disposed) invalidateSync(userId, ["inbox", "social"]);
      }, 100);
    };
    void getBackendClient()
      .then((client) => {
        if (!client || disposed) return;
        const channel = client
          .channel(`arena-inbox:${userId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "arena_inbox_signals",
              filter: `user_id=eq.${userId}`,
            },
            refresh,
          )
          .subscribe((status) => {
            // Includes reconnects: never rely on the transient event payload as history.
            if (status === "SUBSCRIBED") refresh();
          });
        release = () => {
          void client.removeChannel(channel);
        };
      })
      .catch(() => {
        /* Shared resume/60-second sync remains the fallback. */
      });
    const workerMessage = (event: MessageEvent) => {
      if (event.data?.type === "capibora:taunt-push") refresh();
    };
    navigator.serviceWorker?.addEventListener("message", workerMessage);
    return () => {
      disposed = true;
      clearTimeout(timer);
      release?.();
      navigator.serviceWorker?.removeEventListener("message", workerMessage);
    };
  }, [userId]);
}
