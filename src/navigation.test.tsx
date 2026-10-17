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
    expect(within(nav).getAllByRole("link")).toHaveLength(5);
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
    await user.click(screen.getByRole("link", { name: "Avisos" }));
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
    expect(screen.getByRole("heading", { name: "Avisos" })).toBeInTheDocument();
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
