import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearAccountStorage } from "./accountStorage";
import { useNotificationOnboarding } from "./useNotificationOnboarding";
const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  subscribe: vi.fn(),
  decline: vi.fn(),
  subscription: vi.fn(),
  supported: vi.fn(),
  permission: vi.fn(),
}));
vi.mock("./backend", () => ({ accountConfigured: true, backendRpc: mock.rpc }));
vi.mock("./push", async () => ({
  ...(await vi.importActual<typeof import("./push")>("./push")),
  pushPublicKey: "test-public-key",
  pushSupported: mock.supported,
  currentPushSubscription: mock.subscription,
  requestPushPermission: mock.permission,
  enableAutomaticPush: mock.subscribe,
  declinePush: mock.decline,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mock.supported.mockReturnValue(true);
  mock.permission.mockResolvedValue(undefined);
  mock.subscription.mockResolvedValue(null);
  mock.rpc.mockResolvedValue({ decision: "pending", registered: false });
  mock.subscribe.mockResolvedValue({ decision: "accepted", registered: true });
  mock.decline.mockResolvedValue({ decision: "declined", registered: false });
  vi.stubGlobal("Notification", {
    permission: "default",
    requestPermission: vi.fn(),
  });
});
afterEach(() => vi.unstubAllGlobals());
it("aguarda conta, nick e avatar completos sem pedir permissão por conta própria", async () => {
  const view = renderHook(
    ({ id, complete }) => useNotificationOnboarding(id, complete),
    { initialProps: { id: null as string | null, complete: false } },
  );
  expect(mock.rpc).not.toHaveBeenCalled();
  view.rerender({ id: "invite-new", complete: false });
  expect(mock.rpc).not.toHaveBeenCalled();
  expect(view.result.current.prompt).toBe(false);
  view.rerender({ id: "invite-new", complete: true });
  await waitFor(() => expect(view.result.current.prompt).toBe(true));
  expect(Notification.requestPermission).not.toHaveBeenCalled();
  expect(mock.subscribe).not.toHaveBeenCalled();
  await act(async () => {
    await view.result.current.enable();
  });
  expect(mock.subscribe).toHaveBeenCalledOnce();
  expect(view.result.current.prompt).toBe(false);
});
it("guarda a recusa e não repete após reabrir nem em edições de perfil", async () => {
  const first = renderHook(() => useNotificationOnboarding("invite-no", true));
  await waitFor(() => expect(first.result.current.prompt).toBe(true));
  await act(async () => {
    await first.result.current.decline();
  });
  expect(mock.decline).toHaveBeenCalledOnce();
  expect(mock.subscribe).not.toHaveBeenCalled();
  const installation = mock.decline.mock.calls[0][0];
  first.unmount();
  mock.rpc.mockResolvedValue({ decision: "declined", registered: false });
  const second = renderHook(() => useNotificationOnboarding("invite-no", true));
  await waitFor(() => expect(mock.rpc).toHaveBeenCalledTimes(2));
  expect(mock.rpc.mock.calls[1][1].p_installation_id).toBe(installation);
  expect(second.result.current.prompt).toBe(false);
});
it("restaura assinatura de aparelho já aceito sem novo pedido nativo", async () => {
  vi.stubGlobal("Notification", {
    permission: "granted",
    requestPermission: vi.fn(),
  });
  mock.rpc.mockResolvedValue({ decision: "accepted", registered: false });
  const view = renderHook(() =>
    useNotificationOnboarding("invite-restore", true),
  );
  await waitFor(() => expect(mock.subscribe).toHaveBeenCalledOnce());
  await waitFor(() => expect(view.result.current.allowed).toBe(true));
  expect(view.result.current.prompt).toBe(false);
  expect(Notification.requestPermission).not.toHaveBeenCalled();
});
it.each(["denied", "unsupported"])(
  "não abre convite sem suporte/permissão: %s",
  async (permission) => {
    if (permission === "unsupported") mock.supported.mockReturnValue(false);
    else vi.stubGlobal("Notification", { permission });
    const view = renderHook(() =>
      useNotificationOnboarding(`invite-${permission}`, true),
    );
    await waitFor(() => expect(mock.rpc).toHaveBeenCalled());
    act(() => view.result.current.request());
    expect(view.result.current.prompt).toBe(false);
    expect(mock.subscribe).not.toHaveBeenCalled();
  },
);
it("mantém convite após falha e não anuncia ativação", async () => {
  mock.subscribe.mockRejectedValue(new Error("Permissão não concedida"));
  const view = renderHook(() =>
    useNotificationOnboarding("invite-failure", true),
  );
  await waitFor(() => expect(view.result.current.prompt).toBe(true));
  await act(async () => {
    await expect(view.result.current.enable()).rejects.toThrow(
      "Permissão não concedida",
    );
  });
  expect(view.result.current.prompt).toBe(true);
  expect(view.result.current.allowed).toBe(false);
});
it("ignora consultas antigas após logout e separa a decisão da próxima conta", async () => {
  let resolve!: (v: unknown) => void;
  mock.rpc.mockReturnValueOnce(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const view = renderHook(({ id }) => useNotificationOnboarding(id, true), {
    initialProps: { id: "invite-old" },
  });
  await waitFor(() => expect(mock.rpc).toHaveBeenCalledOnce());
  act(() => clearAccountStorage("invite-old"));
  mock.rpc.mockResolvedValue({ decision: "declined", registered: false });
  view.rerender({ id: "invite-next" });
  await waitFor(() => expect(mock.rpc).toHaveBeenCalledTimes(2));
  await act(async () => resolve({ decision: "accepted", registered: true }));
  expect(view.result.current.allowed).toBe(false);
  expect(view.result.current.prompt).toBe(false);
});
it("não repete convite depois de fechar na mesma visita", async () => {
  const view = renderHook(() =>
    useNotificationOnboarding("invite-dismiss", true),
  );
  await waitFor(() => expect(view.result.current.prompt).toBe(true));
  act(() => view.result.current.dismiss());
  expect(view.result.current.prompt).toBe(false);
  expect(mock.decline).not.toHaveBeenCalled();
});

it("aguarda a decisão nativa antes de iniciar a operação de rede", async () => {
  let allow!: () => void;
  mock.permission.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      allow = resolve;
    }),
  );
  const view = renderHook(() =>
    useNotificationOnboarding("invite-native-wait", true),
  );
  await waitFor(() => expect(view.result.current.prompt).toBe(true));
  let activation!: Promise<void>;
  act(() => {
    activation = view.result.current.enable();
  });
  expect(mock.permission).toHaveBeenCalledOnce();
  expect(mock.subscribe).not.toHaveBeenCalled();
  await act(async () => {
    allow();
    await activation;
  });
  expect(mock.subscribe).toHaveBeenCalledOnce();
});
