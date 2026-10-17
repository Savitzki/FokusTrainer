import { useCallback, useEffect, useRef, useState } from "react";
import { accountConfigured, backendRpc } from "./backend";
import { accountStorageGeneration } from "./accountStorage";
import { deviceTimezone } from "./social";
import { readGameState, type GameState } from "./gamification";

/** No optimistic coins/inventory. Ignore replies from signed-out accounts and superseded filters. */
export function useGameResource<T>(
  userId: string | null,
  rpc: string,
  args: Record<string, unknown>,
  parse: (x: unknown) => T,
  enabled = true,
) {
  const [state, setState] = useState<T | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const serialized = JSON.stringify(args),
    sequence = useRef(0),
    running = useRef(false),
    alive = useRef(true);
  const generation = useRef(userId ? accountStorageGeneration(userId) : 0);
  const identity = useRef(userId),
    mutationRevision = useRef(0);
  identity.current = userId;
  const allowed = Boolean(userId && accountConfigured && enabled);
  const refresh = useCallback(async () => {
    if (
      !allowed ||
      identity.current !== userId ||
      (userId && accountStorageGeneration(userId) !== generation.current)
    )
      return false;
    const request = ++sequence.current;
    setBusy(true);
    try {
      const next = parse(await backendRpc(rpc, JSON.parse(serialized)));
      if (
        !alive.current ||
        identity.current !== userId ||
        request !== sequence.current ||
        (userId && accountStorageGeneration(userId) !== generation.current)
      )
        return false;
      setState(next);
      setError("");
      return true;
    } catch (e) {
      if (alive.current && request === sequence.current)
        setError(e instanceof Error ? e.message : "Tente novamente");
      return false;
    } finally {
      if (alive.current && request === sequence.current && !running.current)
        setBusy(false);
    }
  }, [allowed, rpc, serialized, parse, userId]);
  useEffect(() => {
    alive.current = true;
    mutationRevision.current++;
    running.current = false;
    generation.current = userId ? accountStorageGeneration(userId) : 0;
    setState(null);
    void refresh();
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(visible, 60000);
    return () => {
      alive.current = false;
      sequence.current++;
      clearInterval(timer);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  async function act(name: string, params: Record<string, unknown>) {
    if (
      !allowed ||
      identity.current !== userId ||
      running.current ||
      (userId && accountStorageGeneration(userId) !== generation.current)
    )
      return false;
    running.current = true;
    const mutation = ++mutationRevision.current;
    setBusy(true);
    setError("");
    try {
      await backendRpc(name, params);
      if (identity.current !== userId || mutation !== mutationRevision.current)
        return false;
      return await refresh();
    } catch (e) {
      if (
        alive.current &&
        identity.current === userId &&
        mutation === mutationRevision.current
      )
        setError(e instanceof Error ? e.message : "Tente novamente");
      return false;
    } finally {
      if (mutation === mutationRevision.current) {
        running.current = false;
        if (alive.current) setBusy(false);
      }
    }
  }
  return { state, error, busy, refresh, act };
}
export function useGamification(
  userId: string | null,
  revisionKey: string,
  enabled: boolean,
) {
  const game = useGameResource<GameState>(
    userId,
    "get_gamification_state",
    { p_timezone: deviceTimezone() },
    readGameState,
    enabled,
  );
  const refresh = game.refresh;
  const previousKey = useRef(revisionKey);
  useEffect(() => {
    if (previousKey.current !== revisionKey) {
      previousKey.current = revisionKey;
      void refresh();
    }
  }, [revisionKey, refresh]);
  return game;
}
export type GameController = ReturnType<typeof useGamification>;
