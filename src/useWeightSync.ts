import { useCallback, useEffect, useRef, useState } from "react";
import { backendRpc } from "./backend";
import { STORAGE_KEY, type Weight } from "./model";
import { deviceTimezone } from "./social";
import { accountStorageGeneration } from "./accountStorage";
import {
  acceptWeightResponse,
  projectWeights,
  queueWeight,
  readWeightCache,
  type WeightCache,
  type WeightResponse,
} from "./weightSync";

export function useWeightSync(
  userId: string | null,
  weights: Weight[],
  onRemote: (weights: Weight[]) => void,
  disabled = false,
  timezone?: string,
) {
  const key = `${STORAGE_KEY}:account:${userId}:weight-sync`;
  const [generation] = useState(() =>
    userId ? accountStorageGeneration(userId) : 0,
  );
  const isCurrent = () =>
    alive.current &&
    (!userId || generation === accountStorageGeneration(userId));
  const [initial] = useState(() => {
    try {
      return {
        cache: readWeightCache(
          userId ? localStorage.getItem(key) : null,
          userId ? weights : [],
        ),
        error: "",
      };
    } catch (error) {
      return { cache: null, error: (error as Error).message };
    }
  });
  const cacheRef = useRef(initial.cache);
  const [cache, setCache] = useState(initial.cache);
  const [error, setError] = useState(initial.error);
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState(false);
  const onRemoteRef = useRef(onRemote);
  onRemoteRef.current = onRemote;
  const running = useRef(false),
    again = useRef(false),
    alive = useRef(true);
  const enabled = Boolean(userId && !disabled && initial.cache);
  function persist(next: WeightCache, publish = true) {
    if (!isCurrent()) return;
    // Persist the retry queue before updating the visible record or making requests.
    localStorage.setItem(key, JSON.stringify(next));
    cacheRef.current = next;
    setCache(next);
    if (publish) onRemoteRef.current(projectWeights(next));
  }
  const refresh: () => Promise<void> = useCallback(async () => {
    if (!enabled || !isCurrent()) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    again.current = false;
    setBusy(true);
    try {
      persist(cacheRef.current!);
      const sent = cacheRef
        .current!.pending.filter((p) => !p.conflict)
        .slice(0, 100);
      const response = await backendRpc<WeightResponse>("sync_weights", {
        p_user_id: userId,
        p_changes: sent,
        p_timezone: timezone ?? deviceTimezone(),
      });
      if (!isCurrent()) return;
      const next = acceptWeightResponse(cacheRef.current!, sent, response);
      persist(next);
      setError("");
      setSynced(true);
      if (next.pending.some((p) => !p.conflict)) again.current = true;
    } catch (error) {
      if (isCurrent()) setError((error as Error).message);
    } finally {
      running.current = false;
      if (isCurrent()) {
        setBusy(false);
        if (again.current) void Promise.resolve().then(refresh);
      }
    }
  }, [enabled, key, userId, generation, timezone]);
  useEffect(() => {
    alive.current = true;
    if (enabled) void refresh();
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(visible, 60000);
    return () => {
      alive.current = false;
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", visible);
      clearInterval(timer);
    };
  }, [enabled, refresh]);
  function save(date: string, kg: number | null) {
    if (!enabled || !isCurrent())
      throw new Error(
        initial.error ||
          "Não foi possível preparar a sincronização. Seus registros foram preservados.",
      );
    persist(queueWeight(cacheRef.current!, date, kg));
    void refresh();
  }
  function resolve(date: string, useLocal: boolean) {
    const current = cacheRef.current!;
    const change = current.pending.find((p) => p.date === date);
    if (!change) return;
    const next = {
      ...current,
      pending: current.pending.filter((p) => p.date !== date),
    };
    persist(useLocal ? queueWeight(next, date, change.kg) : next);
    void refresh();
  }
  function importGuest(entries: Weight[]) {
    if (!enabled) throw new Error("A sincronização ainda não está disponível.");
    let next = cacheRef.current!;
    for (const entry of entries) {
      if (next.pending.some((p) => p.date === entry.date)) continue;
      next = {
        ...next,
        pending: [
          ...next.pending,
          { ...entry, baseVersion: 0, mutationId: crypto.randomUUID() },
        ],
      };
    }
    persist({ ...next, guestImported: true });
    void refresh();
  }
  return {
    busy,
    error,
    synced,
    refresh,
    save,
    resolve,
    importGuest,
    guestImported: cache?.guestImported ?? false,
    pending: cache?.pending.length ?? 0,
    conflicts: (cache?.pending ?? [])
      .filter((p) => p.conflict)
      .map((p) => ({
        ...p,
        remoteKg: cache?.records.find((r) => r.date === p.date)?.kg ?? null,
      })),
  };
}
