import { useCallback, useEffect, useRef } from "react";
import type { ArenaInbox } from "./arenaTaunts";
import type { ResourceSync } from "./sync";

type Receipt = {
  id: string;
  port: MessagePort;
  timer: ReturnType<typeof setTimeout>;
};
const messageId = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;

/** Suppress system UI only when this account has actually received that notice. */
export function useArenaPushReceipts(
  userId: string,
  state: ArenaInbox | null,
  sync: ResourceSync | undefined,
  dismissed: Set<string>,
) {
  const latest = useRef({ userId, state, sync, dismissed });
  latest.current = { userId, state, sync, dismissed };
  const pending = useRef(new Set<Receipt>());
  const alive = useRef(false);
  const close = useCallback((receipt: Receipt) => {
    clearTimeout(receipt.timer);
    pending.current.delete(receipt);
    receipt.port.close();
  }, []);
  const confirm = useCallback(() => {
    const current = latest.current;
    if (
      !alive.current ||
      current.userId !== userId ||
      document.visibilityState !== "visible" ||
      !current.sync?.lastSuccess ||
      current.sync.stale ||
      current.sync.errorKind ||
      !current.state
    )
      return;
    for (const receipt of pending.current) {
      // Unknown IDs may belong to another account or to an obsolete delivery.
      if (
        !current.dismissed.has(receipt.id) &&
        (current.state.muted ||
          !current.state.messages.some((m) => m.id === receipt.id && !m.seen))
      )
        continue;
      try {
        receipt.port.postMessage({ received: true });
      } catch {
        /* A closed window must not suppress the system fallback. */
      } finally {
        close(receipt);
      }
    }
  }, [userId, close]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      for (const receipt of pending.current) close(receipt);
    };
  }, [userId, close]);
  useEffect(confirm, [
    confirm,
    state,
    sync?.lastSuccess,
    sync?.stale,
    sync?.errorKind,
    dismissed,
  ]);
  return useCallback(
    (event: MessageEvent) => {
      const port = event.ports?.[0],
        id: unknown = event.data?.id;
      if (
        !alive.current ||
        latest.current.userId !== userId ||
        !port ||
        typeof id !== "string" ||
        !messageId.test(id)
      )
        return;
      const receipt: Receipt = {
        id,
        port,
        timer: setTimeout(() => close(receipt), 1500),
      };
      pending.current.add(receipt);
      confirm();
    },
    [userId, confirm, close],
  );
}
