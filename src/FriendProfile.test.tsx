import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import FriendProfile from "./FriendProfile";
import { readFriendProfile } from "./friendProfile";
import { blankProfile } from "./profile";
import { notifySyncWrite } from "./sync";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("./backend", () => ({ accountConfigured: true, backendRpc: rpc }));
const value = {
  nickname: "bia.capibora",
  displayName: "Beatriz",
  avatar: {
    ...blankProfile(),
    nickname: "bia.capibora",
    color: "forest",
    photo: "data:image/png;base64,YQ==",
  },
  frame: "frame-water-wave",
  banner: "banner-forest",
  streak: { current: 4, best: 12 },
  badges: [
    {
      key: "workout-1",
      name: "Tá pago",
      icon: "flame",
      medalKey: "workout-1",
      rarity: "common",
      earnedAt: "2026-10-20T12:00:00Z",
    },
  ],
};
const props = {
  userId: "viewer",
  friendId: "bia",
  nickname: "bia.capibora",
  onClose: vi.fn(),
};
beforeEach(() => {
  rpc.mockReset();
  props.onClose.mockReset();
  localStorage.clear();
});

it("mostra identidade, cosméticos, medalhas compartilhadas e pontos reais sem campos editáveis", async () => {
  rpc.mockResolvedValue(value);
  render(<FriendProfile {...props} />);
  const dialog = screen.getByRole("dialog", { name: "Perfil de bia.capibora" });
  expect(await within(dialog).findByText("Beatriz")).toBeVisible();
  expect(within(dialog).getByText("@bia.capibora")).toBeVisible();
  expect(
    within(dialog).getByRole("img", { name: "Avatar de bia.capibora" }),
  ).toHaveAttribute("src", value.avatar.photo);
  expect(dialog.querySelector(".avatar-frame-art")).toHaveAttribute(
    "src",
    expect.stringContaining("onda-aquatica"),
  );
  expect(dialog.querySelector(".profile-cover")).toHaveAttribute(
    "src",
    expect.stringContaining("floresta"),
  );
  expect(within(dialog).getByLabelText("Ofensiva do amigo")).toHaveTextContent(
    "4 pontosRecorde12 pontos",
  );
  expect(within(dialog).getByText("Tá pago")).toBeVisible();
  expect(dialog.querySelector("time")).toHaveAttribute(
    "datetime",
    value.badges[0].earnedAt,
  );
  expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
  expect(within(dialog).getAllByRole("button")).toHaveLength(1);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("get_friend_showcase", {
    p_user: "bia",
  });
  expect(localStorage.length).toBe(0);
});

it("fecha somente pelo X, nunca pelo fundo ou Escape", async () => {
  rpc.mockResolvedValue(value);
  render(<FriendProfile {...props} />);
  await screen.findByText("Beatriz");
  const dialog = screen.getByRole("dialog");
  fireEvent.click(dialog);
  const cancel = new Event("cancel", { cancelable: true });
  fireEvent(dialog, cancel);
  expect(cancel.defaultPrevented).toBe(true);
  expect(dialog).toHaveAttribute("closedby", "none");
  expect(props.onClose).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Fechar janela" }));
  expect(props.onClose).toHaveBeenCalledOnce();
});

it("preserva compatibilidade sem inventar ofensiva ou medalhas privadas", async () => {
  rpc.mockResolvedValue({ nickname: "bia.capibora", badges: [] });
  render(<FriendProfile {...props} />);
  expect(
    await screen.findByText("Nenhuma medalha compartilhada"),
  ).toBeVisible();
  expect(screen.getByText("Ofensiva indisponível")).toBeVisible();
  expect(document.querySelector(".profile-cover")).toBeNull();
  expect(document.querySelector(".avatar-frame-art")).toBeNull();
});

it("permite repetir uma consulta que falhou, sem operações de escrita", async () => {
  rpc
    .mockRejectedValueOnce(
      new Error("Este perfil está disponível apenas para amigos."),
    )
    .mockResolvedValueOnce(value);
  render(<FriendProfile {...props} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "apenas para amigos",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Tentar novamente" }),
  );
  expect(await screen.findByText("Beatriz")).toBeVisible();
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("ignora resposta atrasada depois da troca de conta/amigo", async () => {
  let resolve!: (v: unknown) => void;
  rpc
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValueOnce({
      nickname: "caio",
      displayName: "Caio",
      badges: [],
    });
  const view = render(<FriendProfile {...props} />);
  expect(screen.getByRole("status")).toHaveTextContent("Carregando");
  view.rerender(
    <FriendProfile {...props} userId="other" friendId="caio" nickname="caio" />,
  );
  await screen.findByText("Caio");
  await act(async () => resolve(value));
  expect(screen.queryByText("Beatriz")).not.toBeInTheDocument();
  expect(screen.getByText("Caio")).toBeVisible();
});

it("valida o contrato e descarta dados privados ou pontos inválidos", () => {
  expect(
    readFriendProfile({
      ...value,
      email: "private@example.invalid",
      weight: 70,
    }),
  ).not.toHaveProperty("email");
  expect(
    readFriendProfile({ ...value, streak: { current: -1, best: 12 } }).streak,
  ).toBeUndefined();
  expect(
    readFriendProfile({ ...value, badges: Array(5).fill(value.badges[0]) })
      .badges,
  ).toHaveLength(3);
  expect(() => readFriendProfile(null)).toThrow();
});

it("oculta os dados se o servidor revogar o acesso durante a consulta aberta", async () => {
  rpc
    .mockResolvedValueOnce(value)
    .mockRejectedValueOnce(
      new Error("Este perfil está disponível apenas para amigos."),
    );
  render(<FriendProfile {...props} />);
  await screen.findByText("Beatriz");
  await act(async () => {
    notifySyncWrite("viewer", "remove_friend");
  });
  await screen.findByRole("alert");
  expect(screen.queryByText("Beatriz")).not.toBeInTheDocument();
  expect(screen.queryByText("Tá pago")).not.toBeInTheDocument();
});
