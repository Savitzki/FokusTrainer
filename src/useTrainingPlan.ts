import { useCallback, useEffect, useRef, useState } from "react";
import { accountConfigured, backendRpc } from "./backend";
import { accountStorageGeneration } from "./accountStorage";
import { STORAGE_KEY } from "./model";
import { readTrainingState, type TrainingState } from "./training";

export type TrainingController = ReturnType<typeof useTrainingPlan>;
export function useTrainingPlan(userId: string | null, disabled = false) {
  const key = `${STORAGE_KEY}:account:${userId}:training`;
  const [generation] = useState(() =>
    userId ? accountStorageGeneration(userId) : 0,
  );
  const [state, setState] = useState<TrainingState | null>(() => {
    if (!userId) return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? readTrainingState(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  });
  const current = useRef(state);
  current.current = state;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const alive = useRef(true),
    running = useRef(false),
    refreshAgain = useRef(false);
  const enabled = Boolean(userId && accountConfigured && !disabled);
  const request = useCallback(
    async (name: string, args: Record<string, unknown> = {}) => {
      if (userId && accountStorageGeneration(userId) !== generation)
        return false;
      if (!enabled || running.current) {
        if (enabled && name === "get_training_state")
          refreshAgain.current = true;
        return false;
      }
      running.current = true;
      setBusy(true);
      const isCurrent = () =>
        alive.current && accountStorageGeneration(userId!) === generation;
      try {
        const next = readTrainingState(
          await backendRpc(name, {
            p_timezone:
              current.current?.timezone ??
              Intl.DateTimeFormat().resolvedOptions().timeZone ??
              "UTC",
            ...args,
          }),
        );
        if (!isCurrent()) return false;
        if (!current.current || next.revision >= current.current.revision) {
          current.current = next;
          setState(next);
          try {
            localStorage.setItem(key, JSON.stringify(next));
            setError("");
          } catch {
            setError(
              "Salvo na conta, mas não foi possível preparar sua programação offline neste aparelho",
            );
          }
        }
        return true;
      } catch (error) {
        if (isCurrent())
          setError(
            error instanceof Error
              ? error.message
              : "Não foi possível atualizar sua semana",
          );
        return false;
      } finally {
        running.current = false;
        if (isCurrent()) {
          setBusy(false);
          if (refreshAgain.current) {
            refreshAgain.current = false;
            void Promise.resolve().then(() => request("get_training_state"));
          }
        }
      }
    },
    [enabled, userId, key, generation],
  );
  const refresh = useCallback(() => request("get_training_state"), [request]);
  const getCurrent = useCallback(() => current.current, []);
  useEffect(() => {
    alive.current = true;
    if (enabled) void refresh();
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(visible, 60000);
    return () => {
      alive.current = false;
      clearInterval(timer);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [enabled, refresh]);
  return {
    state,
    busy,
    error,
    enabled,
    refresh,
    getCurrent,
    save: (days: number[]) =>
      request("save_training_plan", {
        p_training_days: days,
        p_revision: current.current?.revision ?? -1,
      }),
    rest: () => request("authorize_extra_rest"),
    reschedule: (originalDay: string, targetDay: string) =>
      request("reschedule_training", {
        p_original_day: originalDay,
        p_target_day: targetDay,
        p_revision: current.current?.revision ?? -1,
      }),
  };
}
