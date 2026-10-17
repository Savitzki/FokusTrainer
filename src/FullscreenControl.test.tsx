import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import FullscreenControl from "./FullscreenControl";
const restore: (() => void)[] = [];
function property(target: object, key: string, descriptor: PropertyDescriptor) {
  const original = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, ...descriptor });
  restore.push(() => {
    if (original) Object.defineProperty(target, key, original);
    else Reflect.deleteProperty(target, key);
  });
}
afterEach(() => {
  restore.reverse().forEach((fn) => fn());
  restore.length = 0;
  vi.unstubAllGlobals();
});
function browser() {
  let element: Element | null = null;
  property(document, "fullscreenEnabled", { value: true });
  property(document, "fullscreenElement", { get: () => element });
  const change = (value: Element | null) => {
    element = value;
    fireEvent(document, new Event("fullscreenchange"));
  };
  const enter = vi.fn(async () => change(document.documentElement));
  const exit = vi.fn(async () => change(null));
  property(document.documentElement, "requestFullscreen", { value: enter });
  property(document, "exitFullscreen", { value: exit });
  return { enter, exit, change };
}
it("pede para ocultar a navegação apenas no clique e permite sair da tela cheia", async () => {
  const api = browser();
  const user = userEvent.setup();
  render(<FullscreenControl />);
  expect(api.enter).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Tela cheia" }));
  expect(api.enter).toHaveBeenCalledWith({ navigationUI: "hide" });
  await user.click(
    await screen.findByRole("button", { name: "Sair da tela cheia" }),
  );
  expect(api.exit).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Tela cheia" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
it("atualiza o controle quando a pessoa sai pelo sistema e trata recusas do navegador", async () => {
  const api = browser();
  const user = userEvent.setup();
  render(<FullscreenControl />);
  await user.click(screen.getByRole("button", { name: "Tela cheia" }));
  api.change(null);
  expect(screen.getByRole("button", { name: "Tela cheia" })).toBeEnabled();
  api.enter.mockRejectedValueOnce(new Error("NotAllowedError"));
  await user.click(screen.getByRole("button", { name: "Tela cheia" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /não liberou a tela cheia/,
  );
  expect(screen.getByRole("button", { name: "Tela cheia" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
it("oculta o controle sem suporte e quando a versão instalada já ocupa a tela inteira", () => {
  property(document, "fullscreenEnabled", { value: false });
  const view = render(<FullscreenControl />);
  expect(screen.queryByRole("button")).toBeNull();
  view.unmount();
  browser();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  render(<FullscreenControl />);
  expect(screen.queryByRole("button")).toBeNull();
});
