import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { hydrateRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { InitialLoading } from "./SyncFeedback";
import initialHtml from "../index.html?raw";

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
  account.user = { id: "server-required" };
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
  account.user = { id: "server-error" };
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
function initialScreen() {
  return new DOMParser()
    .parseFromString(
      initialHtml.replaceAll("%BASE_URL%", import.meta.env.BASE_URL),
      "text/html",
    )
    .querySelector("#root")!;
}
it("o HTML inicial já possui a mesma capivara e os estilos antes de baixar o aplicativo", () => {
  const provided = initialScreen().querySelector(".fokus-loading");
  const rendered = new DOMParser()
    .parseFromString(renderToStaticMarkup(<InitialLoading />), "text/html")
    .querySelector(".fokus-loading");
  expect(provided?.outerHTML).toBe(rendered?.outerHTML);
  expect(initialHtml).toContain("data-capibora-opening");
  expect(initialHtml).toContain('<style id="capibora-startup-style">');
  expect(initialHtml.indexOf('id="capibora-startup-style"')).toBeLessThan(
    initialHtml.indexOf('id="root"'),
  );
});
it("hidrata a capivara do HTML sem trocar a imagem, reiniciar a tela ou perder o tema ao entrar", () => {
  const container = document.createElement("div");
  container.innerHTML = initialScreen().innerHTML;
  document.body.append(container);
  const loader = container.firstElementChild,
    image = container.querySelector("img"),
    recoverableError = vi.fn();
  let root!: ReturnType<typeof hydrateRoot>;
  try {
    act(() => {
      root = hydrateRoot(container, <App />, {
        onRecoverableError: recoverableError,
      });
    });
    expect(container.firstElementChild).toBe(loader);
    expect(container.querySelector("img")).toBe(image);
    expect(document.documentElement).toHaveAttribute("data-capibora-opening");
    account.initializing = false;
    status.blocked = false;
    act(() => root.render(<App />));
    advance(2000);
    expect(recoverableError).not.toHaveBeenCalled();
    expect(container.querySelector(".fokus-loading")).not.toBeInTheDocument();
    expect(document.documentElement).not.toHaveAttribute(
      "data-capibora-opening",
    );
  } finally {
    act(() => root?.unmount());
    container.remove();
  }
});
