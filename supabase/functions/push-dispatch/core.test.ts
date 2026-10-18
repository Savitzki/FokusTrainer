import { strict as assert } from "node:assert";
import { createECDH, randomBytes } from "node:crypto";
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from "npm:web-push@3.6.7";
import ece from "npm:http_ece@1.2.1";
import {
  allowedEndpoint,
  dispatch,
  pushMessage,
  type PushJob,
} from "./core.ts";

const job: PushJob = {
  job_id: "job",
  lease_id: "lease",
  endpoint: "https://fcm.googleapis.com/test",
  p256dh: "test",
  auth: "test",
  vapid_key: "public",
  tone: "dramatic",
  slot: "last_call",
  day: "2026-10-16",
  time_zone: "UTC",
};
const request = (secret = "cron") =>
  new Request("https://example.com/push", {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

Deno.test(
  "rejects unauthenticated cron without accessing the database",
  async () => {
    const response = await dispatch(
      request("wrong"),
      { cronSecret: "cron", publicKey: "public" },
      () => {
        throw new Error("Database accessed");
      },
      () => {
        throw new Error("Push sent");
      },
    );
    assert.equal(response.status, 401);
  },
);
Deno.test(
  "restricts push destinations, including redirects/credentials/ports",
  () => {
    assert(allowedEndpoint("https://web.push.apple.com/valid"));
    for (const endpoint of [
      "https://127.0.0.1/a",
      "http://fcm.googleapis.com/a",
      "https://fcm.googleapis.com.evil.test/a",
      "https://user:pass@fcm.googleapis.com/a",
      "https://fcm.googleapis.com:8080/a",
    ])
      assert(!allowedEndpoint(endpoint));
  },
);
Deno.test("separates optional drama from the gentle tone", () => {
  assert.equal(pushMessage(job).body, "Vai hoje ou não?");
  assert.equal(
    pushMessage({ ...job, tone: "gentle" }).body,
    "Seu treino de hoje está no plano.",
  );
  assert(pushMessage(job).title.startsWith("Capibora"));
  assert.equal(pushMessage(job).tag, "fokus-2026-10-16-last_call");
});
for (const [status, result] of [
  [201, "sent"],
  [410, "gone"],
  [404, "gone"],
  [429, "retry"],
  [503, "retry"],
  [400, "expired"],
] as const) {
  Deno.test(`provider ${status} produces ${result}`, async () => {
    const calls: { name: string; args: Record<string, unknown> }[] = [];
    const rpc = async <T>(
      name: string,
      args: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ name, args });
      return (
        name === "claim_push_jobs"
          ? [job]
          : name === "push_job_allowed"
            ? true
            : null
      ) as T;
    };
    const response = await dispatch(
      request(),
      { cronSecret: "cron", publicKey: "public" },
      rpc,
      async () => status,
    );
    assert.equal(response.status, 200);
    assert.equal(calls.at(-1)?.args.p_result, result);
    assert.equal(calls.at(-1)?.args.p_lease, "lease");
  });
}
Deno.test(
  "rechecks workouts and never sends stale or rotated subscriptions",
  async () => {
    let sent = 0;
    const rpc = async <T>(name: string): Promise<T> =>
      (name === "claim_push_jobs"
        ? [
            job,
            { ...job, vapid_key: "old" },
            { ...job, endpoint: "https://internal.invalid/x" },
          ]
        : false) as T;
    await dispatch(
      request(),
      { cronSecret: "cron", publicKey: "public" },
      rpc,
      async () => {
        sent++;
        return 201;
      },
    );
    assert.equal(sent, 0);
  },
);
Deno.test(
  "web-push generates encrypted aes128gcm payload that the device can decrypt",
  () => {
    const receiver = createECDH("prime256v1");
    receiver.generateKeys();
    const secret = randomBytes(16);
    const vapid = webpush.generateVAPIDKeys();
    const payload = JSON.stringify(pushMessage(job));
    const details = webpush.generateRequestDetails(
      {
        endpoint: job.endpoint,
        keys: {
          p256dh: receiver.getPublicKey().toString("base64url"),
          auth: secret.toString("base64url"),
        },
      },
      payload,
      {
        TTL: 60,
        vapidDetails: { subject: "mailto:test@example.com", ...vapid },
        contentEncoding: "aes128gcm",
      },
    );
    assert.equal(details.headers["Content-Encoding"], "aes128gcm");
    assert(String(details.headers.Authorization).startsWith("vapid "));
    const decrypted = ece.decrypt(details.body, {
      version: "aes128gcm",
      privateKey: receiver,
      authSecret: secret,
    });
    assert.equal(decrypted.toString(), payload);
  },
);
