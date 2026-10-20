import { deliverTauntJobs } from "../_shared/taunt-delivery.ts";
import { dispatch } from "./core.ts";
import { deliverGroupJobs } from "../_shared/group-delivery.ts";
import { publicKey, required, rpc, send } from "../_shared/push-service.ts";
const cronSecret = required("PUSH_CRON_SECRET");
Deno.serve(async (request) => {
  const response = await dispatch(
    request,
    { cronSecret, publicKey },
    rpc,
    send,
  );
  // Only a request already authorized by dispatch may process group jobs.
  if (response.status !== 200) return response;
  const result = await response.json();
  let groups: unknown, taunts: unknown;
  try {
    groups = await deliverGroupJobs(publicKey, rpc, send);
  } catch {
    groups = { unavailable: true };
  }
  try {
    taunts = await deliverTauntJobs(publicKey, rpc, send);
  } catch {
    taunts = { unavailable: true };
  }
  return Response.json({ ...result, groups, taunts });
});
