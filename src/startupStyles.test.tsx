import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { waitForStartupStyles, showStartupStyleError } from "./startupStyles";

let links: HTMLLinkElement[] = [];
function pendingStyle(state = "loading") {
  const link = document.createElement("link");
  link.dataset.capiboraStyle = state;
  link.media = "print";
  document.head.append(link);
  links.push(link);
  return link;
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  links.forEach((link) => link.remove());
  links = [];
  vi.useRealTimers();
});
it("não atrasa a abertura quando não há stylesheet pendente", async () => {
  await expect(waitForStartupStyles()).resolves.toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
});
it("aplica o stylesheet já carregado antes de hidratar o app", async () => {
  const link = pendingStyle("ready");
  await expect(waitForStartupStyles()).resolves.toBeUndefined();
  expect(link.media).toBe("all");
  expect(vi.getTimerCount()).toBe(0);
});
it("aguarda somente os estilos pendentes e limpa listeners e timeout após carregar", async () => {
  const link = pendingStyle(),
    removed = vi.spyOn(link, "removeEventListener");
  const request = waitForStartupStyles();
  expect(vi.getTimerCount()).toBe(1);
  link.dispatchEvent(new Event("load"));
  await request;
  expect(link.media).toBe("all");
  expect(removed).toHaveBeenCalledWith("load", expect.any(Function));
  expect(removed).toHaveBeenCalledWith("error", expect.any(Function));
  expect(vi.getTimerCount()).toBe(0);
});
it("trata erro anterior ao JavaScript sem aguardar um evento que já aconteceu", async () => {
  pendingStyle("failed");
  await expect(waitForStartupStyles()).rejects.toThrow(
    "Não foi possível carregar",
  );
  expect(vi.getTimerCount()).toBe(0);
});
it("erro de download cancela a espera e mantém possibilidade de tentar novamente", async () => {
  const link = pendingStyle();
  const request = waitForStartupStyles();
  const check = expect(request).rejects.toThrow("Não foi possível carregar");
  link.dispatchEvent(new Event("error"));
  await check;
  expect(vi.getTimerCount()).toBe(0);
});
it("não deixa a abertura presa para sempre quando o CSS não responde", async () => {
  pendingStyle();
  const request = waitForStartupStyles();
  const check = expect(request).rejects.toThrow("Não foi possível carregar");
  await vi.advanceTimersByTimeAsync(15000);
  await check;
  expect(vi.getTimerCount()).toBe(0);
});
it("mostra uma única recuperação sobre a capivara sem apagar a imagem inicial", () => {
  const root = document.createElement("div");
  root.id = "root";
  root.innerHTML = '<div class="fokus-loading"><img alt=""></div>';
  document.body.append(root);
  try {
    const image = root.querySelector("img");
    showStartupStyleError();
    showStartupStyleError();
    expect(root.querySelector("img")).toBe(image);
    expect(root.querySelectorAll(".loading-recovery")).toHaveLength(1);
    expect(root.querySelector('[role="alert"]')).toHaveTextContent(
      "Não foi possível carregar",
    );
    expect(root.querySelector("button")).toHaveTextContent("Tentar novamente");
  } finally {
    root.remove();
  }
});
