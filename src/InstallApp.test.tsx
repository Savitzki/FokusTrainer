import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import InstallApp from "./InstallApp";
import { MANIFEST_CHANGED_EVENT } from "./theme";

afterEach(() => vi.unstubAllGlobals());

describe("instalação do aplicativo", () => {
  it("descarta uma oferta de instalação que usava as cores do tema anterior", async () => {
    render(<InstallApp />);
    const prompt = vi.fn().mockResolvedValue(undefined);
    fireEvent(
      window,
      Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
        prompt,
        userChoice: Promise.resolve({ outcome: "accepted" }),
      }),
    );
    fireEvent(window, new Event(MANIFEST_CHANGED_EVENT));
    await userEvent.click(screen.getByRole("button", { name: "Instalar app" }));
    expect(prompt).not.toHaveBeenCalled();
    expect(
      screen.getByText(/No Chrome do Android:|Abra o endereço HTTPS/),
    ).toBeInTheDocument();
  });
  it("reconhece instalações antigas enquanto o navegador atualiza o modo de exibição", () => {
    const fullscreen = Object.assign(new EventTarget(), { matches: true });
    const standalone = Object.assign(new EventTarget(), { matches: false });
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) =>
        query.includes("fullscreen") ? fullscreen : standalone,
      ),
    );
    render(<InstallApp />);
    expect(screen.queryByRole("button", { name: "Instalar app" })).toBeNull();
    fullscreen.matches = false;
    act(() => {
      fullscreen.dispatchEvent(new Event("change"));
    });
    expect(
      screen.getByRole("button", { name: "Instalar app" }),
    ).toBeInTheDocument();
  });
  it("não oferece instalação quando já está aberto como app no iPhone", () => {
    vi.stubGlobal("navigator", { standalone: true, userAgent: "iPhone" });
    render(<InstallApp />);
    expect(
      screen.queryByRole("button", { name: "Instalar app" }),
    ).not.toBeInTheDocument();
  });
  it("invoca o prompt do navegador e oculta a instalação após appinstalled", async () => {
    const user = userEvent.setup();
    render(<InstallApp />);
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(
      new Event("beforeinstallprompt", { cancelable: true }),
      { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) },
    );
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(true);
    await user.click(screen.getByRole("button", { name: "Instalar app" }));
    expect(prompt).toHaveBeenCalledTimes(1);
    fireEvent(window, new Event("appinstalled"));
    expect(
      screen.queryByRole("button", { name: "Instalar app" }),
    ).not.toBeInTheDocument();
  });
  it("oferece instruções quando o navegador não oferece prompt automático", async () => {
    vi.stubGlobal("isSecureContext", true);
    const user = userEvent.setup();
    render(<InstallApp />);
    await user.click(screen.getByRole("button", { name: "Instalar app" }));
    expect(screen.getByText(/No Chrome do Android:/)).toBeInTheDocument();
    expect(
      screen.getByText(/não ativa avisos com o app fechado/),
    ).toBeInTheDocument();
  });
  it("explica o caminho do Safari para instalar no iPhone", async () => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", {
      userAgent: "iPhone",
      platform: "iPhone",
      maxTouchPoints: 5,
    });
    const user = userEvent.setup();
    render(<InstallApp />);
    await user.click(screen.getByRole("button", { name: "Instalar app" }));
    expect(screen.getByText(/No Safari: Compartilhar/)).toBeInTheDocument();
  });
});
