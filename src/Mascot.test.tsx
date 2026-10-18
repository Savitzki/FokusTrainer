import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Mascot from "./Mascot";
import type { MascotAsset } from "./mascotAssets";
const registry = vi.hoisted(() => ({}) as Record<string, MascotAsset>);
vi.mock("./mascotAssets", () => ({ MASCOT_ASSETS: registry }));
let query: {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};
beforeEach(() => {
  vi.useFakeTimers();
  Object.keys(registry).forEach((k) => delete registry[k]);
  query = {
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => query),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("não exibe imagem, placeholder ou espaço vazio sem asset oficial cadastrado", () => {
  const { container } = render(<Mascot pose="judging" />);
  expect(container).toBeEmptyDOMElement();
});
it("carrega a imagem sob demanda, mantém decoração silenciosa e remove uma imagem com erro", () => {
  registry.neutral = { src: "mascot/official-test.svg" };
  const { container } = render(<Mascot />);
  const img = container.querySelector("img")!;
  expect(img).toHaveAttribute("loading", "lazy");
  expect(img).toHaveAttribute("alt", "");
  expect(img).toHaveAttribute("aria-hidden", "true");
  fireEvent.error(img);
  expect(container).toBeEmptyDOMElement();
});
it("encerra a animação e volta à versão estática sem loop ou listeners duplicados", () => {
  registry.neutral = {
    src: "mascot/official-test.svg",
    animatedSrc: "mascot/official-test.webp",
    durationMs: 500,
  };
  const view = render(<Mascot animate />);
  expect(view.container.querySelector("img")).toHaveAttribute(
    "src",
    "mascot/official-test.webp",
  );
  view.rerender(<Mascot animate />);
  expect(query.addEventListener).toHaveBeenCalledOnce();
  act(() => vi.advanceTimersByTime(500));
  expect(view.container.querySelector("img")).toHaveAttribute(
    "src",
    "mascot/official-test.svg",
  );
  view.unmount();
  expect(query.removeEventListener).toHaveBeenCalledOnce();
});
it("movimento reduzido mantém o asset estático e uma falha na animação não perde o texto da tela", () => {
  registry.neutral = {
    src: "mascot/official-test.svg",
    animatedSrc: "mascot/official-test.webp",
  };
  query.matches = true;
  const view = render(<Mascot animate />);
  expect(view.container.querySelector("img")).toHaveAttribute(
    "src",
    "mascot/official-test.svg",
  );
  view.unmount();
  query.matches = false;
  const second = render(<Mascot animate />);
  fireEvent.error(second.container.querySelector("img")!);
  expect(second.container.querySelector("img")).toHaveAttribute(
    "src",
    "mascot/official-test.svg",
  );
});
