import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import AppHeader from "./AppHeader";
import { blankProfile } from "./profile";

function setup(balance: number | null = 12345) {
  const actions = {
    onHome: vi.fn(),
    onStreak: vi.fn(),
    onShop: vi.fn(),
    onProfile: vi.fn(),
  };
  render(
    <AppHeader
      {...actions}
      profile={{ ...blankProfile(), nickname: "Dani" }}
      frameId="frame-water-wave"
      balance={balance}
      authenticated
      currentStreak={10}
      recordStreak={15}
      trained={false}
      protectedDay
    />,
  );
  return actions;
}
it("preserva os quatro destinos e os rótulos completos sem legenda visual de moeda", async () => {
  const actions = setup(),
    user = userEvent.setup();
  expect(screen.queryByText("CapiWhey")).not.toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: "Capibora, início" }));
  await user.click(
    screen.getByRole("button", {
      name: "10 dias de ofensiva · Ver calendário",
    }),
  );
  await user.click(
    screen.getByRole("button", { name: "12.345 CapiWhey · Ver loja e kits" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Editar perfil de Dani" }),
  );
  for (const action of Object.values(actions))
    expect(action).toHaveBeenCalledOnce();
  expect(
    screen.getByRole("img", {
      name: "Dia de descanso: sua ofensiva está protegida",
    }),
  ).toBeInTheDocument();
});
it("mantém o link da marca para abrir em outra aba", () => {
  const actions = setup();
  const link = screen.getByRole("link", { name: "Capibora, início" });
  expect(link).toHaveAttribute("href", "#/");
  fireEvent.click(link, { ctrlKey: true });
  expect(actions.onHome).not.toHaveBeenCalled();
});
it("mantém o saldo em carregamento para a conta autenticada", () => {
  setup(null);
  expect(
    screen.getByRole("button", { name: "CapiWhey · Ver loja e kits" }),
  ).toHaveTextContent("—");
});
it("o cabeçalho visitante mostra somente a marca e a entrada", async () => {
  const onLogin = vi.fn();
  render(
    <AppHeader authenticated={false} onHome={vi.fn()} onLogin={onLogin} />,
  );
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(screen.queryByLabelText(/CapiWhey/)).not.toBeInTheDocument();
  expect(screen.queryByRole("img", { name: /Avatar/ })).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Entrar na conta" }),
  );
  expect(onLogin).toHaveBeenCalledOnce();
});
