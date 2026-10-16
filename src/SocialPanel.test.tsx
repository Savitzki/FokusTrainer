import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { Account } from "./account";
import { blankProfile } from "./profile";
import SocialPanel from "./SocialPanel";
import type { SocialState, useSocial } from "./social";

const code = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const account = {
  user: { id: "me" },
  profile: { ...blankProfile(), nickname: "Dani" },
} as Account;
function setup(state: Partial<SocialState> = {}) {
  const social: ReturnType<typeof useSocial> = {
    state: {
      code,
      workouts: [],
      friends: [{ id: "friend-1", nickname: "Bia" }],
      requests: [],
      groups: [
        {
          id: "group-1",
          name: "Treino das 7",
          timezone: "America/Sao_Paulo",
          status: "active",
          invited: false,
          today: "2026-10-16",
          streak: 3,
          best: 8,
          completed: false,
          members: [
            { id: "me", nickname: "Dani", accepted: true, trained: false },
            { id: "friend-1", nickname: "Bia", accepted: true, trained: true },
          ],
        },
      ],
      ...state,
    },
    error: "",
    busy: false,
    pending: false,
    refresh: vi.fn(),
    act: vi.fn().mockResolvedValue(true),
  };
  render(<SocialPanel account={account} social={social} onProfile={vi.fn()} />);
  return social;
}

it("prioriza a chama do grupo e deixa os formulários fora da tela inicial", () => {
  setup();
  expect(
    screen.getByRole("article", { name: "Grupo Treino das 7" }),
  ).toBeVisible();
  expect(
    screen.getByRole("progressbar", { name: /Treinos de hoje/ }),
  ).toHaveAttribute("aria-valuenow", "1");
  expect(screen.queryByLabelText("Código do amigo")).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Seu código de amigo"),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Nome do grupo")).not.toBeInTheDocument();
});
it("cria o grupo tocando no amigo, sem exigir códigos novamente", async () => {
  const user = userEvent.setup();
  const social = setup();
  await user.click(screen.getByRole("button", { name: "Novo grupo" }));
  await user.type(screen.getByLabelText("Nome do grupo"), "Nosso time");
  expect(
    screen.getByRole("button", { name: "Escolha seus amigos" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("checkbox", { name: "Bia" }));
  await user.click(screen.getByRole("button", { name: "Convidar 1 amigo" }));
  expect(social.act).toHaveBeenCalledWith("create_streak_group", {
    p_name: "Nosso time",
    p_friends: ["friend-1"],
    p_timezone: expect.any(String),
  });
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Convites enviados",
  );
  expect(screen.queryByLabelText("Nome do grupo")).not.toBeInTheDocument();
});
it("mantém o nome e os amigos selecionados se o envio falhar", async () => {
  const user = userEvent.setup();
  const social = setup();
  vi.mocked(social.act).mockResolvedValue(false);
  await user.click(screen.getByRole("button", { name: "Novo grupo" }));
  await user.type(screen.getByLabelText("Nome do grupo"), "Meu time");
  await user.click(screen.getByRole("checkbox", { name: "Bia" }));
  await user.click(screen.getByRole("button", { name: "Convidar 1 amigo" }));
  expect(screen.getByLabelText("Nome do grupo")).toHaveValue("Meu time");
  expect(screen.getByRole("checkbox", { name: "Bia" })).toBeChecked();
  expect(screen.queryByText(/Convites enviados/)).not.toBeInTheDocument();
});
it("mostra o código só quando solicitado e preserva o código do amigo em caso de falha", async () => {
  const user = userEvent.setup();
  const social = setup();
  await user.click(screen.getByRole("button", { name: /^Amigos/ }));
  await user.click(screen.getByRole("button", { name: "Meu código" }));
  expect(screen.getByLabelText("Seu código de amigo")).toHaveValue(code);
  await user.click(
    screen.getByRole("button", { name: "Voltar para amigos e grupos" }),
  );
  await user.click(screen.getByRole("button", { name: "Adicionar amigo" }));
  await user.click(screen.getByLabelText("Código do amigo"));
  await user.paste(
    `Vamos manter a chama juntos? Meu código no FokusTrainer: ${code}`,
  );
  vi.mocked(social.act).mockResolvedValueOnce(false);
  await user.click(screen.getByRole("button", { name: "Enviar convite" }));
  expect(screen.getByLabelText("Código do amigo")).toHaveValue(code);
  await user.click(screen.getByRole("button", { name: "Enviar convite" }));
  expect(social.act).toHaveBeenLastCalledWith("send_friend_request", {
    p_code: code,
  });
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Convite enviado.",
  );
});
it("limita a seleção a sete amigos mesmo ao buscar e limpar a busca", async () => {
  const user = userEvent.setup();
  setup({
    friends: Array.from({ length: 9 }, (_, i) => ({
      id: `friend-${i}`,
      nickname: `Amigo${i}`,
    })),
  });
  await user.click(screen.getByRole("button", { name: "Novo grupo" }));
  for (let i = 0; i < 7; i++)
    await user.click(screen.getByRole("checkbox", { name: `Amigo${i}` }));
  const search = screen.getByRole("searchbox", {
    name: "Buscar amigo para o grupo",
  });
  await user.type(search, "Amigo8");
  expect(screen.getByRole("checkbox", { name: "Amigo8" })).toBeDisabled();
  await user.clear(search);
  await user.click(screen.getByRole("checkbox", { name: "Amigo0" }));
  expect(screen.getByRole("checkbox", { name: "Amigo8" })).toBeEnabled();
});
it("diferencia convites recebidos de pedidos enviados e permite iniciar um grupo com um amigo", async () => {
  const user = userEvent.setup();
  const social = setup({
    requests: [
      { id: "in", nickname: "Caio", incoming: true },
      { id: "out", nickname: "Lu", incoming: false },
    ],
  });
  await user.click(screen.getByRole("button", { name: /^Amigos/ }));
  await user.click(
    screen.getByRole("button", { name: "Aceitar amizade de Caio" }),
  );
  expect(social.act).toHaveBeenCalledWith("reply_friend_request", {
    p_id: "in",
    p_accept: true,
  });
  expect(
    screen.queryByRole("button", { name: "Aceitar amizade de Lu" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Criar grupo com Bia" }));
  expect(screen.getByRole("checkbox", { name: "Bia" })).toBeChecked();
});
