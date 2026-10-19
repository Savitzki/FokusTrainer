import { act, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useMinimumLoading } from "./useMinimumLoading";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

it("mantém a abertura por 2 segundos mesmo com cache ou consulta imediata", () => {
  const hook = renderHook(({ pending }) => useMinimumLoading(pending), {
    initialProps: { pending: true },
  });
  hook.rerender({ pending: false });
  advance(1999);
  expect(hook.result.current).toBe(true);
  advance(1);
  expect(hook.result.current).toBe(false);
});
it("a troca de etapas e novas renderizações não reiniciam o prazo", () => {
  const hook = renderHook(({ pending }) => useMinimumLoading(pending), {
    initialProps: { pending: true },
  });
  advance(700);
  hook.rerender({ pending: true });
  advance(700);
  hook.rerender({ pending: false });
  advance(599);
  expect(hook.result.current).toBe(true);
  advance(1);
  expect(hook.result.current).toBe(false);
});
it("aguarda consultas lentas depois dos 2 segundos e libera sem acrescentar outro prazo", () => {
  const hook = renderHook(({ pending }) => useMinimumLoading(pending), {
    initialProps: { pending: true },
  });
  advance(5000);
  expect(hook.result.current).toBe(true);
  hook.rerender({ pending: false });
  expect(hook.result.current).toBe(false);
});
it("atualização sem novo bloqueio não mostra a tela novamente", () => {
  const hook = renderHook(({ pending }) => useMinimumLoading(pending), {
    initialProps: { pending: true },
  });
  hook.rerender({ pending: false });
  advance(2000);
  hook.rerender({ pending: false });
  advance(5000);
  expect(hook.result.current).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
it("uma nova abertura após troca de conta recebe seu próprio mínimo de 2 segundos", () => {
  const hook = renderHook(({ pending }) => useMinimumLoading(pending), {
    initialProps: { pending: true },
  });
  hook.rerender({ pending: false });
  advance(2000);
  advance(1000);
  hook.rerender({ pending: true });
  hook.rerender({ pending: false });
  advance(1999);
  expect(hook.result.current).toBe(true);
  advance(1);
  expect(hook.result.current).toBe(false);
});
it("limpa o timeout ao desmontar", () => {
  const hook = renderHook(() => useMinimumLoading(true));
  expect(vi.getTimerCount()).toBe(1);
  hook.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it("não duplica o tempo nem timers em StrictMode", () => {
  const hook = renderHook(({ pending }) => useMinimumLoading(pending), {
    initialProps: { pending: true },
    wrapper: ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    ),
  });
  expect(vi.getTimerCount()).toBe(1);
  hook.rerender({ pending: false });
  advance(2000);
  expect(hook.result.current).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
