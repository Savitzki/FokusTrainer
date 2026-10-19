import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
// The real opening duration is covered in startupScreen.test.tsx.
vi.mock("./useMinimumLoading", () => ({
  useMinimumLoading: (pending: boolean) => pending,
}));
import { readPage } from "./navigation";
import { freshData, localDate, STORAGE_KEY } from "./model";

const account = vi.hoisted(() => ({
  user: { id: "navigation-user" } as null | { id: string },
  configured: false,
  initializing: false,
  profile: null,
  profileChecked: true,
  profileLoading: false,
  profileError: "",
}));
vi.mock("./account", () => ({ useAccount: () => account }));

beforeEach(() => {
  account.user = { id: "navigation-user" };
});

describe("páginas do aplicativo", () => {
  it("mostra só a página escolhida, mantém os registros e restaura o endereço ao reabrir", async () => {
    const data = freshData();
    data.weights = [{ date: localDate(), kg: 72.5 }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(
      `${STORAGE_KEY}:account:navigation-user`,
      JSON.stringify(data),
    );
    const user = userEvent.setup();
    const view = render(<App />);
    const nav = screen.getByRole("navigation", { name: "Menu principal" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.getAttribute("aria-label")),
    ).toEqual(["Início", "Treinos", "Arena", "Peso", "Loja", "Configurações"]);
    expect(
      within(nav)
        .getAllByRole("link")
        .filter((link) => link.textContent)
        .map((link) => link.textContent),
    ).toEqual(["Início"]);
    expect(
      screen.getByRole("region", { name: "Treino de hoje" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Meu peso" }),
    ).not.toBeInTheDocument();
    await user.click(within(nav).getByRole("link", { name: "Peso" }));
    expect(window.location.hash).toBe("#/peso");
    expect(
      within(nav)
        .getAllByRole("link")
        .filter((link) => link.textContent)
        .map((link) => link.textContent),
    ).toEqual(["Peso"]);
    expect(
      screen.queryByRole("region", { name: "Treino de hoje" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Meu peso" })).toHaveFocus();
    expect(screen.getByText("72,5")).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Peso" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    view.unmount();
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Meu peso" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Treinos" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Registrar peso" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Configurações" }));
    expect(
      screen.queryByRole("switch", { name: "Lembrete de treino" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Arena" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Arena" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).weights).toEqual(
      data.weights,
    );
  });
  it("acompanha o histórico do navegador e aceita links antigos de seção", () => {
    window.history.replaceState(null, "", "/#/peso");
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Meu peso" }),
    ).toBeInTheDocument();
    act(() => {
      window.history.replaceState(null, "", "/#/treinos");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("table")).toBeInTheDocument();
    act(() => {
      window.location.hash = "reminders";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(
      screen.getByRole("heading", { name: "Configurações" }),
    ).toBeInTheDocument();
  });
  it("redireciona o visitante que tenta abrir a Loja por endereço", () => {
    account.user = null;
    window.history.replaceState(null, "", "/#/loja");
    render(<App />);
    expect(window.location.hash).toBe("#/");
    expect(
      screen.getByRole("heading", { name: "Duvido que você comece" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Loja" }),
    ).not.toBeInTheDocument();
  });
  it("preserva o fragmento e os parâmetros da confirmação de e-mail e do Google", () => {
    const callback =
      "/?code=authorization-code#access_token=example&refresh_token=example";
    window.history.replaceState(null, "", callback);
    expect(readPage()).toBe("overview");
    render(<App />);
    expect(window.location.search + window.location.hash).toBe(
      callback.slice(1),
    );
  });
});

it("abre Perfil como página sem botão de voltar e mantém a navegação pela hotbar", async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, "", "/#/peso");
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Criar perfil" }));
  expect(window.location.hash).toBe("#/perfil");
  expect(
    screen.getByRole("heading", { level: 1, name: "Perfil" }),
  ).toHaveFocus();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    within(
      screen.getByRole("navigation", { name: "Menu principal" }),
    ).getAllByRole("link"),
  ).toHaveLength(6);
  expect(screen.queryByRole("button", { name: "Voltar do perfil" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: "Peso" }));
  expect(window.location.hash).toBe("#/peso");
  expect(readPage()).toBe("weight");
});
it("restaura o Perfil por endereço direto", () => {
  window.history.replaceState(null, "", "/#/perfil");
  render(<App />);
  expect(readPage()).toBe("profile");
  expect(
    screen.getByRole("heading", { level: 1, name: "Perfil" }),
  ).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("reutiliza o cabeçalho e a estrutura de título nas seis áreas", async () => {
  const user = userEvent.setup();
  render(<App />);
  const header = screen.getByRole("banner");
  const nav = screen.getByRole("navigation", { name: "Menu principal" });
  for (const label of [
    "Treinos",
    "Arena",
    "Peso",
    "Loja",
    "Configurações",
    "Início",
  ]) {
    await user.click(within(nav).getByRole("link", { name: label }));
    expect(screen.getByRole("banner")).toBe(header);
    if (label !== "Início") {
      const title = screen.getByRole("heading", { level: 1 });
      expect(title.parentElement).toHaveClass("page-heading");
      expect(title.querySelector("svg")).not.toBeNull();
      expect(title.closest(".card")).toBeNull();
    }
  }
});

it("fecha o modal de peso na mesma página, sem criar um redirecionamento", async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, "", "/#/peso");
  render(<App />);
  await user.click(screen.getByRole("button", {name:"Registrar peso"}));
  expect(screen.getByRole("dialog")).toBeVisible();
  await user.click(screen.getByRole("button", {name:"Fechar janela"}));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(window.location.hash).toBe("#/peso");
  expect(screen.getByRole("heading", {name:"Meu peso"})).toBeVisible();
});
