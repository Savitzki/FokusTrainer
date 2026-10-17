import { notify } from "./core.ts";
import { deliverGroupJobs } from "../_shared/group-delivery.ts";
import {
  publicKey,
  rpc,
  send,
  serviceKey,
  supabaseURL,
} from "../_shared/push-service.ts";
Deno.serve((request) =>
  notify(request, {
    authorize: async () => {
      const response = await fetch(`${supabaseURL}/auth/v1/user`, {
        headers: {
          apikey: serviceKey,
          Authorization: request.headers.get("authorization") ?? "",
        },
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return null;
      return (await response.json()).id ?? null;
    },
    enqueue: (workoutId, groupIds) =>
      rpc("notify_workout_groups", {
        p_workout_id: workoutId,
        p_group_ids: groupIds,
      }, request.headers.get("authorization") ?? ""),
    deliver: (userId) => deliverGroupJobs(publicKey, rpc, send, userId),
  })
);
