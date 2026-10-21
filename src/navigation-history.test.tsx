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
  expect(location.hash).toBe("#/");
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

it("detalhes de equipe usam a navegação existente e Voltar preserva a aba", async () => {
  const view = renderHook(() => usePageNavigation());
  act(() => view.result.current.navigate("social", { tab: "groups" }));
  act(() =>
    view.result.current.navigate("social", { tab: "groups", group: "team-a" }),
  );
  expect(view.result.current.arenaGroup).toBe("team-a");
  expect(readDestination().arenaGroup).toBe("team-a");
  act(() => view.result.current.goBack("social"));
  await waitFor(() => expect(view.result.current.arenaGroup).toBeNull());
  expect(view.result.current.arenaTab).toBe("groups");
});
it("a ficha do rival é restaurada após recarga e parâmetros não atravessam abas", () => {
  window.history.replaceState(
    null,
    "",
    "/#/arena?aba=friends&amigo=bia&grupo=other",
  );
  const view = renderHook(() => usePageNavigation());
  expect(view.result.current.arenaFriend).toBe("bia");
  expect(view.result.current.arenaGroup).toBeNull();
  act(() => view.result.current.navigate("social", { tab: "challenges" }));
  expect(view.result.current.arenaFriend).toBeNull();
  expect(location.hash).toBe("#/arena?aba=challenges");
});
it("abrir a ficha sobre a Arena preserva a rolagem sem perder o destino no histórico", () => {
  window.history.replaceState(null, "", "#/arena?aba=friends");
  const view = renderHook(() => usePageNavigation());
  const scroll = vi.spyOn(window, "scrollTo");
  scroll.mockClear();
  act(() =>
    view.result.current.navigate("social", { tab: "friends", friend: "bia" }),
  );
  expect(scroll).not.toHaveBeenCalled();
  expect(view.result.current.arenaFriend).toBe("bia");
  scroll.mockRestore();
});

it("Perfil → Conquistas → Voltar retorna ao Perfil; Configurações retorna ao predecessor real",async()=>{
 window.history.replaceState(null,"","/#/");
 const view=renderHook(()=>usePageNavigation());
 act(()=>view.result.current.navigate("shop"));act(()=>view.result.current.navigate("profile"));
 act(()=>view.result.current.navigate("achievements")); expect(location.hash).toBe("#/conquistas");
 act(()=>view.result.current.goBack());await waitFor(()=>expect(view.result.current.page).toBe("profile"));
 act(()=>view.result.current.goBack());await waitFor(()=>expect(view.result.current.page).toBe("shop"));
 act(()=>view.result.current.navigate("overview"));act(()=>view.result.current.navigate("settings"));
 act(()=>view.result.current.goBack());await waitFor(()=>expect(view.result.current.page).toBe("overview"));
});
it("hash externo ou destino substituído não reutiliza um capiboraFrom antigo",()=>{
 window.history.replaceState({capiboraAt:"https://wrong.invalid/",capiboraFrom:location.origin+"/#/peso"},"","/#/configuracoes");
 const view=renderHook(()=>usePageNavigation());act(()=>view.result.current.goBack());
 expect(location.hash).toBe("#/");expect(history.state.capiboraFrom).toBeUndefined();
});
it("links diretos de conquistas têm retorno Início e continuam privados para visitantes",()=>{
 window.history.replaceState(null,"","/#/conquistas");const view=renderHook(()=>usePageNavigation());
 expect(view.result.current.page).toBe("achievements");act(()=>view.result.current.goBack());expect(location.hash).toBe("#/");
 view.unmount();window.history.replaceState(null,"","/#/conquistas");renderHook(()=>usePageNavigation(true));expect(location.hash).toBe("#/");
});
it("replace de seção mantém somente o predecessor válido e não cria entrada duplicada",async()=>{
 window.history.replaceState(null,"","/#/perfil");const view=renderHook(()=>usePageNavigation());
 act(()=>view.result.current.navigate("shop",{section:"molduras"}));const push=vi.spyOn(history,"pushState");
 act(()=>view.result.current.navigate("shop",{section:"banners",replace:true}));expect(push).not.toHaveBeenCalled();
 act(()=>view.result.current.goBack());await waitFor(()=>expect(view.result.current.page).toBe("profile"));push.mockRestore();
});

it("Início sem hash → Configurações → Voltar usa a entrada real, sem duplicar Início",async()=>{
 window.history.replaceState(null,"","/");const view=renderHook(()=>usePageNavigation());
 act(()=>view.result.current.navigate("settings"));const back=vi.spyOn(history,"back");
 act(()=>view.result.current.goBack());expect(back).toHaveBeenCalledOnce();
 await waitFor(()=>expect(view.result.current.page).toBe("overview"));expect(location.hash).toBe("");back.mockRestore();
});
it("Voltar reconhece URLs antigas sem tratar fragmentos de autenticação como páginas",async()=>{
 window.history.replaceState(null,"","/#reminders");const view=renderHook(()=>usePageNavigation());
 act(()=>view.result.current.navigate("profile"));act(()=>view.result.current.goBack());
 await waitFor(()=>expect(view.result.current.page).toBe("settings"));expect(location.hash).toBe("#reminders");
});
