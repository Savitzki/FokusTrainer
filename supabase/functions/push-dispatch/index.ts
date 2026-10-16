// @deno-types="npm:@types/web-push@3.6.4"
import webpush from "npm:web-push@3.6.7";
import { dispatch, type PushJob } from "./core.ts";

const required = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
const supabaseURL = required("SUPABASE_URL");
const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
const publicKey = required("VAPID_PUBLIC_KEY");
const privateKey = required("VAPID_PRIVATE_KEY");
const subject = required("VAPID_SUBJECT");
const cronSecret = required("PUSH_CRON_SECRET");

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${supabaseURL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(5000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("Backend RPC failed");
  const body = await response.text();
  return body ? (JSON.parse(body) as T) : (null as T);
}
async function send(job: PushJob, payload: string) {
  const details = webpush.generateRequestDetails(
    { endpoint: job.endpoint, keys: { p256dh: job.p256dh, auth: job.auth } },
    payload,
    {
      TTL: 60,
      urgency: "normal",
      vapidDetails: { subject, publicKey, privateKey },
      contentEncoding: "aes128gcm",
    },
  );
  const response = await fetch(details.endpoint, {
    method: "POST",
    headers: details.headers as Record<string, string>,
    body: details.body as Uint8Array<ArrayBuffer>,
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  await response.body?.cancel();
  return response.status;
}
Deno.serve((request) =>
  dispatch(request, { cronSecret, publicKey }, rpc, send),
);
