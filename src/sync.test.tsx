import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearAccountStorage } from "./accountStorage";
import { STORAGE_KEY } from "./model";
import { useSyncedResource } from "./useSyncedResource";
import SyncFeedback, { InitialLoading } from "./SyncFeedback";
import {
  activateSync,
  invalidateSync,
  mutationResources,
  notifySyncWrite,
  registerSync,
  sharedSyncRead,
  syncProblem,
  syncStates,
  withSyncTimeout,
  type ResourceSync,
  type SyncResource,
} from "./sync";

type Value = { revision: number; total: number };
const value = (total = 1): Value => ({ revision: total, total });
function parse(raw: unknown): Value {
  const v = raw as Value;
  if (!v || !Number.isInteger(v.revision) || !Number.isInteger(v.total))
    throw new Error("Resposta inválida");
  return v;
}
function deferred<T>() {
  let resolve!: (v: T) => void, reject!: (e: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function options(
  id: string | null,
  read: () => Promise<unknown>,
  resource: SyncResource = "training",
) {
  return {
    userId: id,
    resource,
    queryKey: resource,
    enabled: Boolean(id),
    cacheKey: id ? `${STORAGE_KEY}:account:${id}:test:${resource}` : undefined,
    read,
    parse,
    accept: (next: Value, previous: Value) =>
      next.revision >= previous.revision,
  };
}
const ready: ResourceSync = {
  initialLoading: false,
  refreshing: false,
  writing: false,
  stale: false,
  error: "",
  errorKind: null,
  lastSuccess: 0,
};
const disposals: Array<() => void> = [];
beforeEach(() => {
  Object.defineProperty(navigator, "onLine", {
    value: true,
    configurable: true,
  });
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });
});
afterEach(() => {
  disposals.splice(0).forEach((dispose) => dispose());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("mostra identidade no carregamento inicial e libera assim que a consulta essencial termina", async () => {
  const request = deferred<Value>();
  function App() {
    const essential = useSyncedResource(
      options("cold-start", () => request.promise),
    );
    useSyncedResource(
      options("cold-start", () => new Promise(() => {}), "gamification"),
    );
    return essential.sync.initialLoading ? (
      <InitialLoading />
    ) : (
      <p>Pronto {essential.state?.total}</p>
    );
  }
  render(<App />);
  expect(screen.getByRole("status")).toHaveTextContent("Preparando seu espaço");
  expect(
    document.querySelector(".loading-identity .capibora-mascot"),
  ).toHaveAttribute("src", `${import.meta.env.BASE_URL}brand/web/logo-capibora-sem-fundo.webp`);
  expect(document.querySelector(".capibora-mascot")).toHaveAttribute(
    "loading",
    "eager",
  );
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  await act(async () => request.resolve(value()));
  expect(screen.getByText("Pronto 1")).toBeInTheDocument();
  expect(document.querySelector(".fokus-loading")).not.toBeInTheDocument();
});

it("exibe cache válido imediatamente e mantém navegação disponível durante atualização", async () => {
  const request = deferred<Value>(),
    config = options("warm-start", () => request.promise);
  localStorage.setItem(config.cacheKey!, JSON.stringify(value(3)));
  const hook = renderHook(() => useSyncedResource(config));
  expect(hook.result.current.state?.total).toBe(3);
  expect(hook.result.current.sync.initialLoading).toBe(false);
  expect(hook.result.current.busy).toBe(false);
  await act(async () => request.resolve(value(4)));
  expect(hook.result.current.state?.total).toBe(4);
});

it("projeta snapshots em cache no estado compartilhado antes da resposta de rede", async () => {
  const pending = deferred<Value>(),
    onData = vi.fn(),
    config = options("cache-projection", () => pending.promise);
  localStorage.setItem(config.cacheKey!, JSON.stringify(value(3)));
  renderHook(() => useSyncedResource({ ...config, onData }));
  expect(onData).toHaveBeenCalledExactlyOnceWith(value(3), null, "cache");
  await act(async () => pending.resolve(value(4)));
  expect(onData).toHaveBeenLastCalledWith(value(4), value(3), "read");
});

it("abre offline com último estado confiável e permite revalidar ao recuperar conexão", async () => {
  const read = vi.fn().mockResolvedValue(value(2)),
    config = options("offline-cache", read);
  localStorage.setItem(config.cacheKey!, JSON.stringify(value()));
  Object.defineProperty(navigator, "onLine", {
    value: false,
    configurable: true,
  });
  const hook = renderHook(() => useSyncedResource(config));
  render(<SyncFeedback userId="offline-cache" onLogin={vi.fn()} />);
  expect(read).not.toHaveBeenCalled();
  expect(hook.result.current.sync.initialLoading).toBe(false);
  expect(hook.result.current.state?.total).toBe(1);
  expect(screen.getByRole("status")).toHaveTextContent("Sem conexão");
  Object.defineProperty(navigator, "onLine", {
    value: true,
    configurable: true,
  });
  await act(async () => fireEvent(window, new Event("online")));
  expect(hook.result.current.state?.total).toBe(2);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("falha inicial termina o carregamento, sem apagar cache numa falha posterior", async () => {
  const read = vi.fn().mockRejectedValue(new Error("Servidor indisponível"));
  const hook = renderHook(() =>
    useSyncedResource(options("query-error", read)),
  );
  await waitFor(() =>
    expect(hook.result.current.sync.initialLoading).toBe(false),
  );
  expect(hook.result.current.error).toMatch(/Servidor/);
  read.mockResolvedValue(value(5));
  await act(async () => {
    await hook.result.current.refresh();
  });
  read.mockRejectedValue(new Error("Failed to fetch"));
  await act(async () => {
    expect(await hook.result.current.refresh()).toBe(false);
  });
  expect(hook.result.current.state?.total).toBe(5);
  expect(hook.result.current.sync.errorKind).toBe("network");
});

it("deduplica consultas simultâneas do mesmo recurso e conta", async () => {
  const request = deferred<Value>(),
    read = vi.fn(() => request.promise);
  const a = renderHook(() => useSyncedResource(options("dedup", read)));
  const b = renderHook(() => useSyncedResource(options("dedup", read)));
  let one!: Promise<boolean>, two!: Promise<boolean>;
  act(() => {
    one = a.result.current.refresh();
    two = a.result.current.refresh();
  });
  expect(one).toBe(two);
  expect(read).toHaveBeenCalledOnce();
  await act(async () => request.resolve(value()));
  expect(a.result.current.state).toEqual(value());
  expect(b.result.current.state).toEqual(value());
});

it("uma invalidação durante consulta descarta resposta antiga e faz uma única reconsulta", async () => {
  const old = deferred<Value>(),
    read = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(value(2));
  const hook = renderHook(() => useSyncedResource(options("dirty-read", read)));
  act(() => {
    invalidateSync("dirty-read", ["training"]);
    invalidateSync("dirty-read", ["training"]);
  });
  await act(async () => old.resolve(value()));
  await waitFor(() => expect(hook.result.current.state?.total).toBe(2));
  expect(read).toHaveBeenCalledTimes(2);
});

it("uma escrita confirmada vence a consulta anterior recebida fora de ordem", async () => {
  const old = deferred<Value>(),
    read = vi.fn(() => old.promise);
  const hook = renderHook(() => useSyncedResource(options("write-wins", read)));
  await act(async () => {
    expect(
      (
        await hook.result.current.mutate(
          async () => value(8),
          "save_training_plan",
        )
      ).committed,
    ).toBe(true);
  });
  expect(hook.result.current.state?.total).toBe(8);
  await act(async () => old.resolve(value(1)));
  expect(hook.result.current.state?.total).toBe(8);
  expect(
    JSON.parse(localStorage.getItem(options("write-wins", read).cacheKey!)!)
      .total,
  ).toBe(8);
});

it("preserva revisão mais recente quando o servidor retorna snapshot antigo", async () => {
  const read = vi
    .fn()
    .mockResolvedValueOnce(value(5))
    .mockResolvedValue(value(3));
  const hook = renderHook(() =>
    useSyncedResource(options("revision-wins", read)),
  );
  await waitFor(() => expect(hook.result.current.state?.total).toBe(5));
  await act(async () => {
    await hook.result.current.refresh();
  });
  expect(hook.result.current.state?.total).toBe(5);
});

it("não confunde escrita concluída com falha da consulta seguinte e permite tentar sincronizar", async () => {
  const read = vi.fn().mockResolvedValue(value(4));
  const hook = renderHook(() =>
    useSyncedResource(options("saved-refresh-failed", read, "social")),
  );
  await waitFor(() => expect(hook.result.current.state?.total).toBe(4));
  read.mockRejectedValue(new Error("Failed to fetch"));
  const write = vi.fn().mockResolvedValue(null);
  await act(async () => {
    expect(
      (await hook.result.current.mutate(write, "reply_friend_request", false))
        .committed,
    ).toBe(true);
  });
  expect(write).toHaveBeenCalledOnce();
  expect(hook.result.current.state?.total).toBe(4);
  expect(hook.result.current.error).toMatch(/Operação salva/);
  expect(hook.result.current.busy).toBe(false);
  render(<SyncFeedback userId="saved-refresh-failed" onLogin={vi.fn()} />);
  expect(screen.getByRole("status")).toHaveTextContent("Operação concluída");
  read.mockResolvedValue(value(5));
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Sincronizar" })),
  );
  expect(hook.result.current.state?.total).toBe(5);
  expect(write).toHaveBeenCalledOnce();
});

it("bloqueia apenas uma escrita concorrente no próprio recurso", async () => {
  const read = vi.fn().mockResolvedValue(value()),
    pending = deferred<Value>(),
    operation = vi.fn(() => pending.promise);
  const hook = renderHook(() =>
    useSyncedResource(options("busy-action", read)),
  );
  await waitFor(() => expect(hook.result.current.state).not.toBeNull());
  let first!: ReturnType<typeof hook.result.current.mutate>;
  act(() => {
    first = hook.result.current.mutate(operation, "save_training_plan");
  });
  expect(hook.result.current.sync.writing).toBe(true);
  await act(async () => {
    expect(
      (await hook.result.current.mutate(operation, "save_training_plan"))
        .committed,
    ).toBe(false);
  });
  expect(operation).toHaveBeenCalledOnce();
  await act(async () => {
    pending.resolve(value(2));
    await first;
  });
  expect(hook.result.current.busy).toBe(false);
});

it("não expõe dados da conta anterior e ignora sua resposta atrasada", async () => {
  const old = deferred<Value>(),
    readA = vi.fn(() => old.promise),
    readB = vi.fn().mockResolvedValue(value(9));
  const hook = renderHook(
    ({ id }) =>
      useSyncedResource(options(id, id === "account-a" ? readA : readB)),
    { initialProps: { id: "account-a" } },
  );
  hook.rerender({ id: "account-b" });
  expect(hook.result.current.state).toBeNull();
  await waitFor(() => expect(hook.result.current.state?.total).toBe(9));
  await act(async () => old.resolve(value(3)));
  expect(hook.result.current.state?.total).toBe(9);
  expect(
    localStorage.getItem(options("account-a", readA).cacheKey!),
  ).toBeNull();
});

it("logout durante consulta impede recriar cache pessoal", async () => {
  const pending = deferred<Value>(),
    read = () => pending.promise;
  const hook = renderHook(() =>
    useSyncedResource(options("logout-read", read)),
  );
  clearAccountStorage("logout-read");
  await act(async () => pending.resolve(value(4)));
  expect(hook.result.current.state).toBeNull();
  expect(
    localStorage.getItem(options("logout-read", read).cacheKey!),
  ).toBeNull();
});

it("escrita atrasada após logout e novo login na mesma conta não atravessa a nova sessão", async () => {
  const pending = deferred<Value>(),
    read = vi.fn().mockResolvedValue(value());
  const hook = renderHook(({ id }) => useSyncedResource(options(id, read)), {
    initialProps: { id: "relogin" as string | null },
  });
  await waitFor(() => expect(hook.result.current.state).not.toBeNull());
  let operation!: ReturnType<typeof hook.result.current.mutate>;
  act(() => {
    operation = hook.result.current.mutate(
      () => pending.promise,
      "save_training_plan",
    );
  });
  clearAccountStorage("relogin");
  hook.rerender({ id: null });
  hook.rerender({ id: "relogin" });
  await waitFor(() => expect(hook.result.current.state?.total).toBe(1));
  await act(async () => {
    pending.resolve(value(99));
    expect((await operation).committed).toBe(false);
  });
  expect(hook.result.current.state?.total).toBe(1);
});

it("recupera o estado persistido após recarregar, sem repetir uma escrita", async () => {
  const read = vi.fn().mockResolvedValue(value(6)),
    config = options("reload-cache", read);
  const a = renderHook(() => useSyncedResource(config));
  await waitFor(() => expect(a.result.current.state?.total).toBe(6));
  a.unmount();
  Object.defineProperty(navigator, "onLine", {
    value: false,
    configurable: true,
  });
  const b = renderHook(() => useSyncedResource(config));
  expect(b.result.current.state?.total).toBe(6);
  expect(b.result.current.sync.initialLoading).toBe(false);
  expect(read).toHaveBeenCalledOnce();
});

it("ao retomar a PWA combina focus/pageshow/visibility sem consultas simultâneas duplicadas", async () => {
  const pending = deferred<Value>(),
    read = vi
      .fn()
      .mockResolvedValueOnce(value())
      .mockReturnValue(pending.promise);
  const hook = renderHook(() => useSyncedResource(options("pwa-resume", read)));
  await waitFor(() => expect(hook.result.current.state).not.toBeNull());
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 20000);
  await act(async () => {
    fireEvent(window, new Event("focus"));
    fireEvent(window, new Event("pageshow"));
    fireEvent(document, new Event("visibilitychange"));
  });
  expect(read).toHaveBeenCalledTimes(2);
  expect(hook.result.current.busy).toBe(false);
  await act(async () => pending.resolve(value(2)));
  expect(hook.result.current.state?.total).toBe(2);
});

it("consulta área desatualizada ao acessá-la e limita fallback a áreas visíveis", async () => {
  const training = vi.fn(),
    reports = vi.fn();
  for (const [resource, refresh] of [
    ["training", training],
    ["reports", reports],
  ] as const) {
    const reg = registerSync({
      userId: "area-stale",
      resource,
      refresh,
      invalidate: vi.fn(),
      status: ready,
    });
    disposals.push(reg.dispose);
  }
  await act(async () => activateSync("area-stale", ["training"]));
  expect(training).toHaveBeenCalledOnce();
  expect(reports).not.toHaveBeenCalled();
  await act(async () => activateSync("area-stale", ["reports"]));
  expect(reports).toHaveBeenCalledOnce();
});

it("sair de segundo plano revalida mesmo um snapshot recente", async () => {
  const read = vi.fn().mockResolvedValue(value());
  const hook = renderHook(() =>
    useSyncedResource(options("real-background", read)),
  );
  await waitFor(() => expect(hook.result.current.state).not.toBeNull());
  Object.defineProperty(document, "visibilityState", {
    value: "hidden",
    configurable: true,
  });
  fireEvent(document, new Event("visibilitychange"));
  expect(read).toHaveBeenCalledOnce();
  read.mockResolvedValue(value(2));
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });
  await act(async () => fireEvent(document, new Event("visibilitychange")));
  expect(read).toHaveBeenCalledTimes(2);
  expect(hook.result.current.state?.total).toBe(2);
});

