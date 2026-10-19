import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import EconomyPanel from "./EconomyPanel";
import type { EconomyController } from "./useEconomy";
import type { EconomyState } from "./economy";

function controller(
  balance = 50,
  overrides: Partial<EconomyState> = {},
): EconomyController {
  const state: EconomyState = {
    revision: 1,
    balance,
    kits: 1,
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
  };
  return {
    state,
    history: state.history,
    busy: false,
    enabled: true,
    error: "",
    notice: "",
    clearNotice: vi.fn(),
    refresh: vi.fn(),
    buy: vi.fn().mockResolvedValue(true),
    useKit: vi.fn().mockResolvedValue(true),
    loadMore: vi.fn(),
  };
}
it("desativa compras sem saldo e mantém recompensas disponíveis sob demanda", async () => {
  const economy = controller(49);
  render(<EconomyPanel economy={economy} canProtect onProtect={vi.fn()} />);
  await userEvent.click(screen.getByText("Carteira e Kits Médicos"));
  expect(screen.getByRole("button", { name: "Comprar 50" })).toBeDisabled();
  expect(screen.queryByText("Falta 1 pote")).not.toBeInTheDocument();
  expect(
    screen.getByText("Treino +10 · Primeiro peso do dia +2"),
  ).not.toBeVisible();
  await userEvent.click(screen.getByText("Regras e recompensas"));
  expect(
    screen.getByText("Treino +10 · Primeiro peso do dia +2"),
  ).toBeVisible();
});

it("exibe o preço de 250 potes, a renovação mensal e permite usar estoque sem cota semanal", async () => {
  const economy = controller(249, {
    kits: 3,
    kitsUsedThisWeek: 7,
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
      freeAvailable: 2,
      purchasedAvailable: 1,
    },
  });
  render(<EconomyPanel economy={economy} canProtect onProtect={vi.fn()} />);
  await userEvent.click(screen.getByText("Carteira e Kits Médicos"));
  expect(screen.getByRole("button", { name: "Comprar 250" })).toBeDisabled();
  expect(screen.queryByText("Falta 1 pote")).not.toBeInTheDocument();
  expect(screen.getByText("3 disponíveis · 2 grátis")).toBeInTheDocument();
  expect(
    screen.getByText(/Gratuitos não acumulam · 1 comprado sem validade/),
  ).toBeInTheDocument();
  expect(screen.getByText(/renovam em/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Proteger hoje" })).toBeEnabled();
});
it("permite compra com saldo e pede confirmação antes de consumir o kit", async () => {
  const economy = controller(),
    onProtect = vi.fn().mockResolvedValue(true),
    user = userEvent.setup();
  render(<EconomyPanel economy={economy} canProtect onProtect={onProtect} />);
  await userEvent.click(screen.getByText("Carteira e Kits Médicos"));
  await user.click(screen.getByRole("button", { name: "Comprar 50" }));
  expect(economy.buy).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Confirmar compra" }));
  expect(economy.buy).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button", { name: "Proteger hoje" }));
  expect(onProtect).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Usar 1 kit" }));
  expect(onProtect).toHaveBeenCalledOnce();
});
it.each([
  { canProtect: false, kits: 1, kitsUsedThisWeek: 0 },
  { canProtect: true, kits: 0, kitsUsedThisWeek: 0 },
  { canProtect: true, kits: 1, kitsUsedThisWeek: 2 },
])(
  "não oferece proteção indevida: %j",
  async ({ canProtect, ...overrides }) => {
    render(
      <EconomyPanel
        economy={controller(50, overrides)}
        canProtect={canProtect}
        onProtect={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByText("Carteira e Kits Médicos"));
    expect(
      screen.getByRole("button", { name: "Proteger hoje" }),
    ).toBeDisabled();
  },
);

it("confirma uma única compra de kit mesmo com dois toques enquanto aguarda o servidor", async () => {
  const economy = controller(500),
    user = userEvent.setup();
  let finish!: (ok: boolean) => void;
  economy.buy = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  render(<EconomyPanel economy={economy} canProtect onProtect={vi.fn()} />);
  await userEvent.click(screen.getByText("Carteira e Kits Médicos"));
  await user.click(screen.getByRole("button", { name: "Comprar 50" }));
  const confirm = screen.getByRole("button", { name: "Confirmar compra" });
  await user.dblClick(confirm);
  expect(economy.buy).toHaveBeenCalledOnce();
  expect(confirm).toBeDisabled();
  await act(async () => finish(true));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("reúne o uso de kits no histórico sem omitir a data nem duplicar totais", async () => {
  const economy = controller(250, {
    protections: [
      { id: "use-1", day: "2026-10-16", usedAt: "2026-10-16T14:37:00Z" },
    ],
  });
  render(<EconomyPanel economy={economy} canProtect onProtect={vi.fn()} />);
  await userEvent.click(screen.getByText("Carteira e Kits Médicos"));
  expect(document.querySelector(".kit-use-history")).not.toBeVisible();
  await userEvent.click(screen.getByText("Histórico", { exact: true }));
  await userEvent.click(screen.getByText("Kits utilizados", { exact: true }));
  expect(screen.getByText("14:37")).toBeVisible();
  expect(document.querySelector(".wallet-summary")).not.toHaveTextContent(
    "kits",
  );
  expect(screen.getByRole("button", { name: "Proteger hoje" })).toBeEnabled();
});
