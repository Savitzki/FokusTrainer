import { accountConfigured, backendRpc } from "./backend";
import { STORAGE_KEY } from "./model";
import {
  hasTrainingPlan,
  readTrainingState,
  type TrainingState,
} from "./training";
import { deviceTimezone } from "./social";
import { useSyncedResource } from "./useSyncedResource";
import { invalidateSync, withSync } from "./sync";

export type TrainingController = ReturnType<typeof useTrainingPlan>;
export function useTrainingPlan(userId: string | null, disabled = false) {
  const enabled = Boolean(userId && accountConfigured && !disabled);
  const resource = useSyncedResource<TrainingState>({
    userId,
    resource: "training",
    queryKey: "training",
    enabled,
    cacheKey: userId ? `${STORAGE_KEY}:account:${userId}:training` : undefined,
    parse: readTrainingState,
    accept: (next, previous) => next.revision >= previous.revision,
    read: (): Promise<unknown> =>
      backendRpc("get_training_state", {
        p_timezone: resource.getCurrent()?.timezone ?? deviceTimezone(),
      }),
    onData(next, previous, source) {
      if (
        source === "read" &&
        previous &&
        (next.revision !== previous.revision || next.today !== previous.today)
      )
        invalidateSync(userId, [
          "social",
          "gamification",
          "reports",
          "challenges",
          "economy",
        ]);
    },
  });
  async function request(name: string, args: Record<string, unknown> = {}) {
    const result = await resource.mutate(
      () =>
        backendRpc(name, {
          p_timezone: resource.getCurrent()?.timezone ?? deviceTimezone(),
          ...args,
        }),
      name,
    );
    return result.committed;
  }
  return withSync(
    {
      state: resource.state,
      busy: resource.busy,
      error: resource.error,
      enabled,
      refresh: resource.refresh,
      getCurrent: resource.getCurrent,
      save: (days: number[]) =>
        request("save_training_plan", {
          p_training_days: days,
          p_replace: hasTrainingPlan(resource.getCurrent()),
          p_revision: resource.getCurrent()?.revision ?? -1,
        }),
      rest: () => request("authorize_extra_rest"),
      reschedule: (originalDay: string, targetDay: string) =>
        request("reschedule_training", {
          p_original_day: originalDay,
          p_target_day: targetDay,
          p_revision: resource.getCurrent()?.revision ?? -1,
        }),
    },
    resource.sync,
  );
}
