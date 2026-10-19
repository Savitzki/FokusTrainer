import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";

const account = vi.hoisted(() => ({
  initializing: true,
  configured: false,
  user: null as null | { id: string },
  profile: null,
  profileChecked: true,
  profileLoading: false,
  profileError: "",
}));
const status = vi.hoisted(() => ({
  blocked: true,
  error: "",
  authError: false,
}));
vi.mock("./account", () => ({ useAccount: () => account }));
vi.mock("./useStartupGate", () => ({ useStartupGate: () => status }));
vi.mock("./backend", () => ({
  accountConfigured: false,
  backendRpc: async () => ({ records: [], applied: [] }),
}));
beforeEach(() => {
  vi.useFakeTimers();
  account.initializing = true;
  account.user = null;
  status.blocked = true;
  status.error = "";
});
afterEach(() => vi.useRealTimers());
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

it("usa a mesma tela e a mesma imagem da autenticação até os dados, sem reiniciar os 2 segundos", () => {
  const view = render(<App />);
  const loader = document.querySelector(".fokus-loading"),
    mascot = loader?.querySelector("img");
  advance(500);
  account.initializing = false;
  account.user = { id: "opening-account" };
  view.rerender(<App />);
  expect(document.querySelectorAll(".fokus-loading")).toHaveLength(1);
  expect(document.querySelector(".fokus-loading")).toBe(loader);
  expect(document.querySelector(".loading-identity img")).toBe(mascot);
  advance(300);
  status.blocked = false;
  view.rerender(<App />);
  expect(
    screen.queryByRole("navigation", { name: "Menu principal" }),
  ).not.toBeInTheDocument();
  advance(1199);
  expect(document.querySelector(".fokus-loading")).toBe(loader);
  advance(1);
  expect(document.querySelector(".fokus-loading")).not.toBeInTheDocument();
  expect(
    screen.getByRole("navigation", { name: "Menu principal" }),
  ).toBeInTheDocument();
});
it("não libera o app no limite de 2 segundos se a consulta ainda estiver pendente", () => {
  const view = render(<App />);
  const loader = document.querySelector(".fokus-loading");
  advance(2500);
  account.initializing = false;
  view.rerender(<App />);
  expect(document.querySelector(".fokus-loading")).toBe(loader);
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  status.blocked = false;
  view.rerender(<App />);
  expect(document.querySelector(".fokus-loading")).not.toBeInTheDocument();
  expect(
    screen.getByRole("navigation", { name: "Menu principal" }),
  ).toBeInTheDocument();
});
it("mantém uma única tela também quando o servidor falha", () => {
  const view = render(<App />),
    loader = document.querySelector(".fokus-loading");
  account.initializing = false;
  status.error = "Servidor indisponível";
  view.rerender(<App />);
  advance(2500);
  expect(document.querySelector(".fokus-loading")).toBe(loader);
  expect(document.querySelectorAll(".fokus-loading")).toHaveLength(1);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Não foi possível carregar todas as informações",
  );
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
});
it("mostra a mesma abertura por 2 segundos para visitante", () => {
  account.initializing = false;
  status.blocked = false;
  render(<App />);
  advance(1999);
  expect(document.querySelector(".fokus-loading")).toBeInTheDocument();
  advance(1);
  expect(document.querySelector(".fokus-loading")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Entrar na conta" }),
  ).toBeInTheDocument();
});
