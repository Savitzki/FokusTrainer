import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useDialogViewport } from "./useDialogViewport";

function Example() {
  const ref = useRef<HTMLDialogElement>(null);
  useDialogViewport(ref);
  return (
    <dialog ref={ref} open>
      <input aria-label="Campo" />
    </dialog>
  );
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("mantém o modal na área visível quando o teclado abre e a viewport é deslocada", () => {
  vi.useFakeTimers();
  vi.stubGlobal("innerHeight", 844);
  const viewport = Object.assign(new EventTarget(), {
    height: 844,
    offsetTop: 0,
  });
  vi.stubGlobal("visualViewport", viewport);
  const view = render(<Example />);
  const dialog = view.container.querySelector("dialog")!;
  const input = view.getByLabelText("Campo");
  const scroll = vi.fn();
  input.scrollIntoView = scroll;
  vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
    top: 500,
    bottom: 550,
  } as DOMRect);
  act(() => input.focus());
  act(() => vi.advanceTimersByTime(20));
  expect(scroll).not.toHaveBeenCalled();
  viewport.height = 360;
  act(() => viewport.dispatchEvent(new Event("resize")));
  act(() => vi.advanceTimersByTime(20));
  expect(dialog.style.getPropertyValue("--dialog-viewport-height")).toBe(
    "360px",
  );
  expect(dialog.style.getPropertyValue("--dialog-bottom-offset")).toBe("484px");
  expect(scroll).toHaveBeenCalledWith({
    block: "nearest",
    behavior: "instant",
  });
  viewport.offsetTop = 120;
  act(() => viewport.dispatchEvent(new Event("scroll")));
  act(() => vi.advanceTimersByTime(20));
  expect(dialog.style.getPropertyValue("--dialog-bottom-offset")).toBe("364px");
  viewport.height = 844;
  viewport.offsetTop = 0;
  act(() => viewport.dispatchEvent(new Event("resize")));
  act(() => vi.advanceTimersByTime(20));
  expect(dialog.style.getPropertyValue("--dialog-bottom-offset")).toBe("0px");
  view.unmount();
  expect(dialog.style.getPropertyValue("--dialog-viewport-height")).toBe("");
});

it("acompanha a janela quando não há VisualViewport", () => {
  vi.useFakeTimers();
  vi.stubGlobal("visualViewport", undefined);
  vi.stubGlobal("innerHeight", 400);
  const view = render(<Example />);
  const dialog = view.container.querySelector("dialog")!;
  act(() => vi.advanceTimersByTime(20));
  expect(dialog.style.getPropertyValue("--dialog-viewport-height")).toBe(
    "400px",
  );
  vi.stubGlobal("innerHeight", 300);
  act(() => window.dispatchEvent(new Event("resize")));
  act(() => vi.advanceTimersByTime(20));
  expect(dialog.style.getPropertyValue("--dialog-viewport-height")).toBe(
    "300px",
  );
  expect(dialog.style.getPropertyValue("--dialog-bottom-offset")).toBe("0px");
  view.unmount();
});

it("não trata zoom de acessibilidade como teclado e remove listeners ao desmontar", () => {
  vi.useFakeTimers();
  vi.stubGlobal("innerHeight", 844);
  const viewport = Object.assign(new EventTarget(), {
    height: 320,
    offsetTop: 100,
    scale: 2,
  });
  vi.stubGlobal("visualViewport", viewport);
  const remove = vi.spyOn(viewport, "removeEventListener"),
    view = render(<Example />),
    dialog = view.container.querySelector("dialog")!;
  act(() => vi.advanceTimersByTime(20));
  expect(dialog.style.getPropertyValue("--dialog-viewport-height")).toBe(
    "844px",
  );
  expect(dialog.style.getPropertyValue("--dialog-viewport-top")).toBe("0px");
  view.unmount();
  expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
  expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
});
it("corrige a rolagem interna quando a área visual é menor que o layout", () => {
  vi.useFakeTimers();
  vi.stubGlobal("innerHeight", 844);
  const viewport = Object.assign(new EventTarget(), {
    height: 360,
    offsetTop: 0,
    scale: 1,
  });
  vi.stubGlobal("visualViewport", viewport);
  const view = render(<Example />),
    dialog = view.container.querySelector("dialog")!,
    input = view.getByLabelText("Campo");
  input.scrollIntoView = vi.fn();
  vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
    top: 500,
    bottom: 550,
  } as DOMRect);
  act(() => input.focus());
  act(() => vi.advanceTimersByTime(20));
  expect(dialog.scrollTop).toBe(206);
});
