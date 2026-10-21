import { act, renderHook } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { useArenaRealtime } from "./useArenaRealtime";
const mock = vi.hoisted(() => ({ get: vi.fn(), invalidate: vi.fn() }));
vi.mock("./backend", () => ({ getBackendClient: mock.get }));
vi.mock("./sync", () => ({ invalidateSync: mock.invalidate }));
beforeEach(() => {
  vi.useFakeTimers();
  mock.get.mockReset();
  mock.invalidate.mockReset();
});
afterEach(() => vi.useRealTimers());
function client() {
  let receive!: () => void, subscribe!: (status: string) => void;
  const channel = {
    on: vi.fn((_event, _filter, callback) => {
      receive = callback;
      return channel;
    }),
    subscribe: vi.fn((cb) => {
      subscribe = cb;
      return channel;
    }),
  };
  const value = { channel: vi.fn(() => channel), removeChannel: vi.fn() };
  mock.get.mockResolvedValue(value);
  return {
    value,
    channel,
    receive: () => receive(),
    subscribed: () => subscribe("SUBSCRIBED"),
  };
}
it("usa um canal por conta, filtrado sem conteúdo privado e agrupa rajadas de eventos", async () => {
  const c = client();
  const view = renderHook(() => useArenaRealtime("alpha"));
  await act(async () => {});
  expect(c.channel.on).toHaveBeenCalledWith(
    "postgres_changes",
    expect.objectContaining({
      table: "arena_inbox_signals",
      filter: "user_id=eq.alpha",
    }),
    expect.any(Function),
  );
  act(() => {
    c.subscribed();
    c.receive();
    c.receive();
    vi.advanceTimersByTime(100);
  });
  expect(mock.invalidate).toHaveBeenCalledExactlyOnceWith("alpha", [
    "inbox",
    "social",
  ]);
  view.unmount();
  expect(c.value.removeChannel).toHaveBeenCalledWith(c.channel);
  act(() => {
    c.receive();
    vi.advanceTimersByTime(100);
  });
  expect(mock.invalidate).toHaveBeenCalledTimes(1);
});
it("troca de conta encerra o canal antigo e nunca invalida a conta anterior", async () => {
  const c = client();
  const view = renderHook(({ id }) => useArenaRealtime(id), {
    initialProps: { id: "alpha" },
  });
  await act(async () => {});
  act(() => c.receive());
  view.rerender({ id: "beta" });
  await act(async () => {});
  act(() => vi.advanceTimersByTime(100));
  expect(c.value.removeChannel).toHaveBeenCalledOnce();
  expect(mock.invalidate).not.toHaveBeenCalled();
  act(() => {
    c.receive();
    vi.advanceTimersByTime(100);
  });
  expect(mock.invalidate).toHaveBeenCalledExactlyOnceWith("beta", [
    "inbox",
    "social",
  ]);
});
it("não abre canal quando o cliente resolve depois do logout", async () => {
  let resolve!: (value: unknown) => void;
  mock.get.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const view = renderHook(() => useArenaRealtime("alpha"));
  view.unmount();
  const channel = vi.fn();
  await act(async () => resolve({ channel }));
  expect(channel).not.toHaveBeenCalled();
});
it("falha do Realtime preserva o fallback de sincronização, sem loop de novas assinaturas", async () => {
  mock.get.mockRejectedValue(new Error("Unavailable"));
  const view = renderHook(() => useArenaRealtime("alpha"));
  await act(async () => {});
  view.rerender();
  expect(mock.get).toHaveBeenCalledOnce();
});
