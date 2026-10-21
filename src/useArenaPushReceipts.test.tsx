import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useArenaPushReceipts } from "./useArenaPushReceipts";
import type { ArenaInbox } from "./arenaTaunts";
import type { ResourceSync } from "./sync";
const id = "d3701000-0000-4000-8000-000000000001";
const state: ArenaInbox = {
  version: 3,
  muted: false,
  push: true,
  messages: [
    {
      id,
      sender: "friend",
      nickname: "bia",
      messageId: "online",
      text: "Vai treinar ou só ficar online?",
      pose: "judging",
      createdAt: "2026-10-20T12:00:00Z",
      seen: false,
      canReply: true,
    },
  ],
};
const sync: ResourceSync = {
  initialLoading: false,
  refreshing: false,
  writing: false,
  stale: false,
  error: "",
  errorKind: null,
  lastSuccess: 1,
};
const dismissed = new Set<string>();
function event(messageId: unknown = id) {
  const port = { postMessage: vi.fn(), close: vi.fn() };
  return {
    port,
    event: {
      data: { type: "capibora:taunt-push", id: messageId },
      ports: [port],
    } as unknown as MessageEvent,
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it("confirma somente o ID entregue à conta atual após consulta válida", () => {
  const view = renderHook(() =>
    useArenaPushReceipts("alpha", state, sync, dismissed),
  );
  const request = event();
  act(() => view.result.current(request.event));
  expect(request.port.postMessage).toHaveBeenCalledExactlyOnceWith({
    received: true,
  });
  expect(request.port.close).toHaveBeenCalledOnce();
});
it("aguarda a sincronização real da nova mensagem sem antecipar recibo", () => {
  const view = renderHook(
    ({ data }: { data: ArenaInbox }) =>
      useArenaPushReceipts("alpha", data, sync, dismissed),
    { initialProps: { data: { ...state, messages: [] } as ArenaInbox } },
  );
  const request = event();
  act(() => view.result.current(request.event));
  expect(request.port.postMessage).not.toHaveBeenCalled();
  view.rerender({ data: state });
  expect(request.port.postMessage).toHaveBeenCalledExactlyOnceWith({
    received: true,
  });
});
it.each([
  { ...sync, lastSuccess: 0 },
  { ...sync, stale: true },
  { ...sync, errorKind: "auth" as const },
  { ...sync, errorKind: "network" as const },
  { ...sync, errorKind: "validation" as const },
])(
  "não descarta push com cache não validado ou sincronização indisponível: %j",
  (flags) => {
    const view = renderHook(() =>
      useArenaPushReceipts("alpha", state, flags, dismissed),
    );
    const request = event();
    act(() => {
      view.result.current(request.event);
      vi.advanceTimersByTime(1500);
    });
    expect(request.port.postMessage).not.toHaveBeenCalled();
    expect(request.port.close).toHaveBeenCalledOnce();
  },
);
it("um ID de outra conta não é confirmado, mesmo quando a página está visível", () => {
  const view = renderHook(() =>
    useArenaPushReceipts("alpha", state, sync, dismissed),
  );
  const request = event("d3701000-0000-4000-8000-000000000002");
  act(() => {
    view.result.current(request.event);
    vi.advanceTimersByTime(1500);
  });
  expect(request.port.postMessage).not.toHaveBeenCalled();
});
it("não confirma entrega na página em segundo plano ou durante silenciamento", () => {
  const visibility = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("hidden");
  const view = renderHook(
    ({ data }: { data: ArenaInbox }) =>
      useArenaPushReceipts("alpha", data, sync, dismissed),
    { initialProps: { data: state } },
  );
  const hidden = event();
  act(() => view.result.current(hidden.event));
  expect(hidden.port.postMessage).not.toHaveBeenCalled();
  visibility.mockReturnValue("visible");
  view.rerender({ data: { ...state, muted: true, messages: [] } });
  expect(hidden.port.postMessage).not.toHaveBeenCalled();
});
it("recibo já dispensado pela mesma conta também evita duplicação tardia", () => {
  const view = renderHook(() =>
    useArenaPushReceipts(
      "alpha",
      { ...state, messages: [] },
      sync,
      new Set([id]),
    ),
  );
  const request = event();
  act(() => view.result.current(request.event));
  expect(request.port.postMessage).toHaveBeenCalledExactlyOnceWith({
    received: true,
  });
});
it("logout ou troca de conta elimina recibos pendentes e nunca confirma para a conta antiga", () => {
  const view = renderHook(
    ({ user, data }: { user: string; data: ArenaInbox }) =>
      useArenaPushReceipts(user, data, sync, dismissed),
    {
      initialProps: {
        user: "alpha",
        data: { ...state, messages: [] } as ArenaInbox,
      },
    },
  );
  const request = event();
  act(() => view.result.current(request.event));
  view.rerender({ user: "beta", data: state });
  expect(request.port.postMessage).not.toHaveBeenCalled();
  expect(request.port.close).toHaveBeenCalledOnce();
  view.unmount();
  act(() => vi.advanceTimersByTime(1500));
  expect(request.port.close).toHaveBeenCalledOnce();
});
it("mensagens antigas sem porta só acionam a sincronização existente", () => {
  const view = renderHook(() =>
    useArenaPushReceipts("alpha", state, sync, dismissed),
  );
  expect(() =>
    view.result.current({
      data: { type: "capibora:taunt-push" },
      ports: [],
    } as unknown as MessageEvent),
  ).not.toThrow();
});
it("porta encerrada não transforma um aviso em falha da aplicação", () => {
  const view = renderHook(() =>
    useArenaPushReceipts("alpha", state, sync, dismissed),
  );
  const request = event();
  request.port.postMessage.mockImplementation(() => {
    throw new Error("Closed");
  });
  expect(() => act(() => view.result.current(request.event))).not.toThrow();
  expect(request.port.close).toHaveBeenCalledOnce();
});
