import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import App from "./App";
// The real opening duration is covered in startupScreen.test.tsx.
vi.mock("./useMinimumLoading", () => ({
  useMinimumLoading: (pending: boolean) => pending,
}));
it("mantém Configurações sem controles de notificações", () => {
  window.history.replaceState(null, "", "/#/configuracoes");
  render(<App />);
  expect(
    screen.queryByRole("heading", { name: "Notificações" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Horário dos avisos")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("switch", { name: "Lembrete de treino" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("switch", { name: "Modo escuro" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "Instalar aplicativo" }),
  ).toBeInTheDocument();
});
