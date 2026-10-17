import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import InstallApp from "./InstallApp";

afterEach(() => vi.unstubAllGlobals());

describe("instalação do aplicativo", () => {
  it("reconhece a abertura em tela cheia e volta a oferecer instalação ao sair para o navegador", () => {
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
