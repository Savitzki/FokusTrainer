import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import App from "./App";
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
