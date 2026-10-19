import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { readDestination, usePageNavigation } from "./navigation";

it("preserva seções da Arena e Loja no endereço e após remontar", () => {
  const view = renderHook(() => usePageNavigation());
  act(() => view.result.current.navigate("social", { tab: "challenges" }));
  expect(location.hash).toBe("#/arena?aba=challenges");
  expect(view.result.current.arenaTab).toBe("challenges");
  view.unmount();
  const restored = renderHook(() => usePageNavigation());
  expect(restored.result.current.arenaTab).toBe("challenges");
  act(() => restored.result.current.navigate("shop", { section: "banners" }));
  expect(location.hash).toBe("#/loja?secao=banners");
  expect(readDestination().shopSection).toBe("banners");
});
it("volta ao predecessor real, inclusive à aba anterior da Arena", async () => {
  const view = renderHook(() => usePageNavigation());
  act(() => view.result.current.navigate("social", { tab: "friends" }));
  act(() => view.result.current.navigate("session"));
  act(() => view.result.current.goBack());
  await waitFor(() => expect(view.result.current.page).toBe("social"));
  expect(view.result.current.arenaTab).toBe("friends");
});
it("acesso direto usa retorno seguro sem sair da PWA e sem criar uma volta em ciclo", () => {
  window.history.replaceState(null, "", "/#/treino-em-andamento");
  const replace = vi.spyOn(window.history, "replaceState"),
    push = vi.spyOn(window.history, "pushState");
  const view = renderHook(() => usePageNavigation());
  act(() => view.result.current.goBack("workouts"));
  expect(location.hash).toBe("#/treinos");
  expect(replace).toHaveBeenCalledOnce();
  expect(push).not.toHaveBeenCalled();
  replace.mockRestore();
  push.mockRestore();
});
it("visitantes não montam destinos privados, mesmo com parâmetros de seção", () => {
  window.history.replaceState(null, "", "/#/arena?aba=challenges");
  const view = renderHook(() => usePageNavigation(true));
  expect(view.result.current.page).toBe("overview");
  expect(location.hash).toBe("#/");
  act(() => view.result.current.navigate("shop", { section: "kits" }));
  expect(location.hash).toBe("#/");
  expect(view.result.current.shopSection).toBeNull();
});
it("ignora parâmetros inválidos sem transformar uma página conhecida em Início", () => {
  window.history.replaceState(null, "", "/#/arena?aba=desconhecida");
  expect(readDestination()).toMatchObject({ page: "social", arenaTab: null });
  window.history.replaceState(null, "", "/#/loja?secao=desconhecida");
  expect(readDestination()).toMatchObject({ page: "shop", shopSection: null });
});
