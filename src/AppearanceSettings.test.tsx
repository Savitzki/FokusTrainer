import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
// The real opening duration is covered in startupScreen.test.tsx.
vi.mock("./useMinimumLoading", () => ({
  useMinimumLoading: (pending: boolean) => pending,
}));
import AppearanceSettings from "./AppearanceSettings";
import { applyTheme, readTheme, THEME_STORAGE_KEY } from "./theme";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("centraliza aparência na hotbar e mantém a escolha ao navegar e reabrir", async () => {
  localStorage.setItem(THEME_STORAGE_KEY, "light");
  applyTheme("light");
  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(screen.getByRole("link", { name: "Configurações" }));
  const toggle = screen.getByRole("switch", { name: "Modo escuro" });
  const appearance = screen.getByRole("region", {
    name: "Aparência e informações do app",
  });
  const install = screen.getByRole("region", { name: "Instalar aplicativo" });
  expect(
    appearance.compareDocumentPosition(install) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  await user.click(toggle);
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  await user.click(screen.getByRole("link", { name: "Treinos" }));
  expect(
    screen.getByRole("region", { name: "Semana de treinos" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("switch", { name: "Modo escuro" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: "Configurações" }));
  expect(
    screen.queryByRole("region", { name: "Semana de treinos" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("switch", { name: "Modo escuro" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  view.unmount();
  applyTheme(readTheme());
  render(<App />);
  expect(screen.getByRole("switch", { name: "Modo escuro" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await user.click(screen.getByRole("switch", { name: "Modo escuro" }));
  expect(document.documentElement).toHaveAttribute("data-theme", "light");
});

it("permite mudar a aparência e informa quando o navegador impede salvar", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage blocked", "SecurityError");
  });
  render(<AppearanceSettings />);
  const toggle = screen.getByRole("switch", { name: "Modo escuro" });
  await userEvent.click(toggle);
  if (toggle.getAttribute("aria-checked") !== "true")
    await userEvent.click(toggle);
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
  expect(screen.getByRole("switch", { name: "Modo escuro" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

it("oculta os status de autorização e push indisponível, sem controles de lembretes", async () => {
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("Notification", { permission: "granted" });
  window.history.replaceState(null, "", "/#/configuracoes");
  render(<App />);
  expect(screen.queryByText("Avisos autorizados")).not.toBeInTheDocument();
  expect(
    screen.queryByText("Avisos com o app fechado"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Ativar notificações" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("switch", { name: "Lembrete de treino" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Horário: peso")).not.toBeInTheDocument();
  expect(document.querySelector(".settings-page .card")).toBeNull();
});
