import { useEffect, useRef } from "react";
import { accountConfigured, backendRpc } from "./backend";
import { deviceTimezone } from "./social";
import { STORAGE_KEY } from "./model";
import { readGameState, type GameState } from "./gamification";
import { useSyncedResource } from "./useSyncedResource";
import { invalidateSync, withSync, type SyncResource } from "./sync";

export function useGameResource<T>(
  userId: string | null,
  rpc: string,
  args: Record<string, unknown>,
  parse: (x: unknown) => T,
  enabled = true,
) {
  const resourceName: SyncResource =
    rpc === "get_group_reactions"
      ? "social"
      : rpc === "get_friend_showcase"
        ? "showcase"
        : rpc === "get_progress_report"
          ? "reports"
          : rpc === "get_friend_challenges"
            ? "challenges"
            : "gamification";
  const key = `${rpc}:${JSON.stringify(args)}`;
  const resource = useSyncedResource({
    userId,
    resource: resourceName,
    queryKey: key,
    enabled: Boolean(userId && accountConfigured && enabled),
    cacheKey: userId
      ? `${STORAGE_KEY}:account:${userId}:resource:${key}`
      : undefined,
    read: () => backendRpc(rpc, args),
    parse,
  });
  return withSync(
    {
      state: resource.state,
      error: resource.error,
      busy: resource.busy,
      refresh: resource.refresh,
      act: async (name: string, params: Record<string, unknown>) =>
        (await resource.mutate(() => backendRpc(name, params), name, false))
          .committed,
    },
    resource.sync,
  );
}
export function useGamification(
  userId: string | null,
  revisionKey: string,
  enabled: boolean,
) {
  const game = useGameResource<GameState>(
    userId,
    "get_gamification_state",
    { p_timezone: deviceTimezone(), p_shop_version: 3 },
    readGameState,
    enabled,
  );
  const previousKey = useRef(revisionKey),
    previousUser = useRef(userId);
  useEffect(() => {
    if (previousUser.current !== userId) {
      previousUser.current = userId;
      previousKey.current = revisionKey;
      return;
    }
    if (previousKey.current !== revisionKey) {
      previousKey.current = revisionKey;
      invalidateSync(userId, ["gamification"]);
    }
  }, [revisionKey, userId]);
  return game;
}
export type GameController = ReturnType<typeof useGamification>;