it("sinal de outra aba invalida somente recursos da conta correspondente", async () => {
  const a = vi.fn().mockResolvedValue(value()),
    b = vi.fn().mockResolvedValue(value());
  renderHook(() => useSyncedResource(options("tab-a", a)));
  renderHook(() => useSyncedResource(options("tab-b", b)));
  await waitFor(() =>
    expect(syncStates("tab-a")[0].lastSuccess).toBeGreaterThan(0),
  );
  a.mockResolvedValue(value(3));
  await act(async () =>
    fireEvent(
      window,
      new StorageEvent("storage", {
        key: `${STORAGE_KEY}:account:tab-a:sync-event`,
        newValue: JSON.stringify({ resources: ["training"], nonce: "remote" }),
      }),
    ),
  );
  expect(a).toHaveBeenCalledTimes(2);
  expect(b).toHaveBeenCalledOnce();
});

it.each([
  [
    "confirm_manual_workout",
    [
      "training",
      "economy",
      "gamification",
      "social",
      "reports",
      "challenges",
      "session",
      "calendar",
    ],
  ],
  [
    "finish_workout_session",
    [
      "training",
      "economy",
      "gamification",
      "social",
      "reports",
      "challenges",
      "session",
      "calendar",
    ],
  ],
  ["buy_medical_kit", ["economy"]],
  ["buy_cosmetic", ["gamification", "economy"]],
  ["sync_weight_entries", ["weights", "economy", "gamification", "reports"]],
  ["reply_friend_request", ["social", "gamification", "challenges"]],
  [
    "reschedule_training",
    ["training", "social", "gamification", "reports", "challenges", "calendar"],
  ],
  [
    "authorize_extra_rest",
    ["training", "social", "gamification", "reports", "challenges", "calendar"],
  ],
  [
    "use_medical_kit",
    [
      "economy",
      "training",
      "social",
      "gamification",
      "reports",
      "challenges",
      "calendar",
    ],
  ],
] as Array<[string, SyncResource[]]>)(
  "%s atualiza somente os recursos relacionados",
  async (rpc, expected) => {
    const names: SyncResource[] = [
      "training",
      "economy",
      "social",
      "weights",
      "gamification",
      "session",
      "reports",
      "challenges",
      "profile",
      "showcase",
      "calendar",
    ];
    const calls = new Map(names.map((name) => [name, vi.fn()]));
    names.forEach((name) => {
      const r = registerSync({
        userId: rpc,
        resource: name,
        status: ready,
        refresh: calls.get(name)!,
        invalidate: vi.fn(),
      });
      disposals.push(r.dispose);
    });
    await act(async () => notifySyncWrite(rpc, rpc));
    names.forEach((name) =>
      expect(calls.get(name)).toHaveBeenCalledTimes(
        expected.includes(name) ? 1 : 0,
      ),
    );
    expect(new Set(mutationResources(rpc))).toEqual(new Set(expected));
  },
);

