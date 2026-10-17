import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import MedicalKitConfirmation from "./MedicalKitConfirmation";
import type { EconomyState } from "./economy";
const state: EconomyState = {
  revision: 1,
  balance: 0,
  kits: 1,
  today: "2026-10-17",
  timezone: "America/Sao_Paulo",
  kitsUsedThisWeek: 0,
  protections: [],
  rules: {
    workoutReward: 10,
    weightReward: 2,
    kitPrice: 50,
    weeklyKitLimit: 2,
  },
  history: { entries: [], hasMore: false },
};
it("explica as regras e cancelar não consome o item", async () => {
  const user = userEvent.setup(),
    onConfirm = vi.fn(),
    onCancel = vi.fn();
  render(
    <MedicalKitConfirmation
      state={state}
      today={state.today}
      canProtect
      busy={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(/não será devolvido/);
  expect(
    screen.getByText(/sem acrescentar pontos ou moedas/),
  ).toBeInTheDocument();
  expect(screen.getByText(/Até 2 usos por semana/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Agora não" }));
  expect(onConfirm).not.toHaveBeenCalled();
  expect(onCancel).toHaveBeenCalledOnce();
});
it("só fecha a confirmação depois de consumir com sucesso; uma recusa permite tentar novamente", async () => {
  const user = userEvent.setup(),
    onConfirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true),
    onCancel = vi.fn();
  render(
    <MedicalKitConfirmation
      state={state}
      today={state.today}
      canProtect
      busy={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Usar 1 kit" }));
  expect(onCancel).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Usar 1 kit" }));
  expect(onCancel).toHaveBeenCalledOnce();
});
it.each([
  { canProtect: false },
  { kits: 0 },
  { kitsUsedThisWeek: 2 },
  { today: "2026-10-18" },
])(
  "bloqueia uma confirmação inválida %j",
  ({ canProtect = true, today = state.today, ...overrides }) => {
    render(
      <MedicalKitConfirmation
        state={{ ...state, ...overrides }}
        today={today}
        canProtect={canProtect}
        busy={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Usar 1 kit" })).toBeDisabled();
  },
);
