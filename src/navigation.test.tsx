import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";
import { readPage } from "./navigation";
import { freshData, localDate, STORAGE_KEY } from "./model";

describe("páginas do aplicativo", () => {
  it("mostra só a página escolhida, mantém os registros e restaura o endereço ao reabrir", async () => {
    const data = freshData();
    data.weights = [{ date: localDate(), kg: 72.5 }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
        .every((link) => !link.textContent),
    ).toBe(true);
    expect(
      screen.getByRole("region", { name: "Sua ofensiva" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Meu peso" }),
    ).not.toBeInTheDocument();
    await user.click(within(nav).getByRole("link", { name: "Peso" }));
    expect(window.location.hash).toBe("#/peso");
    expect(
      screen.queryByRole("region", { name: "Sua ofensiva" }),
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
      screen.getByRole("switch", { name: "Lembrete de treino" }),
    ).toBeInTheDocument();
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
  it("restaura a Loja pelo endereço e pede login para consultar ou comprar como visitante", async () => {
    window.history.replaceState(null, "", "/#/loja");
    render(<App />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Loja" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Loja" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.queryByRole("button", { name: /^Comprar/ }),
    ).not.toBeInTheDocument();
    const shop = screen.getByRole("region", { name: "Loja" });
    await userEvent
      .setup()
      .click(within(shop).getByRole("button", { name: "Entrar na conta" }));
    expect(
      await screen.findByRole("dialog", {
        name: "Sua chama começa com uma conta",
      }),
    ).toBeInTheDocument();
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
