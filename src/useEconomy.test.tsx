import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { clearAccountStorage } from "./accountStorage";
import { STORAGE_KEY } from "./model";
import { useEconomy } from "./useEconomy";
import type { EconomyState } from "./economy";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("./backend", () => ({ accountConfigured: true, backendRpc: rpc }));
export const walletFixture = (
  overrides: Partial<EconomyState> = {},
): EconomyState => ({
  revision: 0,
  balance: 0,
  kits: 0,
  today: "2026-10-17",
  timezone: "UTC",
  kitsUsedThisWeek: 0,
  protections: [],
  rules: {
    workoutReward: 10,
    weightReward: 2,
    kitPrice: 50,
    weeklyKitLimit: 2,
  },
  history: { entries: [], hasMore: false },
  ...overrides,
});
beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue(walletFixture());
});

it("só mostra recompensa confirmada pelo servidor e não duplica feedback em reenvios", async () => {
  const { result } = renderHook(() => useEconomy("coins-reward"));
  await waitFor(() => expect(result.current.state?.balance).toBe(0));
  const earned = walletFixture({
    revision: 1,
    balance: 10,
    history: {
      entries: [
        {
          id: "10",
          kind: "workout",
          description: "Treino concluído",
          amount: 10,
          balanceAfter: 10,
          day: "2026-10-17",
          createdAt: "2026-10-17T12:00:00Z",
        },
      ],
      hasMore: false,
    },
  });
  rpc.mockResolvedValue(earned);
  await act(async () => {
    await result.current.refresh();
  });
  expect(result.current.notice).toBe("+10 potes de proteína");
  act(() => result.current.clearNotice());
  await act(async () => {
    await result.current.refresh();
  });
  expect(result.current.notice).toBe("");
  rpc.mockRejectedValueOnce(new Error("Sem conexão"));
  await act(async () => {
    expect(await result.current.useKit("2026-10-17")).toBe(false);
  });
  expect(result.current.state?.balance).toBe(10);
  expect(result.current.state?.protections).toEqual([]);
});

it("retém o identificador da compra após timeout e recarregamento para impedir cobrança dupla", async () => {
  rpc.mockResolvedValue(walletFixture({ revision: 1, balance: 50 }));
  const first = renderHook(() => useEconomy("coins-buy"));
  await waitFor(() => expect(first.result.current.state?.balance).toBe(50));
  rpc.mockRejectedValueOnce(new Error("Tempo esgotado"));
  await act(async () => {
    expect(await first.result.current.buy()).toBe(false);
  });
  const key = `${STORAGE_KEY}:account:coins-buy:kit-purchase`,
    id = localStorage.getItem(key);
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  expect(first.result.current.state?.balance).toBe(50);
  first.unmount();
  rpc.mockResolvedValue(walletFixture({ revision: 2, balance: 0, kits: 1 }));
  const second = renderHook(() => useEconomy("coins-buy"));
  await waitFor(() => expect(second.result.current.state?.kits).toBe(1));
  await act(async () => {
    expect(await second.result.current.buy()).toBe(true);
  });
  const purchases = rpc.mock.calls.filter(
    ([name]) => name === "buy_medical_kit",
  );
  expect(purchases).toHaveLength(2);
  expect(purchases[0][1].p_request_id).toBe(id);
  expect(purchases[1][1].p_request_id).toBe(id);
  expect(localStorage.getItem(key)).toBeNull();
});

it("não aceita uma resposta inválida nem inventa saldo local", async () => {
  const { result } = renderHook(() => useEconomy("coins-invalid"));
  await waitFor(() => expect(result.current.state?.balance).toBe(0));
  rpc.mockResolvedValueOnce(walletFixture({ balance: -10, kits: 99 }));
  await act(async () => {
    expect(await result.current.refresh()).toBe(false);
  });
  expect(result.current.state?.balance).toBe(0);
  expect(result.current.state?.kits).toBe(0);
});
it("reconhece no extrato a compra concluída antes de fechar o app, sem cobrar novamente", async () => {
  const id = crypto.randomUUID(),
    key = `${STORAGE_KEY}:account:coins-reconciled:kit-purchase`;
  localStorage.setItem(key, id);
  rpc.mockResolvedValueOnce(
    walletFixture({
      revision: 2,
      kits: 1,
      history: {
        entries: [
          {
            id: "12",
            kind: "kit-purchase",
            requestId: id,
            description: "Compra de Kit Médico",
            amount: -50,
            balanceAfter: 0,
            day: "2026-10-17",
            createdAt: "2026-10-17T12:00:00Z",
          },
        ],
        hasMore: false,
      },
    }),
  );
  const { result } = renderHook(() => useEconomy("coins-reconciled"));
  await waitFor(() => expect(result.current.state?.kits).toBe(1));
  expect(localStorage.getItem(key)).toBeNull();
  expect(rpc).toHaveBeenCalledExactlyOnceWith(
    "get_economy_state",
    expect.anything(),
  );
});

