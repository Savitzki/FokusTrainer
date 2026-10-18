import { render, screen } from "@testing-library/react";
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
  expect(screen.getByRole("button", { name: "Comprar 50" })).toBeDisabled();
  expect(screen.getByText("Falta 1 pote")).toBeInTheDocument();
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
  expect(screen.getByRole("button", { name: "Comprar 250" })).toBeDisabled();
  expect(screen.getByText("Falta 1 pote")).toBeInTheDocument();
  expect(screen.getByText("2 gratuitos disponíveis")).toBeInTheDocument();
  expect(
    screen.getByText(/Gratuitos não acumulam · 1 comprado sem validade/),
  ).toBeInTheDocument();
  expect(screen.getByText(/Renovam em/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Proteger hoje" })).toBeEnabled();
});
it("permite compra com saldo e pede confirmação antes de consumir o kit", async () => {
  const economy = controller(),
    onProtect = vi.fn().mockResolvedValue(true),
    user = userEvent.setup();
  render(<EconomyPanel economy={economy} canProtect onProtect={onProtect} />);
  await user.click(screen.getByRole("button", { name: "Comprar 50" }));
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
])("não oferece proteção indevida: %j", ({ canProtect, ...overrides }) => {
  render(
    <EconomyPanel
      economy={controller(50, overrides)}
      canProtect={canProtect}
      onProtect={vi.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "Proteger hoje" })).toBeDisabled();
});
