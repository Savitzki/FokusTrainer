import { accountConfigured, backendRpc } from "./backend";
import { readFriendProfile } from "./friendProfile";
import { useSyncedResource } from "./useSyncedResource";

/** Friendship-scoped data stays in memory; both views share the transport key. */
export function useFriendProfile(
  userId: string | null,
  friendId: string,
  enabled = true,
) {
  return useSyncedResource({
    userId,
    resource: "showcase",
    queryKey: `get_friend_showcase:${friendId}`,
    enabled: Boolean(enabled && userId && accountConfigured),
    read: () => backendRpc("get_friend_showcase", { p_user: friendId }),
    parse: readFriendProfile,
  });
}
