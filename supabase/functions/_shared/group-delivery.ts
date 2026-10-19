import { selectSocialNotification } from "./capibora.ts";
import { allowedEndpoint } from "../push-dispatch/core.ts";
export type GroupPushJob = {
  job_id: string;
  lease_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  vapid_key: string;
  title: string;
  body: string;
  tag: string;
};
export type Rpc = <T>(
  name: string,
  args: Record<string, unknown>,
) => Promise<T>;
export async function deliverGroupJobs(
  publicKey: string,
  rpc: Rpc,
  send: (job: GroupPushJob, payload: string) => Promise<number>,
  senderId: string | null = null,
) {
  const jobs = await rpc<GroupPushJob[]>("claim_group_push_jobs", {
    p_limit: 24,
    p_sender_id: senderId,
  });
  let sent = 0,
    retry = 0,
    expired = 0;
  for (let offset = 0; offset < jobs.length; offset += 8) {
    await Promise.all(
      jobs.slice(offset, offset + 8).map(async (job) => {
        let result = "expired";
        try {
          if (
            job.vapid_key === publicKey &&
            allowedEndpoint(job.endpoint) &&
            (await rpc<boolean>("group_push_job_allowed", {
              p_id: job.job_id,
              p_lease: job.lease_id,
            }))
          ) {
            const copy = selectSocialNotification(job.tag);
            const status = await send(
              job,
              JSON.stringify({
                title: copy.title,
                body: copy.body,
                tag: job.tag,
              }),
            );
            result =
              status >= 200 && status < 300
                ? "sent"
                : status === 404 || status === 410
                  ? "gone"
                  : status === 429 || status >= 500
                    ? "retry"
                    : "expired";
          }
        } catch {
          result = "retry";
        }
        await rpc("finish_group_push_job", {
          p_id: job.job_id,
          p_lease: job.lease_id,
          p_result: result,
        });
        if (result === "sent") sent++;
        else if (result === "retry") retry++;
        else expired++;
      }),
    );
  }
  return { claimed: jobs.length, sent, retry, expired };
}
