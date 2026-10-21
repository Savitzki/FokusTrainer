import { allowedEndpoint } from "../push-dispatch/core.ts";
import type { GroupPushJob, Rpc } from "./group-delivery.ts";
/** Optional extension of the existing dispatcher; disabled by database policy. */
export async function deliverTauntJobs(
  publicKey: string,
  rpc: Rpc,
  send: (job: GroupPushJob, payload: string) => Promise<number>,
) {
  const jobs = await rpc<GroupPushJob[]>("claim_arena_taunt_push", {});
  let sent = 0,
    expired = 0;
  for (const job of jobs) {
    try {
      if (
        job.vapid_key === publicKey &&
        allowedEndpoint(job.endpoint) &&
        (await rpc<boolean>("arena_taunt_push_allowed", {
          p_id: job.job_id,
          p_lease: job.lease_id,
        }))
      ) {
        const status = await send(
          job,
          JSON.stringify({
            title: "Capibora",
            body: "Psiu, alguém mandou uma provocação",
            tag: job.tag,
            data: { url: "#/" },
          }),
        );
        if (status >= 200 && status < 300) sent++;
        else expired++;
      } else expired++;
    } catch {
      expired++;
    } finally {
      await rpc("finish_arena_taunt_push", {
        p_id: job.job_id,
        p_lease: job.lease_id,
      });
    }
  }
  return { claimed: jobs.length, sent, expired };
}
