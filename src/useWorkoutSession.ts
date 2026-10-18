import { useCallback, useEffect, useRef, useState } from "react";
import { backendRpc } from "./backend";
import { accountStorageGeneration } from "./accountStorage";
import { deviceTimezone } from "./social";
import {
  readRecordingState,
  sessionSeconds,
  type RecordingState,
} from "./workoutRecording";

/** Sessions live only on the server. The monotonic anchor is presentation, never validation. */
export function useWorkoutSession(userId: string | null, enabled: boolean) {
  const [state, setState] = useState<RecordingState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(Boolean(userId && enabled));
  const anchor = useRef(0),
    alive = useRef(true),
    sequence = useRef(0),
    mutating = useRef(false);
  const generation = useRef(userId ? accountStorageGeneration(userId) : 0);
  const allowed = Boolean(userId && enabled);
  const current = useRef({ allowed, userId });
  current.current = { allowed, userId };
  const accept = useCallback((value: unknown) => {
    const next = readRecordingState(value);
    anchor.current = performance.now();
    setState(next);
    setError("");
    return next;
  }, []);
  const validAccount = useCallback(
    () =>
      alive.current &&
      current.current.allowed &&
      current.current.userId === userId &&
      Boolean(
        userId && generation.current === accountStorageGeneration(userId),
      ),
    [userId],
  );
  const refresh = useCallback(async () => {
    if (!allowed || mutating.current || !validAccount()) return;
    const request = ++sequence.current;
    try {
      const result = await backendRpc("get_workout_recording_state", {
        p_timezone: deviceTimezone(),
      });
      if (validAccount() && request === sequence.current) accept(result);
    } catch (e) {
      if (validAccount() && request === sequence.current)
        setError((e as Error).message);
    } finally {
      if (validAccount() && request === sequence.current) setRecovering(false);
    }
  }, [allowed, validAccount, accept]);
  useEffect(() => {
    alive.current = true;
    generation.current = userId ? accountStorageGeneration(userId) : 0;
    setState(null);
    setRecovering(allowed);
    void refresh();
    const resume = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("online", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    const timer = window.setInterval(resume, 60000);
    return () => {
      alive.current = false;
      sequence.current++;
      clearInterval(timer);
      window.removeEventListener("online", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [allowed, userId, refresh]);
  async function act(name: string, params: Record<string, unknown>) {
    if (!validAccount() || mutating.current) return null;
    if (!navigator.onLine) {
      setError(
        "Conecte-se à internet para iniciar, finalizar ou cancelar um treino",
      );
      return null;
    }
    mutating.current = true;
    sequence.current++;
    setBusy(true);
    setError("");
    try {
      const result = await backendRpc(name, {
        ...params,
        p_timezone: deviceTimezone(),
      });
      if (!validAccount()) return null;
      return accept(result);
    } catch (e) {
      if (validAccount()) setError((e as Error).message);
      return null;
    } finally {
      mutating.current = false;
      if (validAccount()) {
        setBusy(false);
        setRecovering(false);
      }
    }
  }
  return { state, error, busy, recovering, refresh, act, anchor };
}
export type WorkoutSessionController = ReturnType<typeof useWorkoutSession>;
export function useSessionClock(controller: WorkoutSessionController) {
  const [, tick] = useState(0);
  const active = controller.state?.session?.status === "active";
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return controller.state
    ? sessionSeconds(
        controller.state,
        (performance.now() - controller.anchor.current) / 1000,
      )
    : 0;
}
