import { afterEach, beforeEach, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("./backend", () => ({ backendRpc: rpc }));
const unsubscribe = vi.fn(),
  subscribe = vi.fn(),
  getSubscription = vi.fn();
const subscription = {
  endpoint: "https://fcm.googleapis.com/test",
  options: {},
  toJSON: () => ({
    endpoint: "https://fcm.googleapis.com/test",
    keys: { p256dh: "public", auth: "auth" },
  }),
  unsubscribe,
};
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv(
    "VITE_VAPID_PUBLIC_KEY",
    btoa(String.fromCharCode(4) + "a".repeat(64)).replace(/=/g, ""),
  );
  rpc.mockResolvedValue(null);
  unsubscribe.mockResolvedValue(true);
  subscribe.mockResolvedValue(subscription);
  getSubscription.mockResolvedValue(null);
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", {
    requestPermission: vi.fn().mockResolvedValue("granted"),
  });
  const registration = { pushManager: { getSubscription, subscribe } };
  vi.stubGlobal("navigator", {
    serviceWorker: {
      register: vi.fn().mockResolvedValue(registration),
      ready: Promise.resolve(registration),
      getRegistration: vi.fn().mockResolvedValue(registration),
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("solicita permissão antes de criar uma assinatura e salva o tom escolhido", async () => {
  const { enablePush } = await import("./push");
  await enablePush({ hour: 18, tone: "dramatic" });
  expect(subscribe).toHaveBeenCalledWith(
    expect.objectContaining({ userVisibleOnly: true }),
  );
  expect(rpc).toHaveBeenCalledWith(
    "save_push_device",
    expect.objectContaining({
      p_hour: 18,
      p_tone: "dramatic",
      p_endpoint: subscription.endpoint,
    }),
  );
});
it("não cadastra aparelho se a pessoa recusar permissão", async () => {
  vi.mocked(Notification.requestPermission).mockResolvedValue("denied");
  const { enablePush } = await import("./push");
  await expect(enablePush({ hour: 18, tone: "gentle" })).rejects.toThrow(
    /Permissão/,
  );
  expect(subscribe).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
it("remove uma assinatura recém-criada se o banco não salvar", async () => {
  rpc.mockRejectedValue(new Error("Offline"));
  const { enablePush } = await import("./push");
  await expect(enablePush({ hour: 18, tone: "gentle" })).rejects.toThrow(
    "Offline",
  );
  expect(unsubscribe).toHaveBeenCalledOnce();
});
it("preserva a assinatura existente quando só a atualização de preferências falha", async () => {
  getSubscription.mockResolvedValue(subscription);
  rpc.mockRejectedValue(new Error("Offline"));
  const { enablePush } = await import("./push");
  await expect(enablePush({ hour: 18, tone: "gentle" })).rejects.toThrow(
    "Offline",
  );
  expect(unsubscribe).not.toHaveBeenCalled();
});
it("desativa no servidor antes de remover a assinatura do aparelho", async () => {
  getSubscription.mockResolvedValue(subscription);
  const { disablePush } = await import("./push");
  await disablePush();
  expect(rpc).toHaveBeenCalledWith("disable_push_device", {
    p_endpoint: subscription.endpoint,
  });
  expect(unsubscribe).toHaveBeenCalledOnce();
});