it("mantém um conjunto de listeners e remove todos ao desmontar a última inscrição", () => {
  const add = vi.spyOn(window, "addEventListener"),
    remove = vi.spyOn(window, "removeEventListener");
  const a = registerSync({
    userId: "listeners",
    resource: "training",
    refresh: vi.fn(),
    invalidate: vi.fn(),
    status: ready,
  });
  const b = registerSync({
    userId: "listeners",
    resource: "economy",
    refresh: vi.fn(),
    invalidate: vi.fn(),
    status: ready,
  });
  expect(add.mock.calls.filter(([name]) => name === "online")).toHaveLength(1);
  a.dispose();
  expect(remove.mock.calls.filter(([name]) => name === "online")).toHaveLength(
    0,
  );
  b.dispose();
  expect(remove.mock.calls.filter(([name]) => name === "online")).toHaveLength(
    1,
  );
});

it("consultas penduradas expiram e desligam o carregamento sem perder dados", async () => {
  vi.useFakeTimers();
  const hook = renderHook(() =>
    useSyncedResource(options("timeout-read", () => new Promise(() => {}))),
  );
  expect(hook.result.current.sync.initialLoading).toBe(true);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15001);
  });
  expect(hook.result.current.sync.initialLoading).toBe(false);
  expect(hook.result.current.sync.refreshing).toBe(false);
  expect(hook.result.current.sync.errorKind).toBe("network");
  hook.unmount();
});

