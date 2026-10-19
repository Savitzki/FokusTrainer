import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InitialLoading } from "./SyncFeedback";
import {
  startupStatus,
  useStartupGate,
  type StartupResource,
} from "./useStartupGate";
import { useSyncedResource } from "./useSyncedResource";
import { retrySync, type ResourceSync, type SyncResource } from "./sync";

const sync: ResourceSync = {
  initialLoading: false,
  refreshing: false,
  writing: false,
  stale: true,
  error: "",
  errorKind: null,
  lastSuccess: 0,
};
const ready: StartupResource = { available: true, sync };
const loading: StartupResource = {
  available: false,
  sync: { ...sync, initialLoading: true },
};
const failed: StartupResource = {
  available: false,
  sync: { ...sync, error: "Falha de conexão", errorKind: "network" },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
afterEach(() => vi.useRealTimers());

it.each([
  ["perfil", 0],
  ["programação", 1],
  ["carteira", 2],
  ["pesos", 3],
  ["histórico/Arena", 4],
  ["missões", 5],
] as const)(
  "não libera a abertura sem %s, mesmo com os outros snapshots disponíveis",
  (_, index) => {
    const resources = Array.from({ length: 6 }, () => ready);
    resources[index] = loading;
    const hook = renderHook(() => useStartupGate("account", resources, ready));
    expect(hook.result.current.blocked).toBe(true);
    expect(hook.result.current.error).toBe("");
  },
);
it("aguarda recuperação da sessão na abertura sem cache e libera sem duração artificial", () => {
  const hook = renderHook(
    ({ resources, session }) => useStartupGate("cold", resources, session),
    {
      initialProps: { resources: [loading], session: loading },
    },
  );
  hook.rerender({
    resources: [{ available: true, sync: { ...sync, lastSuccess: 1 } }],
    session: loading,
  });
  expect(hook.result.current.blocked).toBe(true);
  hook.rerender({ resources: [ready], session: ready });
  expect(hook.result.current.blocked).toBe(false);
});
it("libera o cache completo imediatamente e recupera a sessão online em segundo plano", () => {
  const hook = renderHook(() =>
    useStartupGate("warm", [ready, ready, ready], loading),
  );
  expect(hook.result.current.blocked).toBe(false);
});
it("reconhece perfil hidratado do cache após a restauração assíncrona da autenticação", () => {
  const hook = renderHook(
    ({ resources }) => useStartupGate("hydrating", resources, loading),
    {
      initialProps: { resources: [loading, ready] },
    },
  );
  expect(hook.result.current.blocked).toBe(true);
  hook.rerender({ resources: [ready, ready] });
  expect(hook.result.current.blocked).toBe(false);
});
it("não volta à tela de espera durante atualização ou ao navegar para dados secundários", () => {
  const hook = renderHook(
    ({ resources }) => useStartupGate("opened", resources, ready),
    {
      initialProps: { resources: [ready] },
    },
  );
  hook.rerender({ resources: [ready, loading] });
  expect(hook.result.current.blocked).toBe(false);
  hook.rerender({ resources: [failed] });
  expect(hook.result.current.blocked).toBe(false);
});
it("não reaproveita liberação nem snapshots de outra conta após logout e troca de usuário", () => {
  const hook = renderHook(
    ({ userId, resources }) => useStartupGate(userId, resources, ready),
    {
      initialProps: { userId: "first" as string | null, resources: [ready] },
    },
  );
  expect(hook.result.current.blocked).toBe(false);
  hook.rerender({ userId: null, resources: [loading] });
  expect(hook.result.current.blocked).toBe(false);
  hook.rerender({ userId: "second", resources: [loading] });
  expect(hook.result.current.blocked).toBe(true);
  hook.rerender({ userId: "second", resources: [ready] });
  expect(hook.result.current.blocked).toBe(false);
});
it("diferencia sessão expirada de falha de rede e não trata erro sem dados como sucesso", () => {
  expect(startupStatus([failed])).toMatchObject({
    ready: false,
    authError: false,
  });
  expect(
    startupStatus([
      { available: false, sync: { ...sync, error: "JWT", errorKind: "auth" } },
    ]),
  ).toMatchObject({ ready: false, authError: true });
  expect(startupStatus([{ ...failed, available: true }])).toMatchObject({
    ready: true,
    error: "",
  });
});
it("informa falha de leitura do cache local mesmo com o transporte desabilitado, sem espera infinita", () => {
  const hook = renderHook(() =>
    useStartupGate(
      "corrupted",
      [
        {
          available: false,
          sync,
          error: "Fila de pesos preservada, mas ilegível",
        },
      ],
      ready,
    ),
  );
  expect(hook.result.current).toMatchObject({
    blocked: true,
    error: "Fila de pesos preservada, mas ilegível",
  });
});
it("mostra a capivara oficial imediatamente sem barra de progresso fictícia", () => {
  render(<InitialLoading />);
  expect(screen.getByRole("status")).toHaveTextContent("Preparando seu espaço");
  const image = document.querySelector(".loading-identity img");
  expect(image).toHaveAttribute("src", "mascot/web/neutro.webp");
  expect(image).toHaveAttribute("loading", "eager");
  expect(image).toHaveAttribute("alt", "");
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});
it("pausa a pulsação no erro e permite repetir a consulta, sem exibir informações incompletas", async () => {
  const retry = vi.fn();
  const view = render(<InitialLoading error="Sem conexão" onRetry={retry} />);
  expect(document.querySelector(".loading-failed")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Sem conexão");
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(retry).toHaveBeenCalledOnce();
  view.rerender(<InitialLoading />);
  expect(document.querySelector(".loading-failed")).not.toBeInTheDocument();
});
it("preserva o erro ao sair quando existem pesos pendentes e não perde a fila", async () => {
  const signOut = vi
    .fn()
    .mockRejectedValue(
      new Error("Sincronize os pesos pendentes antes de sair"),
    );
  render(<InitialLoading error="Sessão expirada" onSignOut={signOut} />);
  fireEvent.click(screen.getByRole("button", { name: "Sair da conta" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("pesos pendentes"),
  );
  expect(screen.getByRole("button", { name: "Sair da conta" })).toBeEnabled();
});

// Exercise the actual shared cache/timeout/retry transport through the startup gate.
function useBoot(id: string, readers: Array<() => Promise<unknown>>) {
  function resource(index: number, name: SyncResource) {
    return useSyncedResource({
      userId: id,
      resource: name,
      queryKey: `boot-${name}`,
      enabled: true,
      cacheKey: `boot:${id}:${name}`,
      read: readers[index],
      parse(value: unknown) {
        if (typeof value !== "number") throw new Error("Snapshot inválido");
        return value;
      },
    });
  }
  const profile = resource(0, "profile"),
    wallet = resource(1, "economy");
  const gate = useStartupGate(
    id,
    [profile, wallet].map((r) => ({
      available: r.state !== null,
      sync: r.sync,
    })),
    ready,
  );
  return { profile, wallet, gate };
}
it("cache parcial não libera a aplicação antes da carteira; resposta válida libera no mesmo ciclo", async () => {
  localStorage.setItem("boot:partial:profile", "1");
  const wallet = deferred<number>();
  const readers = [vi.fn().mockResolvedValue(2), vi.fn(() => wallet.promise)];
  const hook = renderHook(() => useBoot("partial", readers));
  expect(hook.result.current.profile.state).toBe(1);
  expect(hook.result.current.gate.blocked).toBe(true);
  await act(async () => wallet.resolve(250));
  expect(hook.result.current.gate.blocked).toBe(false);
  expect(hook.result.current.wallet.state).toBe(250);
});
it("ignora cache corrompido e não usa zero como substituto para saldo ainda desconhecido", async () => {
  localStorage.setItem("boot:malformed:profile", "1");
  localStorage.setItem("boot:malformed:economy", '"inválido"');
  const wallet = deferred<number>();
  const hook = renderHook(() =>
    useBoot("malformed", [() => Promise.resolve(1), () => wallet.promise]),
  );
  expect(hook.result.current.wallet.state).toBeNull();
  expect(hook.result.current.gate.blocked).toBe(true);
  await act(async () => wallet.resolve(0));
  expect(hook.result.current.gate.blocked).toBe(false);
  expect(hook.result.current.wallet.state).toBe(0);
});
it("cache completo permanece visível após falha de rede e atualiza quando a nova consulta chega", async () => {
  localStorage.setItem("boot:cached:profile", "1");
  localStorage.setItem("boot:cached:economy", "120");
  const readers = [
    vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
  ];
  const hook = renderHook(() => useBoot("cached", readers));
  expect(hook.result.current.gate.blocked).toBe(false);
  await waitFor(() => expect(hook.result.current.wallet.error).toBeTruthy());
  expect(hook.result.current.wallet.state).toBe(120);
  expect(hook.result.current.gate.blocked).toBe(false);
  readers[0].mockResolvedValue(2);
  readers[1].mockResolvedValue(140);
  await act(async () => retrySync("cached"));
  await waitFor(() => expect(hook.result.current.wallet.state).toBe(140));
});
it("timeout encerra a espera animada, informa falha e permite recuperação sem recarregar a página", async () => {
  vi.useFakeTimers();
  const readers = [
    vi.fn().mockResolvedValue(1),
    vi.fn((): Promise<unknown> => new Promise(() => {})),
  ];
  const hook = renderHook(() => useBoot("timeout", readers));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15001);
  });
  expect(hook.result.current.gate.blocked).toBe(true);
  expect(hook.result.current.gate.error).toMatch(/demorou/);
  readers[1].mockResolvedValue(10);
  await act(async () => retrySync("timeout"));
  expect(hook.result.current.gate.blocked).toBe(false);
});
