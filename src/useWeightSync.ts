import { useEffect, useMemo, useRef, useState } from "react";
import { backendRpc } from "./backend";
import { STORAGE_KEY, type Weight } from "./model";
import { deviceTimezone } from "./social";
import {
  acceptWeightResponse,
  projectWeights,
  queueWeight,
  readWeightCache,
  importWeights,
  type WeightCache,
  type WeightResponse,
} from "./weightSync";
import { useSyncedResource } from "./useSyncedResource";
import { invalidateSync, notifySyncWrite, withSync } from "./sync";

export function useWeightSync(
  userId: string | null,
  weights: Weight[],
  onRemote: (weights: Weight[]) => void,
  disabled = false,
  timezone?: string,
  onConfirmed?: () => void,
) {
  const key = `${STORAGE_KEY}:account:${userId}:weight-sync`;
  const initial = useMemo(() => {
    try {
      const raw = userId ? localStorage.getItem(key) : null;
      return {
        cache: readWeightCache(raw, userId ? weights : []),
        legacyRaw: raw && JSON.parse(raw).version === 1 ? raw : null,
        error: "",
      };
    } catch (e) {
      return { cache: null, error: (e as Error).message, legacyRaw: null };
    }
  }, [key, userId]);
  const [record, setRecord] = useState({ userId, value: initial.cache });
  const cache = record.userId === userId ? record.value : initial.cache;
  const cacheRef = useRef(initial.cache),
    cacheOwner = useRef(userId);
  if (cacheOwner.current !== userId) {
    cacheOwner.current = userId;
    cacheRef.current = initial.cache;
  }
  const [localError, setLocalError] = useState(initial.error),
    [syncedOwner, setSyncedOwner] = useState<string | null>(null);
  const remote = useRef(onRemote);
  remote.current = onRemote;
  const confirmed = useRef(onConfirmed);
  confirmed.current = onConfirmed;
  const enabled = Boolean(userId && !disabled && initial.cache);
  function persist(next: WeightCache) {
    if (!resource.isCurrent()) return;
    if (initial.legacyRaw && !localStorage.getItem(`${key}:v1-backup`))
      localStorage.setItem(`${key}:v1-backup`, initial.legacyRaw);
    localStorage.setItem(key, JSON.stringify(next));
    cacheRef.current = next;
    setRecord({ userId, value: next });
    remote.current(projectWeights(next));
  }
  type Response = {
    sent: NonNullable<WeightCache>["pending"];
    response: WeightResponse;
  };
  const resource = useSyncedResource<Response>({
    userId,
    resource: "weights",
    queryKey: "weights",
    enabled,
    parse: (value) => value as Response,
    read: async () => {
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
      return { response, sent };
    },
    onData({ response, sent }) {
      const previous = cacheRef.current!,
        next = {
          ...acceptWeightResponse(previous, sent, response),
          syncedAt: new Date().toISOString(),
        };
      persist(next);
      setLocalError("");
      setSyncedOwner(userId);
      if (sent.some((p) => response.applied.includes(p.id))) {
        notifySyncWrite(userId, "sync_weight_entries", "weights");
        confirmed.current?.();
      } else if (
        JSON.stringify(previous.records) !== JSON.stringify(next.records)
      )
        invalidateSync(userId, ["economy", "gamification", "reports"]);
      if (next.pending.some((p) => !p.conflict))
        invalidateSync(userId, ["weights"]);
    },
  });
  useEffect(() => {
    setLocalError(initial.error);
    setSyncedOwner(null);
    if (userId && cacheRef.current && resource.isCurrent())
      remote.current(projectWeights(cacheRef.current));
  }, [userId]);
  function save(date: string, kg: number) {
    if (!enabled || !resource.isCurrent())
      throw new Error(
        initial.error ||
          "Não foi possível preparar a sincronização. Seus registros foram preservados.",
      );
    persist(queueWeight(cacheRef.current!, date, kg));
    invalidateSync(userId, ["weights"]);
  }
  function resolve(id: string, keepBoth: boolean) {
    if (!enabled || !resource.isCurrent()) return;
    const current = cacheRef.current!,
      change = current.pending.find((p) => p.id === id);
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
    invalidateSync(userId, ["weights"]);
  }
  function importGuest(entries: Weight[]) {
    if (!enabled || !resource.isCurrent())
      throw new Error("A sincronização ainda não está disponível.");
    persist(importWeights(cacheRef.current!, entries));
    invalidateSync(userId, ["weights"]);
  }
  return withSync(
    {
      busy: resource.sync.refreshing,
      error: resource.error || localError,
      synced: syncedOwner === userId && Boolean(userId),
      cached: Boolean(
        initial.cache &&
          (initial.cache.syncedAt || initial.cache.records.length),
      ),
      refresh: resource.refresh,
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
    },
    resource.sync,
  );
}
