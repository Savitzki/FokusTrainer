import { useCallback, useEffect, useRef, useState } from "react";
import { backendRpc } from "./backend";
import { localDate, type Workout } from "./model";

export type SocialState = {
  code: string;
  workouts: Workout[];
  friends: { id: string; nickname: string }[];
  requests: { id: string; nickname: string; incoming: boolean }[];
  groups: {
    id: string;
    name: string;
    timezone: string;
    status: "pending" | "active";
    invited: boolean;
    today: string;
    streak: number;
    best: number;
    completed: boolean;
    members: {
      id: string;
      nickname: string;
      accepted: boolean;
      trained: boolean;
    }[];
  }[];
};
export const deviceTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function useSocial(
  enabled: boolean,
  workouts: Workout[],
  onRemote: (remote: Workout[]) => void,
) {
  const [state, setState] = useState<SocialState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const latest = useRef({ workouts, onRemote });
  latest.current = { workouts, onRemote };
  const syncing = useRef(false);
  const todayWorkout = workouts.find((w) => w.date === localDate());
  const refresh = useCallback(async () => {
    if (!enabled || syncing.current) return;
    syncing.current = true;
    setBusy(true);
    try {
      const workout = latest.current.workouts.find(
        (w) => w.date === localDate(),
      );
      if (workout)
        await backendRpc("confirm_daily_workout", {
          p_day: workout.date,
          p_activity: workout.activity,
          p_minutes: workout.minutes,
          p_timezone: deviceTimezone(),
        });
      const next = await backendRpc<SocialState>("get_social_state");
      setState(next);
      latest.current.onRemote(next.workouts);
      setError("");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      syncing.current = false;
      setBusy(false);
    }
  }, [enabled]);
  useEffect(() => {
    void refresh();
  }, [refresh, todayWorkout?.id]);
  useEffect(() => {
    if (!enabled) return;
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60000);
    return () => {
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", visible);
      clearInterval(timer);
    };
  }, [enabled, refresh]);
  async function act(name: string, args: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await backendRpc(name, args);
      await refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const pending = Boolean(
    todayWorkout && !state?.workouts.some((w) => w.date === todayWorkout.date),
  );
  return { state, error, busy, pending, refresh, act };
}
