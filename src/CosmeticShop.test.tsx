import { render, screen, within, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import CosmeticShop from "./CosmeticShop";
import type { Cosmetic, GameState } from "./gamification";
import type { GameController } from "./useGamification";
import { blankProfile } from "./profile";
import { createShareImage } from "./sharing";
import {
  EMOJIS,
  FRAME_IMAGES,
  THEME_STYLES,
  themeVariables,
} from "./cosmetics";
vi.mock("./sharing", async (original) => ({
  ...(await original<typeof import("./sharing")>()),
  createShareImage: vi.fn(
    async () => new File(["preview"], "preview.png", { type: "image/png" }),
  ),
}));
const cosmetic = (
  id: string,
  category: Cosmetic["category"],
  price = 100,
): Cosmetic => ({
  id,
  name: id,
  category,
  price,
  owned: false,
  equipped: false,
  locked: false,
  rarity: "common",
  badgeKey: null,
});
function setup(balance = 1000, extra: Cosmetic[] = []) {
  const game = {
    state: {
      weekly: {},
      cosmetics: [
        cosmetic("frame-energy", "frame", 250),
        cosmetic("share-night", "share", 150),
        cosmetic("theme-progress", "theme", 250),
        cosmetic("emoji-fire", "emoji", 30),
        ...extra,
      ],
    },
    busy: false,
    error: "",
    act: vi.fn().mockResolvedValue(true),
    refresh: vi.fn(),
  } as unknown as GameController;
  let amount = balance;
  const renderShop = () => (
    <CosmeticShop
      game={game}
      balance={amount}
      onChanged={vi.fn()}
      profile={{ ...blankProfile(), nickname: "Dani" }}
      days={3}
      date="2026-10-18"
    />
  );
  const result = render(renderShop());
  return {
    game,
    rerender: (next = amount) => {
      amount = next;
      result.rerender(renderShop());
    },
  };
}
beforeEach(() => {
  const NativeURL = URL;
  vi.stubGlobal(
    "URL",
    class extends NativeURL {
      static createObjectURL() {
        return "blob:shop";
      }
      static revokeObjectURL() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("mostra quatro categorias sem abas vazias e navega sem misturar produtos", async () => {
  const user = userEvent.setup();
  setup();
  const categories = screen.getByRole("group", { name: "Categorias da loja" });
  expect(within(categories).getAllByRole("button")).toHaveLength(4);
  expect(screen.getByRole("article", { name: "frame-energy" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Emojis" }));
  expect(screen.getByRole("article", { name: "emoji-fire" })).toBeVisible();
  expect(
    screen.queryByRole("article", { name: "frame-energy" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(EMOJIS["emoji-fire"])).toBeVisible();
});
it("usa a moldura enviada e o avatar real na prévia", () => {
  setup();
  expect(FRAME_IMAGES["frame-energy"]).toBe("energy");
  const img = screen.getByRole("img", { name: "Avatar de Dani" });
  expect(img).toHaveAttribute("data-frame", "frame-energy");
  expect(img.parentElement?.querySelector(".avatar-frame-art")).toHaveAttribute(
    "src",
    expect.stringContaining("images/shop/frames/energy.webp"),
  );
});
it("só compra após confirmação, não envia preços e bloqueia cliques simultâneos", async () => {
  const user = userEvent.setup(),
    { game } = setup();
  let finish!: (value: boolean) => void;
  game.act = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  await user.click(
    screen.getByRole("button", { name: "Comprar frame-energy" }),
  );
  expect(game.act).not.toHaveBeenCalled();
  const confirm = screen.getByRole("button", {
    name: "Confirmar compra · 250",
  });
  await user.dblClick(confirm);
  expect(game.act).toHaveBeenCalledExactlyOnceWith("buy_cosmetic", {
    p_item: "frame-energy",
    p_timezone: expect.any(String),
  });
  expect(confirm).toBeDisabled();
  await act(async () => finish(true));
  expect(screen.getByRole("dialog")).toHaveTextContent("Compra concluída");
});
it("mantém saldo insuficiente fora dos cards e explica a diferença só no detalhe", async () => {
  const user = userEvent.setup();
  setup(22);
  expect(
    screen.getByRole("button", { name: "Comprar frame-energy" }),
  ).toBeDisabled();
  expect(screen.queryByText(/Faltam/)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Ver frame-energy" }));
  expect(screen.getByText("Faltam 228 potes")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Confirmar compra · 250" }),
  ).toBeDisabled();
});
it("permite equipar e desequipar sem outra compra e reflete atualização do servidor", async () => {
  const user = userEvent.setup(),
    view = setup();
  const item = view.game.state!.cosmetics![0];
  item.owned = true;
  view.rerender();
  await user.click(
    screen.getByRole("button", { name: "Equipar frame-energy" }),
  );
  expect(view.game.act).toHaveBeenCalledWith(
    "equip_cosmetic",
    expect.objectContaining({ p_item: item.id, p_category: "frame" }),
  );
  item.equipped = true;
  view.rerender();
  await user.click(screen.getByRole("button", { name: "Ver frame-energy" }));
  await user.click(screen.getByRole("button", { name: "Desequipar" }));
  expect(view.game.act).toHaveBeenLastCalledWith(
    "equip_cosmetic",
    expect.objectContaining({ p_item: null }),
  );
  expect(view.game.act).not.toHaveBeenCalledWith(
    "buy_cosmetic",
    expect.anything(),
  );
});
it("mantém bloqueios por conquistas sem botão de compra ativo", async () => {
  const user = userEvent.setup(),
    locked = {
      ...cosmetic("frame-victory", "frame", 250),
      locked: true,
      badgeKey: "week-4",
    };
  const { game } = setup(1000, [locked]);
  expect(
    screen.getByRole("button", { name: "Bloqueado: frame-victory" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Ver frame-victory" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Uma conquista");
  expect(game.act).not.toHaveBeenCalled();
});
it("gera cards com o mesmo gerador do compartilhamento e mantém o clássico incluso", async () => {
  const user = userEvent.setup();
  setup();
  await user.click(screen.getByRole("button", { name: "Cards" }));
  await screen.findByAltText("Prévia real de share-night");
  expect(createShareImage).toHaveBeenCalledWith(
    expect.objectContaining({
      styleId: "share-night",
      days: 3,
      previewSize: 320,
      preview: true,
    }),
  );
  expect(screen.getByText("Clássico")).toBeVisible();
  expect(screen.getByText("Incluso")).toBeVisible();
});
it("mostra prévias claras e escuras e preserva os controles gratuitos de aparência", async () => {
  const user = userEvent.setup();
  setup();
  await user.click(screen.getByRole("button", { name: "Temas" }));
  expect(
    screen.getByLabelText("Prévia clara e escura de theme-progress"),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Claro" }));
  expect(document.documentElement.dataset.theme).toBe("light");
  await user.click(screen.getByRole("button", { name: "Escuro" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  for (const id of Object.keys(THEME_STYLES)) {
    expect(themeVariables(id, "dark")).not.toEqual(themeVariables(id, "light"));
  }
});
it("equipa emojis como favorito usando o mesmo inventário", async () => {
  const user = userEvent.setup(),
    view = setup();
  view.game.state!.cosmetics!.find((i) => i.category === "emoji")!.owned = true;
  view.rerender();
  await user.click(screen.getByRole("button", { name: "Emojis" }));
  await user.click(screen.getByRole("button", { name: "Equipar emoji-fire" }));
  expect(view.game.act).toHaveBeenCalledWith(
    "equip_cosmetic",
    expect.objectContaining({ p_category: "emoji", p_item: "emoji-fire" }),
  );
});
it("não mostra sucesso nem muda o inventário quando a compra falha", async () => {
  const user = userEvent.setup(),
    view = setup();
  view.game.act = vi.fn().mockResolvedValue(false);
  await user.click(
    screen.getByRole("button", { name: "Comprar frame-energy" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Confirmar compra · 250" }),
  );
  expect(screen.queryByText(/Comprado!/)).not.toBeInTheDocument();
  expect(view.game.state!.cosmetics![0].owned).toBe(false);
});