it("não mantém verificações periódicas em segundo plano nem em áreas inativas", async () => {
  vi.useFakeTimers();
  const training = vi.fn(),
    reports = vi.fn();
  const status = { ...ready, lastSuccess: Date.now() };
  const a = registerSync({
    userId: "visible-fallback",
    resource: "training",
    refresh: training,
    invalidate: vi.fn(),
    status,
  });
  const b = registerSync({
    userId: "visible-fallback",
    resource: "reports",
    refresh: reports,
    invalidate: vi.fn(),
    status,
  });
  disposals.push(a.dispose, b.dispose);
  activateSync("visible-fallback", ["training"]);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60000);
  });
  expect(training).toHaveBeenCalledOnce();
  expect(reports).not.toHaveBeenCalled();
  Object.defineProperty(document, "visibilityState", {
    value: "hidden",
    configurable: true,
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(120000);
  });
  expect(training).toHaveBeenCalledOnce();
});

it("oferece login quando a sessão precisa ser renovada", () => {
  const login = vi.fn(),
    handle = registerSync({
      userId: "expired-auth",
      resource: "profile",
      refresh: vi.fn(),
      invalidate: vi.fn(),
      status: { ...ready, errorKind: "auth", error: "JWT expirado" },
    });
  disposals.push(handle.dispose);
  render(<SyncFeedback userId="expired-auth" onLogin={login} />);
  expect(screen.getByRole("status")).toHaveTextContent("Entre novamente");
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(login).toHaveBeenCalledOnce();
});

