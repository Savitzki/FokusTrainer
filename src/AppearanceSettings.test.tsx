import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import AppearanceSettings from "./AppearanceSettings";
import { applyTheme, readTheme, THEME_STORAGE_KEY } from "./theme";

afterEach(() => vi.restoreAllMocks());

it("centraliza aparência na hotbar e mantém a escolha ao navegar e reabrir", async () => {
  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(screen.getByRole("link", { name: "Configurações" }));
  await user.click(screen.getByRole("radio", { name: "Escuro" }));
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  await user.click(screen.getByRole("link", { name: "Treinos" }));
  await user.click(screen.getByRole("button", { name: "Sua semana" }));
  expect(screen.getByRole("radio", { name: "Escuro" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  view.unmount();
  applyTheme(readTheme());
  render(<App />);
  expect(screen.getByRole("radio", { name: "Escuro" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await user.click(screen.getByRole("radio", { name: "Claro" }));
  expect(document.documentElement).toHaveAttribute("data-theme", "light");
});

it("permite mudar a aparência e informa quando o navegador impede salvar", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage blocked", "SecurityError");
  });
  render(<AppearanceSettings />);
  await userEvent.click(screen.getByRole("radio", { name: "Escuro" }));
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  expect(screen.getByRole("alert")).toHaveTextContent(/não permitiu salvar/);
});

it("reflete uma escolha feita em outra aba", () => {
  render(<AppearanceSettings />);
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
