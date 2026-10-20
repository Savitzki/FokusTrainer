import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import EconomyPanel from "./EconomyPanel";
import type { EconomyController } from "./useEconomy";
import type { EconomyState } from "./economy";
import { ECONOMY_ASSETS } from "./EconomyIcon";

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
    noticeReward: undefined,
    clearNotice: vi.fn(),
    refresh: vi.fn(),
    buy: vi.fn().mockResolvedValue(true),
    acknowledgeAutomatic: vi.fn().mockResolvedValue(true),
    useKit: vi.fn().mockResolvedValue(true),
    loadMore: vi.fn(),
  };
}
it("desativa compras sem saldo e mantém recompensas disponíveis sob demanda", async () => {
  const economy = controller(49);
  render(<EconomyPanel economy={economy} canProtect onProtect={vi.fn()} />);
  expect(
    screen.getByRole("button", { name: "Comprar Kit Médico por 50 CapiWhey" }),
  ).toBeDisabled();
  expect(screen.queryByText("Falta 1 pote")).not.toBeInTheDocument();
  expect(
    screen.queryByText("Treino +10 · Primeiro peso do dia +2"),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Como funciona o Kit Médico" }),
  );
  expect(screen.getByRole("img", { name: "+10 CapiWhey" })).toBeVisible();
  expect(screen.getByRole("img", { name: "+2 CapiWhey" })).toBeVisible();
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
  expect(
    screen.getByRole("button", { name: "Comprar Kit Médico por 250 CapiWhey" }),
  ).toBeDisabled();
  expect(screen.queryByText("Falta 1 pote")).not.toBeInTheDocument();
  expect(screen.getByText("3 disponíveis · 2 grátis")).toBeInTheDocument();
  expect(screen.queryByText(/Gratuitos não acumulam/)).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Como funciona o Kit Médico" }),
  );
  expect(
    screen.getByText(/Gratuitos não acumulam · 1 comprado sem validade/),
  ).toBeVisible();
  expect(screen.getByText(/renovam em/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Proteger hoje" })).toBeEnabled();
});
it("permite compra com saldo e pede confirmação antes de consumir o kit", async () => {
  const economy = controller(),
    onProtect = vi.fn().mockResolvedValue(true),
    user = userEvent.setup();
  render(<EconomyPanel economy={economy} canProtect onProtect={onProtect} />);
  await user.click(
    screen.getByRole("button", { name: "Comprar Kit Médico por 50 CapiWhey" }),
  );
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
  await user.click(
    screen.getByRole("button", { name: "Comprar Kit Médico por 50 CapiWhey" }),
  );
  const confirm = screen.getByRole("button", { name: "Confirmar compra" });
  await user.dblClick(confirm);
  expect(economy.buy).toHaveBeenCalledOnce();
  expect(confirm).toBeDisabled();
  await act(async () => finish(true));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("exibe o kit aberto e omite extrato, sem alterar os dados recebidos", () => {
  const economy = controller(250, {
    protections: [
      { id: "use-1", day: "2026-10-16", usedAt: "2026-10-16T14:37:00Z" },
    ],
  });
  render(<EconomyPanel economy={economy} canProtect onProtect={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Proteger hoje" })).toBeVisible();
  expect(screen.queryByText("Histórico")).not.toBeInTheDocument();
  expect(document.querySelector(".wallet-history")).toBeNull();
  expect(economy.state!.protections).toHaveLength(1);
  expect(economy.loadMore).not.toHaveBeenCalled();
});

it("distingue estoque de kits do preço em CapiWhey com as artes oficiais", () => {
  const { container } = render(
    <EconomyPanel economy={controller()} canProtect onProtect={vi.fn()} />,
  );
  expect(container.querySelector(".kit-product-icon img")).toHaveAttribute(
    "src",
    `/${ECONOMY_ASSETS.medicalKit}`,
  );
  expect(container.querySelector(".kit-price img")).toHaveAttribute(
    "src",
    `/${ECONOMY_ASSETS.capiwhey}`,
  );
  expect(screen.getByRole("img", { name: "50 CapiWhey" })).toBeVisible();
});

it("apresenta o ganho confirmado como ícone e número, sem repetir o nome da moeda", () => {
  const economy = controller();
  economy.notice = "Recompensa recebida";
  economy.noticeReward = 10;
  render(<EconomyPanel economy={economy} canProtect onProtect={vi.fn()} />);
  expect(screen.getByRole("status")).toHaveTextContent(
    "+10Recompensa recebida",
  );
  expect(screen.getByRole("img", { name: "+10 CapiWhey" })).toBeVisible();
  expect(screen.getByRole("status").textContent).not.toMatch(
    /potes|CapiWhey|moedas/,
  );
});