it("descarta respostas após logout e limpa compras pendentes sem vazar dados entre contas", async () => {
  let resolve!: (s: EconomyState) => void;
  rpc.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { result } = renderHook(() => useEconomy("coins-leaving"));
  await waitFor(() => expect(rpc).toHaveBeenCalledOnce());
  localStorage.setItem(
    `${STORAGE_KEY}:account:coins-leaving:kit-purchase`,
    crypto.randomUUID(),
  );
  clearAccountStorage("coins-leaving");
  await act(async () => resolve(walletFixture({ balance: 500 })));
  expect(result.current.state).toBeNull();
  await act(async () => {
    expect(await result.current.buy()).toBe(false);
  });
  expect(rpc).toHaveBeenCalledOnce();
  expect(
    localStorage.getItem(`${STORAGE_KEY}:account:coins-leaving:kit-purchase`),
  ).toBeNull();
});

it("carrega páginas do extrato em ordem, com cursor, sem repetir movimentações", async () => {
  const entry = (id: string) => ({
    id,
    kind: "weight" as const,
    description: "Peso registrado",
    amount: 2,
    balanceAfter: 2,
    day: "2026-10-17",
    createdAt: "2026-10-17T12:00:00Z",
  });
  rpc.mockResolvedValue(
    walletFixture({
      history: { entries: [entry("3"), entry("2")], hasMore: true },
    }),
  );
  const { result } = renderHook(() => useEconomy("coins-history"));
  await waitFor(() => expect(result.current.history.hasMore).toBe(true));
  rpc.mockResolvedValueOnce({
    entries: [entry("2"), entry("1")],
    hasMore: false,
  });
  await act(async () => {
    await result.current.loadMore();
  });
  expect(rpc).toHaveBeenLastCalledWith("get_economy_history", {
    p_before: "2",
  });
  expect(result.current.history.entries.map((e) => e.id)).toEqual([
    "3",
    "2",
    "1",
  ]);
  expect(result.current.history.hasMore).toBe(false);
});

it("descarta uma página antiga do extrato depois de receber uma revisão nova da carteira", async () => {
  const movement = (id: string) => ({
    id,
    kind: "weight" as const,
    description: "Peso",
    amount: 2,
    balanceAfter: 2,
    day: "2026-10-17",
    createdAt: "2026-10-17T12:00:00Z",
  });
  rpc.mockResolvedValue(
    walletFixture({
      revision: 1,
      history: { entries: [movement("3")], hasMore: true },
    }),
  );
  const hook = renderHook(() => useEconomy("ledger-order"));
  await waitFor(() => expect(hook.result.current.state).not.toBeNull());
  let finish!: (value: unknown) => void;
  rpc.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let page!: Promise<void>;
  act(() => {
    page = hook.result.current.loadMore();
  });
  rpc.mockResolvedValueOnce(
    walletFixture({
      revision: 2,
      balance: 4,
      history: { entries: [movement("4"), movement("3")], hasMore: true },
    }),
  );
  await act(async () => {
    await hook.result.current.refresh();
  });
  await act(async () => {
    finish({ entries: [movement("2")], hasMore: false });
    await page;
  });
  expect(hook.result.current.history.entries.map((entry) => entry.id)).toEqual([
    "4",
    "3",
  ]);
  expect(hook.result.current.history.hasMore).toBe(true);
});

it("atualiza a cota confirmada na virada do mês e não repete o aviso de renovação", async () => {
  const old = walletFixture({
    revision: 1,
    today: "2026-10-31",
    rules: {
      workoutReward: 10,
      weightReward: 2,
      kitPrice: 250,
      weeklyKitLimit: 7,
      kitUsageLimit: "inventory",
    },
    monthlyKits: {
      month: "2026-10-01",
      renewsOn: "2026-11-01",
      allowance: 2,
      freeAvailable: 0,
      purchasedAvailable: 0,
    },
  });
  rpc.mockResolvedValue(old);
  const first = renderHook(() => useEconomy("monthly-refresh"));
  await waitFor(() =>
    expect(first.result.current.state?.monthlyKits?.freeAvailable).toBe(0),
  );
  const renewed = {
    ...old,
    revision: 2,
    today: "2026-11-01",
    kits: 2,
    monthlyKits: {
      month: "2026-11-01",
      renewsOn: "2026-12-01",
      allowance: 2,
      freeAvailable: 2,
      purchasedAvailable: 0,
    },
  };
  rpc.mockResolvedValue(renewed);
  await act(async () => {
    await first.result.current.refresh();
  });
  expect(first.result.current.state?.kits).toBe(2);
  expect(first.result.current.notice).toContain("renovados");
  act(() => first.result.current.clearNotice());
  await act(async () => {
    await first.result.current.refresh();
  });
  expect(first.result.current.notice).toBe("");
  first.unmount();
  const second = renderHook(() => useEconomy("monthly-refresh"));
  await waitFor(() => expect(second.result.current.state?.kits).toBe(2));
  expect(rpc.mock.calls.every(([name]) => name === "get_economy_state")).toBe(
    true,
  );
});
