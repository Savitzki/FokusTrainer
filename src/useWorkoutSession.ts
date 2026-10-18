import { useEffect, useRef, useState } from "react";
import { backendRpc } from "./backend";
import { deviceTimezone } from "./social";
import { readRecordingState, sessionSeconds } from "./workoutRecording";
import { useSyncedResource } from "./useSyncedResource";
import { withSync } from "./sync";

/** Active sessions are never persisted in a client cache; only the server validates time. */
export function useWorkoutSession(userId: string | null, enabled: boolean) {
  const anchor = useRef(0);
  const resource = useSyncedResource({
    userId,
    resource: "session",
    queryKey: "session",
    enabled: Boolean(userId && enabled),
    read: () =>
      backendRpc("get_workout_recording_state", {
        p_timezone: deviceTimezone(),
      }),
    parse: readRecordingState,
    onData() {
      anchor.current = performance.now();
    },
  });
  return withSync(
    {
      state: resource.state,
      error: resource.error,
      busy: resource.busy,
      recovering: resource.sync.initialLoading,
      anchor,
      refresh: resource.refresh,
      act: async (name: string, params: Record<string, unknown>) => {
        const result = await resource.mutate(
          () => backendRpc(name, { ...params, p_timezone: deviceTimezone() }),
          name,
        );
        return result.committed ? result.value : null;
      },
    },
    resource.sync,
  );
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
