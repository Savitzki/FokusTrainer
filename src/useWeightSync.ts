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
  importWeights,
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
      const raw = userId ? localStorage.getItem(key) : null;
      return {
        cache: readWeightCache(raw, userId ? weights : []),
        legacyRaw: raw && JSON.parse(raw).version === 1 ? raw : null,
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
    if (initial.legacyRaw && !localStorage.getItem(`${key}:v1-backup`))
      localStorage.setItem(`${key}:v1-backup`, initial.legacyRaw);
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
      const response = await backendRpc<WeightResponse>("sync_weight_entries", {
        p_user_id: userId,
        p_entries: sent.map(({ id, date, kg, recordedAt }) => ({
          id,
          date,
          kg,
          recordedAt,
        })),
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
  function save(date: string, kg: number) {
    if (!enabled || !isCurrent())
      throw new Error(
        initial.error ||
          "Não foi possível preparar a sincronização. Seus registros foram preservados.",
      );
    persist(queueWeight(cacheRef.current!, date, kg));
    void refresh();
  }
  function resolve(id: string, keepBoth: boolean) {
    if (!enabled || !isCurrent()) return;
    const current = cacheRef.current!;
    const change = current.pending.find((p) => p.id === id);
    if (!change) return;
    const next = {
      ...current,
      pending: current.pending.filter((p) => p.id !== id),
    };
    persist(
      keepBoth
        ? {
            ...next,
            pending: [
              ...next.pending,
              { ...change, id: crypto.randomUUID(), conflict: false },
            ],
          }
        : next,
    );
    void refresh();
  }
  function importGuest(entries: Weight[]) {
    if (!enabled || !isCurrent())
      throw new Error("A sincronização ainda não está disponível.");
    persist(importWeights(cacheRef.current!, entries));
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
    legacyNotice: cache?.legacyNotice ?? false,
    conflicts: (cache?.pending ?? [])
      .filter((p) => p.conflict)
      .map((p) => ({
        ...p,
        remoteKg: cache?.records.find((r) => r.id === p.id)?.kg ?? null,
      })),
  };
}
