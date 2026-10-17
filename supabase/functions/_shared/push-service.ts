// @deno-types="npm:@types/web-push@3.6.4"
import webpush from "npm:web-push@3.6.7";
export const required = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
export const supabaseURL = required("SUPABASE_URL"),
  serviceKey = required("SUPABASE_SERVICE_ROLE_KEY"),
  publicKey = required("VAPID_PUBLIC_KEY");
const privateKey = required("VAPID_PRIVATE_KEY"),
  subject = required("VAPID_SUBJECT");
export async function rpc<T>(
  name: string,
  args: Record<string, unknown>,
  authorization = `Bearer ${serviceKey}`,
): Promise<T> {
  const response = await fetch(`${supabaseURL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(5000),
    redirect: "error",
  });
  if (!response.ok) {
    let code = "";
    try {
      code = (await response.json()).code ?? "";
    } catch { /* No internal error body is logged or returned. */ }
    throw Object.assign(new Error("Backend RPC failed"), { code });
  }
  const text = await response.text();
  return text ? JSON.parse(text) as T : null as T;
}
export async function send(
  job: { endpoint: string; p256dh: string; auth: string },
  payload: string,
) {
  const details = webpush.generateRequestDetails(
    { endpoint: job.endpoint, keys: { p256dh: job.p256dh, auth: job.auth } },
    payload,
    {
      TTL: 300,
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
