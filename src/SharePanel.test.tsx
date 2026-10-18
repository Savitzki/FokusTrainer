import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SharePanel from "./SharePanel";
import { createShareImage, downloadShareImage } from "./sharing";

vi.mock("./sharing", async (original) => ({
  ...(await original<typeof import("./sharing")>()),
  createShareImage: vi.fn(
    async () => new File(["test-image"], "card.png", { type: "image/png" }),
  ),
  downloadShareImage: vi.fn(),
}));
beforeEach(() => {
  const NativeURL = URL;
  vi.stubGlobal(
    "URL",
    class extends NativeURL {
      static createObjectURL() {
        return "blob:card";
      }
      static revokeObjectURL() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("compartilhamento", () => {
  it("envia somente o card atual e a mensagem editada ao menu do sistema", async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, canShare: () => true });
    render(<SharePanel profile={null} days={3} date="2026-10-16" />);
    await screen.findByRole("img", { name: /Card de 3 dias/ });
    await user.clear(screen.getByLabelText("Sua mensagem"));
    await user.type(
      screen.getByLabelText("Sua mensagem"),
      "Hoje eu fui por mim.",
    );
    expect(
      screen.getByRole("button", { name: "Compartilhar imagem" }),
    ).toBeDisabled();
    await screen.findByRole("img", { name: /Card de 3 dias/ });
    await user.click(
      screen.getByRole("button", { name: "Compartilhar imagem" }),
    );
    expect(share).toHaveBeenCalledWith({
      files: [expect.any(File)],
      title: "Minha ofensiva na Capibora",
      text: "Hoje eu fui por mim.",
    });
    expect(createShareImage).toHaveBeenLastCalledWith({
      profile: null,
      days: 3,
      message: "Hoje eu fui por mim.",
      format: "story",
      date: "2026-10-16",
    });
  });
  it("oferece download explícito quando compartilhar arquivos não é suportado", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("navigator", { canShare: () => false });
    render(<SharePanel profile={null} days={1} date="2026-10-16" />);
    await screen.findByRole("img", { name: /Card de 1 dia/ });
    await user.click(
      screen.getByRole("button", { name: "Compartilhar imagem" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("baixe o card");
    expect(downloadShareImage).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Baixar imagem" }));
    expect(downloadShareImage).toHaveBeenCalledTimes(1);
  });
  it("trata cancelamento como uma escolha do usuário, sem publicar nem baixar", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("navigator", {
      canShare: () => true,
      share: vi
        .fn()
        .mockRejectedValue(new DOMException("Cancelado", "AbortError")),
    });
    render(<SharePanel profile={null} days={2} date="2026-10-16" />);
    await screen.findByRole("img", { name: /Card de 2 dias/ });
    await user.click(
      screen.getByRole("button", { name: "Compartilhar imagem" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(downloadShareImage).not.toHaveBeenCalled();
  });
  it("não gera uma conquista quando a ofensiva está zerada", () => {
    render(<SharePanel profile={null} days={0} date="2026-10-16" />);
    expect(
      screen.getByRole("button", { name: "Compartilhar imagem" }),
    ).toBeDisabled();
    expect(createShareImage).not.toHaveBeenCalled();
  });
});