it("diferencia autenticação, rede, servidor e validação sem mensagens enganosas", async () => {
  expect(syncProblem({ status: 401 }).kind).toBe("auth");
  expect(syncProblem(new TypeError("Failed to fetch")).kind).toBe("network");
  expect(syncProblem(new Error("Servidor indisponível")).kind).toBe("server");
  expect(syncProblem({ code: "P0001", message: "Limite semanal" })).toEqual({
    kind: "validation",
    message: "Limite semanal",
  });
  const pending = deferred<number>();
  expect(await withSyncTimeout(Promise.resolve(3))).toBe(3);
  const a = sharedSyncRead("same-key", () => pending.promise),
    b = sharedSyncRead("same-key", () => Promise.resolve(8));
  expect(a).toBe(b);
  pending.resolve(2);
  expect(await a).toBe(2);
});

it("hidrata o cache apenas uma vez e mantém a consulta de atualização em segundo plano", async () => {
  const request = deferred<Value>();
  const config = options("single-hydration", () => request.promise);
  localStorage.setItem(config.cacheKey!, JSON.stringify(value(3)));
  const parseOnce = vi.fn(parse);
  const hook = renderHook(() => useSyncedResource({ ...config, parse: parseOnce }));
  expect(parseOnce).toHaveBeenCalledOnce();
  expect(hook.result.current.state).toEqual(value(3));
  expect(hook.result.current.sync.initialLoading).toBe(false);
  await act(async () => request.resolve(value(4)));
  expect(hook.result.current.state).toEqual(value(4));
});
