import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useSyncedResource } from "./useSyncedResource";
import { syncRetryDelay, syncStates } from "./sync";

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const options = (id: string, read: () => Promise<unknown>) => ({
  userId: id, resource: "economy" as const, queryKey: "wallet", enabled: true,
  cacheKey: `test:retry:${id}`, read, parse: (v: unknown) => v as number,
});

it("revalida silenciosamente com backoff crescente, sem apagar o cache ou repetir no foco", async () => {
  localStorage.setItem("test:retry:cached", "120");
  const read = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
  const hook = renderHook(() => useSyncedResource(options("cached", read)));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(hook.result.current.error).toBe("");
  expect(hook.result.current.state).toBe(120);
  for (let i = 0; i < 5; i++) fireEvent(window, new Event("focus"));
  await act(async () => { await vi.advanceTimersByTimeAsync(1999); });
  expect(read).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(read).toHaveBeenCalledTimes(2);
  expect(localStorage.getItem("test:retry:cached")).toBe("120");
  await act(async () => { await vi.advanceTimersByTimeAsync(3999); });
  expect(read).toHaveBeenCalledTimes(2);
  read.mockResolvedValue(140);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(read).toHaveBeenCalledTimes(3);
  expect(hook.result.current.state).toBe(140);
  expect(hook.result.current.sync.stale).toBe(false);
  expect(localStorage.getItem("test:retry:cached")).toBe("140");
});

it("pausa offline e retoma uma vez quando a rede volta", async () => {
  const read = vi.fn().mockRejectedValue(new Error("Servidor indisponível"));
  renderHook(() => useSyncedResource(options("online", read)));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  fireEvent(window, new Event("offline"));
  await act(async () => { await vi.advanceTimersByTimeAsync(300000); });
  expect(read).toHaveBeenCalledTimes(1);
  read.mockResolvedValue(5);
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  await act(async () => { fireEvent(window, new Event("online")); });
  expect(read).toHaveBeenCalledTimes(2);
});

it.each([401, 403, 409, 422])("não repete automaticamente uma recusa definitiva %s", async (status) => {
  const read = vi.fn().mockRejectedValue({ status, message: "Ação necessária" });
  const hook = renderHook(() => useSyncedResource(options(`denied-${status}`, read)));
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(read).toHaveBeenCalledTimes(1);
  expect(hook.result.current.error).toBeTruthy();
});

it("não repete compras nem oculta uma operação que ficou sem confirmação", async () => {
  const read = vi.fn().mockResolvedValue(120);
  const operation = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
  const hook = renderHook(() => useSyncedResource(options("purchase", read)));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  await act(async () => {
    expect((await hook.result.current.mutate(operation, "buy_medical_kit")).committed).toBe(false);
  });
  expect(hook.result.current.error).toContain("Failed to fetch");
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(operation).toHaveBeenCalledOnce();
  expect(hook.result.current.state).toBe(120);
});

it("encerra tentativas ao desmontar/trocar de conta e limita o atraso com jitter", async () => {
  const read = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
  const hook = renderHook(() => useSyncedResource(options("leaving", read)));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  hook.unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(300000); });
  expect(read).toHaveBeenCalledOnce();
  expect(syncStates("leaving")).toEqual([]);
  expect(syncRetryDelay(1, 0)).toBe(1600);
  expect(syncRetryDelay(1, 1)).toBe(2400);
  expect(syncRetryDelay(100, 1)).toBe(300000);
});
