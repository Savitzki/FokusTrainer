import {
  render,
  screen,
  within,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import CosmeticShop, { equippedItem } from "./CosmeticShop";
import type { Cosmetic } from "./gamification";
import type { GameController } from "./useGamification";
import { blankProfile } from "./profile";
import { FRAME_IMAGES, BANNER_IMAGES, frameImage } from "./cosmetics";
import { Avatar } from "./ProfilePanel";
import { ProfileCover } from "./ProfileCosmetics";
const item = (
  id: string,
  category: Cosmetic["category"],
  price = 80,
): Cosmetic => ({
  id,
  category,
  name: id,
  price,
  rarity: "common",
  badgeKey: null,
  owned: false,
  equipped: false,
  locked: false,
});
function setup(balance = 1000) {
  const game = {
    state: {
      weekly: {},
      cosmetics: [
        ...Object.keys(FRAME_IMAGES).map((id) => item(id, "frame")),
        ...Object.keys(BANNER_IMAGES).map((id) => item(id, "banner", 100)),
        ...[
          item("frame-energy", "frame"),
          item("share-night", "share"),
          item("emoji-fire", "emoji"),
          item("theme-energy", "theme"),
        ].map((i) => ({ ...i, owned: true, equipped: true })),
      ],
    },
    busy: false,
    error: "",
    act: vi.fn().mockResolvedValue(true),
    refresh: vi.fn(),
  } as unknown as GameController;
  const changed = vi.fn();
  const component = () => (
    <CosmeticShop game={game} balance={balance} onChanged={changed} />
  );
  const view = render(component());
  const loaded = () =>
    screen.getAllByAltText(/^Prévia de /).forEach((img) => fireEvent.load(img));
  return { game, changed, loaded, rerender: () => view.rerender(component()) };
}
afterEach(cleanup);
it("exibe exclusivamente quatro molduras e quatro banners, mesmo com itens antigos adquiridos", async () => {
  setup();
  const user = userEvent.setup();
  const frames = screen.getByRole("region", { name: "Molduras" });
  const banners = screen.getByRole("region", { name: "Banners" });
  expect(within(frames).getAllByRole("article")).toHaveLength(4);
  expect(within(banners).getAllByRole("article")).toHaveLength(4);
  expect(screen.getAllByRole("article")).toHaveLength(8);
  expect(screen.queryByText("frame-energy")).not.toBeInTheDocument();
  expect(screen.queryByText("Do seu jeito")).not.toBeInTheDocument();
  expect(screen.queryByRole("img", { name: /Avatar/ })).not.toBeInTheDocument();
  expect(
    frames.compareDocumentPosition(banners) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(screen.queryByText(/potes|CapiWhey/)).not.toBeInTheDocument();
});
it("aguarda imagem oficial e não permite comprar uma prévia ausente", async () => {
  const { game } = setup();
  const button = screen.getByRole("button", {
    name: "Comprar frame-sport-band",
  });
  expect(button).toBeDisabled();
  fireEvent.error(screen.getByAltText("Prévia de frame-sport-band"));
  await userEvent.click(
    screen.getByRole("button", { name: "Ver frame-sport-band" }),
  );
  expect(
    screen.getByRole("button", { name: "Confirmar compra" }),
  ).toBeDisabled();
  expect(game.act).not.toHaveBeenCalled();
});
it("mostra somente a arte do produto e só compra após confirmação, sem enviar preço ou duplicar requisições", async () => {
  const view = setup();
  view.loaded();
  const user = userEvent.setup();
  let finish!: (ok: boolean) => void;
  view.game.act = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  await user.click(
    screen.getByRole("button", { name: "Comprar frame-sport-band" }),
  );
  expect(
    screen.queryByRole("region", { name: "Prévia do seu perfil" }),
  ).not.toBeInTheDocument();
  expect(
    within(screen.getByRole("dialog")).getByAltText(
      "Prévia de frame-sport-band",
    ),
  ).toBeInTheDocument();
  expect(view.game.act).not.toHaveBeenCalled();
  await user.dblClick(screen.getByRole("button", { name: "Confirmar compra" }));
  expect(view.game.act).toHaveBeenCalledExactlyOnceWith("buy_cosmetic", {
    p_item: "frame-sport-band",
    p_timezone: expect.any(String),
  });
  await act(async () => finish(true));
  expect(view.changed).toHaveBeenCalledOnce();
  expect(view.game.state!.cosmetics![0].owned).toBe(false); // Only refreshed server state grants ownership.
});
it("compra banners e mantém saldo insuficiente explicado somente no detalhe", async () => {
  const view = setup(22);
  view.loaded();
  view.loaded();
  expect(
    screen.getByRole("button", { name: "Comprar banner-sunset" }),
  ).toBeDisabled();
  expect(screen.queryByText(/Faltam/)).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Ver banner-sunset" }),
  );
  expect(screen.getByText(/^Faltam/)).toBeVisible();
  expect(screen.getByRole("img", { name: "78 CapiWhey" })).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Confirmar compra" }),
  ).toBeDisabled();
});
it("equipa e remove gratuitamente, refletindo o estado persistido após recarregar", async () => {
  const view = setup();
  view.loaded();
  const user = userEvent.setup();
  const product = view.game.state!.cosmetics!.find(
    (i) => i.id === "banner-sunset",
  )!;
  product.owned = true;
  view.rerender();
  view.loaded();
  await user.click(
    screen.getByRole("button", { name: "Equipar banner-sunset" }),
  );
  expect(view.game.act).toHaveBeenCalledWith(
    "equip_cosmetic",
    expect.objectContaining({ p_category: "banner", p_item: "banner-sunset" }),
  );
  product.equipped = true;
  view.rerender();
  await user.click(screen.getByRole("button", { name: "Ver banner-sunset" }));
  await user.click(screen.getByRole("button", { name: "Desequipar" }));
  expect(view.game.act).toHaveBeenLastCalledWith(
    "equip_cosmetic",
    expect.objectContaining({ p_category: "banner", p_item: null }),
  );
  expect(view.game.act).not.toHaveBeenCalledWith(
    "buy_cosmetic",
    expect.anything(),
  );
});
it("não mostra sucesso quando o servidor rejeita a compra", async () => {
  const view = setup();
  view.loaded();
  view.game.act = vi.fn().mockResolvedValue(false);
  await userEvent.click(
    screen.getByRole("button", { name: "Comprar frame-sport-band" }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Confirmar compra" }),
  );
  expect(screen.queryByText("Compra concluída")).not.toBeInTheDocument();
  expect(view.changed).not.toHaveBeenCalled();
});
it("desativa produtos bloqueados mesmo com saldo e imagem disponíveis", () => {
  const view = setup();
  view.game.state!.cosmetics![0].locked = true;
  view.rerender();
  view.loaded();
  expect(
    within(screen.getByRole("article", { name: "frame-sport-band" })).getByText(
      "Bloqueado",
      { selector: "button" },
    ),
  ).toBeDisabled();
});
it("molduras antigas usam aparência padrão sem destruir estado de compartilhamento ou reações", () => {
  const view = setup();
  expect(equippedItem(view.game.state, "frame")).toBeUndefined();
  expect(equippedItem(view.game.state, "share")).toBe("share-night");
  expect(equippedItem(view.game.state, "emoji")).toBe("emoji-fire");
  const avatar = render(
    <Avatar profile={blankProfile()} frame="frame-energy" size={44} />,
  );
  expect(avatar.container.querySelector(".avatar-frame-art")).toBeNull();
});
it("sobrepõe a moldura sem mudar o avatar e elimina imagens quebradas de moldura e banner", () => {
  const view = render(
    <>
      <Avatar profile={blankProfile()} frame="frame-sport-band" size={44} />
      <ProfileCover banner="banner-sunset" />
    </>,
  );
  const avatar = view.container.querySelector(".profile-avatar")!;
  expect(avatar).toHaveAttribute("width", "44");
  expect(view.container.querySelector(".avatar-frame-art")).toHaveAttribute(
    "src",
    frameImage("frame-sport-band"),
  );
  fireEvent.error(view.container.querySelector(".avatar-frame-art")!);
  fireEvent.error(view.container.querySelector(".profile-cover")!);
  expect(view.container.querySelector(".avatar-frame-art")).toBeNull();
  expect(view.container.querySelector(".profile-cover")).toBeNull();
});
