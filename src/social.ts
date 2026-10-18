import { useCallback, useEffect, useRef, useState } from "react";
import { backendRpc } from "./backend";
import { localDate, type Workout } from "./model";
import { dateInTimezone } from "./training";
import { validReview } from "./workoutRecording";

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
    resting?: boolean;
    completedAt?: string | null;
    members: {
      id: string;
      nickname: string;
      accepted: boolean;
      trained: boolean;
      resting?: boolean;
      rescheduledTo?: string | null;
      rescheduledFrom?: string | null;
      confirmedAt?: string | null;
    }[];
  }[];
};
export const deviceTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function rankGroupMembers(
  members: SocialState["groups"][number]["members"],
) {
  const stamp = (member: (typeof members)[number]) => {
    if (
      !member.accepted ||
      member.resting ||
      !member.trained ||
      !member.confirmedAt ||
      !Number.isFinite(Date.parse(member.confirmedAt))
    )
      return null;
    // PostgreSQL keeps microseconds; Date alone would turn close finishes into ties.
    const seconds = new Date(member.confirmedAt).toISOString().slice(0, 19);
    const fraction = (member.confirmedAt.match(/\.(\d+)/)?.[1] ?? "")
      .padEnd(6, "0")
      .slice(0, 6);
    return `${seconds}.${fraction}`;
  };
  const sorted = [...members].sort((a, b) => {
    const left = stamp(a),
      right = stamp(b);
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return left < right ? -1 : left > right ? 1 : 0;
  });
  return sorted.map((member) => ({
    ...member,
    place:
      stamp(member) !== null
        ? sorted.filter(
            (other) => stamp(other) !== null && stamp(other)! < stamp(member)!,
          ).length + 1
        : null,
  }));
}

export function useSocial(
  enabled: boolean,
  workouts: Workout[],
  onRemote: (remote: Workout[], confirmed?: Workout) => void,
  timezone?: string,
  serverDay?: string,
) {
  const [state, setState] = useState<SocialState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const latest = useRef({ workouts, onRemote });
  latest.current = { workouts, onRemote };
  const syncing = useRef(false);
  const today =
    serverDay ??
    (timezone ? dateInTimezone(new Date(), timezone) : localDate());
  const todayWorkout = workouts.find((w) => w.date === today);
  const refresh = useCallback(async () => {
    if (!enabled || syncing.current) return;
    syncing.current = true;
    setBusy(true);
    try {
      if (!navigator.onLine) {
        setError("Conecte-se à internet para confirmar o treino pendente");
        return;
      }
      const workout = latest.current.workouts.find((w) => w.date === today);
      let confirmed: Workout | undefined;
      let submissionError = "";
      if (
        workout &&
        !workout.confirmedAt &&
        workout.method === "manual" &&
        validReview(workout.review)
      ) {
        try {
          confirmed = await backendRpc<Workout>("confirm_manual_workout", {
            p_request_id: workout.id,
            p_day: workout.date,
            p_activity: workout.activity,
            p_minutes: workout.minutes,
            p_review: workout.review,
            p_timezone: timezone ?? deviceTimezone(),
          });
        } catch (e) {
          submissionError = (e as Error).message;
        }
      }
      const next = await backendRpc<SocialState>("get_social_state");
      setState(next);
      if (confirmed?.confirmedAt)
        latest.current.onRemote(next.workouts, confirmed);
      else latest.current.onRemote(next.workouts);
      setError(
        next.workouts.some((w) => w.date === workout?.date)
          ? ""
          : submissionError,
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      syncing.current = false;
      setBusy(false);
    }
  }, [enabled, today, timezone]);
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
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      await backendRpc(name, args);
      await refresh();
      return true;
    } catch (error) {
      setError((error as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const pending = Boolean(
    todayWorkout && !state?.workouts.some((w) => w.date === todayWorkout.date),
  );
  return { state, error, busy, pending, refresh, act };
}
