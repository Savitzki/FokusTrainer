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
