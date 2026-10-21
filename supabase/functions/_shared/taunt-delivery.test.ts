import { expect, it, vi } from "vitest";
import { deliverTauntJobs } from "./taunt-delivery";
const job = {
  job_id: "j",
  lease_id: "l",
  endpoint: "https://fcm.googleapis.com/send/fixture",
  p256dh: "p",
  auth: "a",
  vapid_key: "v",
  title: "Amigo",
  body: "Duvido",
  tag: "capibora-taunt-id",
};
it("não envia quando o serviço está desativado", async () => {
  const rpc = vi.fn().mockResolvedValue([]),
    send = vi.fn();
  expect(await deliverTauntJobs("v", rpc, send)).toEqual({
    claimed: 0,
    sent: 0,
    expired: 0,
  });
  expect(send).not.toHaveBeenCalled();
});
it("revalida autorização imediatamente antes do envio e finaliza a tentativa", async () => {
  const rpc = vi
      .fn()
      .mockImplementation(async (name) =>
        name === "claim_arena_taunt_push"
          ? [job]
          : name === "arena_taunt_push_allowed"
            ? false
            : null,
      ),
    send = vi.fn();
  await deliverTauntJobs("v", rpc, send);
  expect(send).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledWith("finish_arena_taunt_push", {
    p_id: "j",
    p_lease: "l",
  });
});
it("envia só a mensagem social autorizada e não repete falha incerta", async () => {
  const rpc = vi
      .fn()
      .mockImplementation(async (name) =>
        name === "claim_arena_taunt_push"
          ? [job]
          : name === "arena_taunt_push_allowed"
            ? true
            : null,
      ),
    send = vi.fn().mockResolvedValue(201);
  expect((await deliverTauntJobs("v", rpc, send)).sent).toBe(1);
  expect(JSON.parse(send.mock.calls[0][1])).toEqual(
    expect.objectContaining({
      title: "Capibora",
      body: "Psiu, alguém mandou uma provocação",
      tag: "capibora-taunt-id",
    }),
  );
  expect(send).toHaveBeenCalledOnce();
});
