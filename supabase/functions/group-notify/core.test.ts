import { strict as assert } from "node:assert";
import { notify } from "./core.ts";
import {
  deliverGroupJobs,
  type GroupPushJob,
} from "../_shared/group-delivery.ts";
const workout = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  group = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const request = (
  body: unknown = { workout_id: workout, group_ids: [group] },
  authorized = true,
) =>
  new Request("https://example.invalid/group-notify", {
    method: "POST",
    headers: authorized ? { Authorization: "Bearer test" } : {},
    body: JSON.stringify(body),
  });
Deno.test("only an authenticated valid explicit request can enqueue a group alert", async () => {
  let enqueued = 0, delivered = 0;
  const deps = {
    authorize: async () => "actor",
    enqueue: async () => {
      enqueued++;
      return { queued: 1, already_sent: 0, recipients: 1 };
    },
    deliver: async () => {
      delivered++;
      return { sent: 1, retry: 0, expired: 0 };
    },
  };
  assert.equal((await notify(request({}, false), deps)).status, 401);
  assert.equal(
    (await notify(request(), { ...deps, authorize: async () => null })).status,
    401,
  );
  for (
    const body of [
      { workout_id: workout, group_ids: [] },
      { workout_id: "fake", group_ids: [group] },
      { workout_id: workout, group_ids: [group, group] },
      { workout_id: workout, group_ids: Array(21).fill(group) },
    ]
  ) assert.equal((await notify(request(body), deps)).status, 400);
  assert.equal(enqueued, 0);
  assert.equal(delivered, 0);
  const response = await notify(request(), deps);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).sent, 1);
  assert.equal(enqueued, 1);
  assert.equal(delivered, 1);
});
Deno.test("an accepted queue survives transient delivery failure without falsely reporting delivery", async () => {
  const response = await notify(request(), {
    authorize: async () => "actor",
    enqueue: async () => ({ queued: 2, already_sent: 0, recipients: 1 }),
    deliver: () => Promise.reject(Error("offline")),
  });
  assert.equal(response.status, 202);
  const data = await response.json();
  assert.equal(data.sent, 0);
  assert.equal(data.queued, 2);
  assert.equal(data.delayed, true);
});
Deno.test("delivery is limited to claimed jobs, authorized recipients and known push providers", async () => {
  const base: GroupPushJob = {
    job_id: "job",
    lease_id: "lease",
    endpoint: "https://fcm.googleapis.com/test",
    p256dh: "p",
    auth: "a",
    vapid_key: "key",
    title: "Dani acendeu a chama",
    body: "Time: treino registrado",
    tag: "event",
  };
  for (const kind of ["ok", "off", "unsafe", "oldkey", "retry", "gone"]) {
    let sends = 0;
    const calls: { name: string; args: Record<string, unknown> }[] = [];
    const rpc = async <T>(
      name: string,
      args: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ name, args });
      if (name === "claim_group_push_jobs") {
        return [{
          ...base,
          ...(kind === "unsafe"
            ? { endpoint: "https://127.0.0.1/private" }
            : kind === "oldkey"
            ? { vapid_key: "old" }
            : {}),
        }] as T;
      }
      if (name === "group_push_job_allowed") return (kind !== "off") as T;
      return null as T;
    };
    const result = await deliverGroupJobs("key", rpc, async (_job, payload) => {
      sends++;
      assert.equal(JSON.parse(payload).tag, "event");
      assert.match(JSON.parse(payload).body, /no seu grupo/);
      assert.doesNotMatch(JSON.parse(payload).body, /Bora manter|ficando pra trás|ainda não treinou/);
      return kind === "retry" ? 503 : kind === "gone" ? 410 : 201;
    }, "actor");
    assert.equal(calls[0].args.p_sender_id, "actor");
    assert.equal(sends, ["ok", "retry", "gone"].includes(kind) ? 1 : 0);
    assert.equal(
      calls.at(-1)?.args.p_result,
      kind === "ok"
        ? "sent"
        : kind === "retry"
        ? "retry"
        : kind === "gone"
        ? "gone"
        : "expired",
    );
    assert.equal(result.sent, kind === "ok" ? 1 : 0);
  }
});
