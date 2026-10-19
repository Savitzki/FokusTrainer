import { act, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LOADING_EXIT_FALLBACK_MS, useLoadingExit } from "./useLoadingExit";

let motion: MediaQueryList;
beforeEach(() => {
  vi.useFakeTimers();
  const events = new EventTarget();
  motion = Object.assign(events, { matches: false }) as MediaQueryList;
  vi.stubGlobal("matchMedia", () => motion);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("não cria uma camada nem atraso para uma interface que já está aberta", () => {
  const hook = renderHook(() => useLoadingExit(false));
  expect(hook.result.current.visible).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
it("não começa a saída enquanto a abertura estiver bloqueada", () => {
  const hook = renderHook(() => useLoadingExit(true));
  act(() => hook.result.current.finish());
  act(() => vi.advanceTimersByTime(5000));
  expect(hook.result.current).toMatchObject({ visible: true, leaving: false });
});
it("mantém a mesma camada até a animação terminar e cancela o fallback", () => {
  const hook = renderHook(({ opening }) => useLoadingExit(opening), {
    initialProps: { opening: true },
  });
  hook.rerender({ opening: false });
  expect(hook.result.current).toMatchObject({ visible: true, leaving: true });
  act(() => hook.result.current.finish());
  expect(hook.result.current.visible).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
it("remove a camada mesmo se o navegador não entregar animationend", () => {
  const hook = renderHook(({ opening }) => useLoadingExit(opening), {
    initialProps: { opening: true },
  });
  hook.rerender({ opening: false });
  act(() => vi.advanceTimersByTime(LOADING_EXIT_FALLBACK_MS));
  expect(hook.result.current.visible).toBe(false);
});
it("cancela uma saída anterior quando a conta volta a precisar de carregamento", () => {
  const hook = renderHook(({ opening }) => useLoadingExit(opening), {
    initialProps: { opening: true },
  });
  hook.rerender({ opening: false });
  act(() => vi.advanceTimersByTime(100));
  hook.rerender({ opening: true });
  act(() => vi.advanceTimersByTime(1000));
  expect(hook.result.current).toMatchObject({ visible: true, leaving: false });
  expect(vi.getTimerCount()).toBe(0);
});
it("libera imediatamente com movimento reduzido", () => {
  Object.assign(motion, { matches: true });
  const hook = renderHook(({ opening }) => useLoadingExit(opening), {
    initialProps: { opening: true },
  });
  hook.rerender({ opening: false });
  expect(hook.result.current.visible).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
it("respeita uma mudança para movimento reduzido durante a saída", () => {
  const hook = renderHook(({ opening }) => useLoadingExit(opening), {
    initialProps: { opening: true },
  });
  hook.rerender({ opening: false });
  act(() => {
    Object.assign(motion, { matches: true });
    motion.dispatchEvent(new Event("change"));
  });
  expect(hook.result.current.visible).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
it("limpa timeout e listener ao desmontar, inclusive em StrictMode", () => {
  const removed = vi.spyOn(motion, "removeEventListener");
  const hook = renderHook(({ opening }) => useLoadingExit(opening), {
    initialProps: { opening: true },
    wrapper: ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    ),
  });
  hook.rerender({ opening: false });
  expect(vi.getTimerCount()).toBe(1);
  hook.unmount();
  expect(vi.getTimerCount()).toBe(0);
  expect(removed).toHaveBeenCalledWith("change", expect.any(Function));
});
