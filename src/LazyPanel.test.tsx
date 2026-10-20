import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { lazyPanel } from "./LazyPanel";
it("não carrega a tela secundária antes de abri-la e mantém o cabeçalho disponível", async () => {
  let resolve!: (module: { default: () => React.JSX.Element }) => void;
  const load = vi.fn(
    () =>
      new Promise<{ default: () => React.JSX.Element }>((r) => {
        resolve = r;
      }),
  );
  const Panel = lazyPanel(load);
  const view = render(
    <>
      <h1>Início</h1>
    </>,
  );
  expect(load).not.toHaveBeenCalled();
  view.rerender(
    <>
      <h1>Início</h1>
      <Panel />
    </>,
  );
  expect(load).toHaveBeenCalledOnce();
  expect(screen.getByRole("heading", { name: "Início" })).toBeVisible();
  expect(
    screen.getByRole("status", { name: "Carregando seção" }),
  ).toBeVisible();
  await act(async () => {
    resolve({ default: () => <h2>Arena carregada</h2> });
  });
  expect(await screen.findByText("Arena carregada")).toBeVisible();
});
it("move o foco da navegação para o título somente depois que a tela está pronta", async () => {
  const Panel = lazyPanel(async () => ({
    default: () => (
      <h1 id="page-title" tabIndex={-1}>
        Arena
      </h1>
    ),
  }));
  render(
    <>
      <nav>
        <a href="#/arena">Abrir Arena</a>
      </nav>
      <main id="main-content">
        <Panel />
      </main>
    </>,
  );
  screen.getByRole("link").focus();
  expect(await screen.findByRole("heading", { name: "Arena" })).toHaveFocus();
});
it("uma falha no chunk não apaga a navegação nem os dados que já estavam visíveis", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const Panel = lazyPanel(async () => {
      throw new Error("Offline chunk");
    });
    render(
      <>
        <nav>Menu principal</nav>
        <Panel />
      </>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível abrir esta seção",
    );
    expect(screen.getByRole("navigation")).toHaveTextContent("Menu principal");
    expect(screen.getByRole("button", { name: "Recarregar" })).toBeEnabled();
  } finally {
    errors.mockRestore();
  }
});
