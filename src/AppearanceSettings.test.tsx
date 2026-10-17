import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import AppearanceSettings from "./AppearanceSettings";
import { applyTheme, readTheme, THEME_STORAGE_KEY } from "./theme";

afterEach(() => vi.restoreAllMocks());

it("abre configurações pelo perfil e mantém a aparência ao fechar, reabrir e recarregar", async () => {
  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(screen.getByRole("button", { name: "Criar perfil" }));
  await user.type(screen.getByLabelText("Seu nick"), "dani.treina");
  await user.click(
    screen.getByRole("button", { name: "Configurações" }),
  );
  await user.click(screen.getByRole("radio", { name: "Escuro" }));
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  await user.click(screen.getByRole("button", { name: "Voltar ao perfil" }));
  expect(screen.getByLabelText("Seu nick")).toHaveValue("dani.treina");
  view.unmount();
  applyTheme(readTheme());
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Criar perfil" }));
  await user.click(
    screen.getByRole("button", { name: "Configurações" }),
  );
  expect(screen.getByRole("radio", { name: "Escuro" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await user.click(screen.getByRole("radio", { name: "Claro" }));
  expect(document.documentElement).toHaveAttribute("data-theme", "light");
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
});

it("permite mudar a aparência e informa quando o navegador impede salvar", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage blocked", "SecurityError");
  });
  render(<AppearanceSettings onBack={vi.fn()} />);
  await userEvent.click(screen.getByRole("radio", { name: "Escuro" }));
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  expect(screen.getByRole("alert")).toHaveTextContent(/não permitiu salvar/);
});

it("reflete uma escolha feita em outra aba", () => {
  render(<AppearanceSettings onBack={vi.fn()} />);
  localStorage.setItem(THEME_STORAGE_KEY, "dark");
  fireEvent(
    window,
    new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: "dark" }),
  );
  expect(screen.getByRole("radio", { name: "Escuro" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});
