import { useEffect, useRef, useState } from "react";
import { readArenaInbox, type ArenaMessage } from "./arenaTaunts";
import { useGameResource } from "./useGamification";
import { STORAGE_KEY } from "./model";

/** Only dismissal IDs are queued offline; sending/replying always needs the server. */
export function useArenaNotices(userId: string) {
  const key = `${STORAGE_KEY}:account:${userId}:arena-dismissals`;
  const [pending, setPending] = useState<string[]>(() => {
    try {
      const ids: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
      return Array.isArray(ids)
        ? [
            ...new Set(
              ids.filter(
                (id): id is string =>
                  typeof id === "string" && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id),
              ),
            ),
          ].slice(-100)
        : [];
    } catch {
      return [];
    }
  });
  const [dismissed, setDismissed] = useState(() => new Set(pending));
  const [replying, setReplying] = useState<string | null>(null);
  const inbox = useGameResource(userId, "get_arena_inbox", {}, readArenaInbox);
  const alive = useRef(true),
    flushing = useRef(false),
    attempted = useRef("");
  const requests = useRef(new Map<string, string>()),
    sending = useRef(false);
  const latestPending = useRef(pending);
  latestPending.current = pending;
  const latest = useRef(inbox);
  latest.current = inbox;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  function remember(ids: string[]) {
    latestPending.current = ids;
    setPending(ids);
    try {
      if (ids.length) localStorage.setItem(key, JSON.stringify(ids));
      else localStorage.removeItem(key);
    } catch {
      /* Memory still prevents repeated notices in this session. */
    }
  }
  const pendingKey = pending.join(",");
  useEffect(() => {
    const signature = `${inbox.sync?.lastSuccess}:${pendingKey}`;
    if (
      !pending.length ||
      inbox.busy ||
      !inbox.sync?.lastSuccess ||
      !navigator.onLine ||
      flushing.current ||
      attempted.current === signature
    )
      return;
    attempted.current = signature;
    flushing.current = true;
    void (async () => {
      const confirmed = new Set<string>();
      try {
        for (const id of pending) {
          if (!alive.current) return;
          if (await latest.current.act("acknowledge_arena_taunt", { p_id: id }))
            confirmed.add(id);
          else break;
        }
      } finally {
        flushing.current = false;
        if (alive.current && confirmed.size)
          remember(latestPending.current.filter((id) => !confirmed.has(id)));
      }
    })();
  }, [pendingKey, inbox.busy, inbox.sync?.lastSuccess]);
  return {
    ...inbox,
    replying,
    // Never replay a persistent inbox snapshot before checking current access.
    messages:
      inbox.sync?.lastSuccess &&
      inbox.sync?.errorKind !== "auth" &&
      inbox.sync?.errorKind !== "validation" &&
      !inbox.state?.muted
        ? (inbox.state?.messages ?? []).filter(
            (m) => !m.seen && !dismissed.has(m.id),
          )
        : [],
    dismiss(message: ArenaMessage) {
      setDismissed((old) => new Set([...old, message.id]));
      remember(
        [...new Set([...latestPending.current, message.id])].slice(-100),
      );
    },
    async reply(message: ArenaMessage) {
      if (sending.current || !message.canReply || message.replyTo) return;
      sending.current = true;
      setReplying(message.id);
      const request = requests.current.get(message.id) ?? crypto.randomUUID();
      requests.current.set(message.id, request);
      try {
        if (
          (await inbox.act("reply_arena_taunt", {
            p_id: message.id,
            p_request: request,
          })) &&
          alive.current
        )
          setDismissed((old) => new Set([...old, message.id]));
      } finally {
        sending.current = false;
        if (alive.current) setReplying(null);
      }
    },
  };
}
