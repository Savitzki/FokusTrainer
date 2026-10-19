import { afterEach, describe, expect, it, vi } from "vitest";
import { notify } from "./notifications";

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("notificações em uma subpasta de hospedagem", () => {
  it("registra o worker e o ícone dentro do caminho do aplicativo", async () => {
    window.history.replaceState({}, "", "/FokusTrainer/");
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("Notification", { permission: "granted" });
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const registration = { showNotification };
    const register = vi.fn().mockResolvedValue(registration);
    vi.stubGlobal("navigator", {
      serviceWorker: { register, ready: Promise.resolve(registration) },
    });

    expect(await notify("Treino", "Hora de se movimentar")).toBe(true);
    expect(register).toHaveBeenCalledWith(
      `${window.location.origin}/FokusTrainer/sw.js`,
    );
    expect(showNotification).toHaveBeenCalledWith("Treino", {
      body: "Hora de se movimentar",
      icon: `${window.location.origin}/FokusTrainer/icon.svg`,
      badge: `${window.location.origin}/FokusTrainer/icons/notification-badge.png`,
      tag: "fokus-reminder",
    });
  });

  it("não tenta enviar se a permissão estiver bloqueada", async () => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("Notification", { permission: "denied" });
    const register = vi.fn();
    vi.stubGlobal("navigator", { serviceWorker: { register } });
    expect(await notify("Treino", "Hora de treinar")).toBe(false);
    expect(register).not.toHaveBeenCalled();
  });
});

it("abandona um aviso se houver logout ou desativação enquanto o worker está preparando", async () => {
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("Notification", { permission: "granted" });
  const showNotification = vi.fn();
  let ready!: () => void,
    allowed = true;
  const registration = { showNotification };
  vi.stubGlobal("navigator", {
    serviceWorker: {
      register: vi.fn().mockResolvedValue(registration),
      ready: new Promise<void>((resolve) => {
        ready = resolve;
      }),
    },
  });
  const pending = notify("Treino", "Vai hoje ou não?", "event", () => allowed);
  allowed = false;
  ready();
  expect(await pending).toBe(false);
  expect(showNotification).not.toHaveBeenCalled();
});
