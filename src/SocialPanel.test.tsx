import { render, screen, act, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { Account } from "./account";
import { blankProfile } from "./profile";
import SocialPanel from "./SocialPanel";
import type { SocialState, useSocial } from "./social";

const nicknameRpc = vi.hoisted(() => vi.fn());
vi.mock("./backend", () => ({
  accountConfigured: true,
  backendRpc: nicknameRpc,
}));

const code = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const account = {
  user: { id: "me" },
  profile: { ...blankProfile(), nickname: "Dani" },
} as Account;
function setup(
  state: Partial<SocialState> = {},
  overrides: Partial<ReturnType<typeof useSocial>> = {},
  props: Partial<ComponentProps<typeof SocialPanel>> = {},
) {
  const social: ReturnType<typeof useSocial> = {
    state: {
      code,
      arenaVersion: 2,
      workouts: [],
      friends: [{ id: "friend-1", nickname: "Bia" }],
      requests: [],
      groups: [
        {
          id: "group-1",
          adminId: "friend-1",
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
    ...overrides,
  };
  const element = () => (
    <SocialPanel
      account={account}
      social={social}
      onProfile={vi.fn()}
      {...props}
    />
  );
  const result = render(element());
  return Object.assign(social, { rerender: () => result.rerender(element()) });
}

it("prioriza a chama do grupo e deixa os formulários fora da tela inicial", () => {
  setup();
  expect(
    screen.getByRole("article", { name: "Grupo Treino das 7" }),
  ).toBeVisible();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(screen.getByLabelText("2 integrantes aceitos")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Detalhes de Treino das 7" }),
  ).toBeVisible();
  expect(screen.queryByText(/Recorde/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Código do amigo")).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Seu código de amigo"),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Nome do grupo")).not.toBeInTheDocument();
});

it("identifica o descanso coletivo sem ranking, barras ou horários desnecessários", async () => {
  setup({
    groups: [
      {
        id: "rest-group",
        name: "Time em pausa",
        timezone: "UTC",
        status: "active",
        invited: false,
        today: "2026-10-17",
        streak: 3,
        best: 8,
        completed: true,
        resting: true,
        members: [
          {
            id: "me",
            nickname: "Dani",
            accepted: true,
            trained: false,
            resting: true,
          },
          {
            id: "friend",
            nickname: "Bia",
            accepted: true,
            trained: false,
            resting: true,
          },
        ],
      },
    ],
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Detalhes de Time em pausa" }),
  );
  expect(screen.getAllByText("Descanso protegido")).toHaveLength(2);
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(screen.queryByText("Atividade e metas")).not.toBeInTheDocument();
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
  await user.click(screen.getByRole("tab", { name: /^Amigos/ }));
  expect(
    screen.queryByRole("button", { name: "Meu código" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Adicionar amigo" }));
  await user.click(screen.getByText("Convites por código", { exact: true }));
  await user.click(screen.getByRole("button", { name: "Meu código" }));
  expect(screen.getByLabelText("Seu código de amigo")).toHaveValue(code);
  await user.click(
    screen.getByRole("button", { name: "Voltar para amigos e grupos" }),
  );
  await user.click(screen.getByRole("button", { name: "Adicionar amigo" }));
  await user.click(screen.getByText("Convites por código", { exact: true }));
  await user.click(
    screen.getByRole("button", { name: "Usar código de amigo" }),
  );
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
it("limita a seleção a quatro amigos mesmo ao buscar e limpar a busca", async () => {
  const user = userEvent.setup();
  setup({
    friends: Array.from({ length: 9 }, (_, i) => ({
      id: `friend-${i}`,
      nickname: `Amigo${i}`,
    })),
  });
  await user.click(screen.getByRole("button", { name: "Novo grupo" }));
  for (let i = 0; i < 4; i++)
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
  await user.click(screen.getByRole("tab", { name: /^Amigos/ }));
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
  await user.click(screen.getByRole("button", { name: "Opções de Bia" }));
  await user.click(screen.getByRole("button", { name: "Criar grupo" }));
  expect(screen.getByRole("checkbox", { name: "Bia" })).toBeChecked();
});

it("busca pelo nick e só envia o pedido depois da confirmação explícita", async () => {
  const social = setup(),
    user = userEvent.setup();
  nicknameRpc.mockResolvedValue({
    id: "bia",
    nickname: "Bia",
    relationship: "none",
    requestId: null,
  });
  await user.click(screen.getByRole("tab", { name: /^Amigos/ }));
  await user.click(screen.getByRole("button", { name: "Adicionar amigo" }));
  await user.type(screen.getByLabelText("Nick do amigo"), "@Bia");
  await user.click(screen.getByRole("button", { name: "Buscar" }));
  await screen.findByText("@Bia");
  expect(nicknameRpc).toHaveBeenCalledWith("find_friend_by_nickname", {
    p_nickname: "Bia",
  });
  expect(social.act).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Enviar pedido" }));
  expect(social.act).toHaveBeenCalledWith("send_friend_request_by_nickname", {
    p_nickname: "Bia",
  });
  expect(await screen.findByRole("status")).toHaveTextContent(
    /aguardar o aceite/,
  );
});
it.each([
  ["self", "Esse é o seu nick"],
  ["friend", "Vocês já são amigos"],
  ["outgoing", "aguardando aceite"],
])("não duplica pedidos para relação %s", async (relationship, message) => {
  setup();
  const user = userEvent.setup();
  nicknameRpc.mockResolvedValue({
    id: "bia",
    nickname: "Bia",
    relationship,
    requestId: null,
  });
  await user.click(screen.getByRole("tab", { name: /^Amigos/ }));
  await user.click(screen.getByRole("button", { name: "Adicionar amigo" }));
  await user.type(screen.getByLabelText("Nick do amigo"), "Bia");
  await user.click(screen.getByRole("button", { name: "Buscar" }));
  expect(await screen.findByRole("status")).toHaveTextContent(message);
  expect(
    screen.queryByRole("button", { name: "Enviar pedido" }),
  ).not.toBeInTheDocument();
});
it("um pedido recebido pode ser aceito pelo resultado da busca", async () => {
  const social = setup(),
    user = userEvent.setup();
  nicknameRpc.mockResolvedValue({
    id: "bia",
    nickname: "Bia",
    relationship: "incoming",
    requestId: "request-1",
  });
  await user.click(screen.getByRole("tab", { name: /^Amigos/ }));
  await user.click(screen.getByRole("button", { name: "Adicionar amigo" }));
  await user.type(screen.getByLabelText("Nick do amigo"), "Bia");
  await user.click(screen.getByRole("button", { name: "Buscar" }));
  await user.click(
    await screen.findByRole("button", { name: "Aceitar pedido" }),
  );
  expect(social.act).toHaveBeenCalledWith("reply_friend_request", {
    p_id: "request-1",
    p_accept: true,
  });
});
it("ignora uma busca antiga quando outro nick já foi consultado", async () => {
  setup();
  const user = userEvent.setup();
  let finish!: (value: unknown) => void;
  nicknameRpc
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    )
    .mockResolvedValue({
      id: "bia",
      nickname: "Bia",
      relationship: "none",
      requestId: null,
    });
  await user.click(screen.getByRole("tab", { name: /^Amigos/ }));
  await user.click(screen.getByRole("button", { name: "Adicionar amigo" }));
  await user.type(screen.getByLabelText("Nick do amigo"), "Caio");
  await user.click(screen.getByRole("button", { name: "Buscar" }));
  await user.clear(screen.getByLabelText("Nick do amigo"));
  await user.type(screen.getByLabelText("Nick do amigo"), "Bia");
  await user.click(screen.getByRole("button", { name: "Buscar" }));
  await screen.findByText("@Bia");
  await act(async () =>
    finish({
      id: "caio",
      nickname: "Caio",
      relationship: "none",
      requestId: null,
    }),
  );
  expect(screen.queryByText("@Caio")).not.toBeInTheDocument();
  expect(screen.getByText("@Bia")).toBeInTheDocument();
});

it("alterna as três abas, mantém só a seção selecionada visível e navega pelo teclado", async () => {
  const user = userEvent.setup(),
    onTabChange = vi.fn();
  setup({}, {}, { challenges: <h2>Seus desafios</h2>, onTabChange });
  const tabs = screen.getAllByRole("tab");
  expect(tabs).toHaveLength(3);
  expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByText("Seus desafios")).not.toBeInTheDocument();
  tabs[0].focus();
  await user.keyboard("{ArrowRight}");
  expect(tabs[1]).toHaveFocus();
  expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Amigos");
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  await user.keyboard("{End}");
  expect(tabs[2]).toHaveFocus();
  expect(screen.getByRole("heading", { name: "Seus desafios" })).toBeVisible();
  await user.keyboard("{Home}");
  expect(tabs[0]).toHaveFocus();
  expect(screen.getByText("Seus desafios")).not.toBeVisible();
  await user.keyboard("{ArrowLeft}");
  expect(tabs[2]).toHaveAttribute("aria-selected", "true");
  expect(onTabChange).toHaveBeenLastCalledWith("challenges");
});
it("restaura a última aba fornecida pela navegação e mantém o conteúdo de desafios montado", async () => {
  const user = userEvent.setup();
  setup(
    {},
    {},
    {
      initialTab: "challenges",
      challenges: <input aria-label="Rascunho de desafio" />,
    },
  );
  await user.type(screen.getByLabelText("Rascunho de desafio"), "Meu desafio");
  await user.click(screen.getByRole("tab", { name: "Grupos" }));
  expect(screen.getByLabelText("Rascunho de desafio")).not.toBeVisible();
  await user.click(screen.getByRole("tab", { name: "Desafios" }));
  expect(screen.getByLabelText("Rascunho de desafio")).toHaveValue(
    "Meu desafio",
  );
});
it("destaca a ofensiva em painel e acompanha atualizações sem alterar a pontuação", async () => {
  const user = userEvent.setup(),
    social = setup();
  await user.click(
    screen.getByRole("button", { name: "Detalhes de Treino das 7" }),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    within(screen.getByRole("region", { name: "Ofensiva coletiva" })).getByText(
      "3",
      { exact: true },
    ),
  ).toBeVisible();
  const group = social.state!.groups[0];
  social.state = {
    ...social.state!,
    groups: [{ ...group, completed: true, streak: 4 }],
  };
  social.rerender();
  expect(
    within(screen.getByRole("region", { name: "Ofensiva coletiva" })).getByText(
      "4",
      { exact: true },
    ),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Voltar para equipes" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Detalhes de Treino das 7" }),
    ).toHaveFocus(),
  );
});

it("preserva convites e a ação de encerrar nos detalhes do grupo", async () => {
  const user = userEvent.setup(),
    social = setup();
  social.state!.groups[0].invited = true;
  social.state!.groups[0].status = "pending";
  social.rerender();
  expect(
    screen.getByRole("region", { name: "Convites de grupo" }),
  ).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Detalhes de Treino das 7" }),
  );
  await user.click(screen.getByRole("button", { name: "Entrar no grupo" }));
  expect(social.act).toHaveBeenCalledWith("reply_group_invite", {
    p_id: "group-1",
    p_accept: true,
  });
  await user.click(
    screen.getByRole("button", { name: "Recusar convite para Treino das 7" }),
  );
  expect(social.act).toHaveBeenCalledWith("reply_group_invite", {
    p_id: "group-1",
    p_accept: false,
  });
  social.state!.groups[0].invited = false;
  social.rerender();
  expect(
    screen.queryByText("Sair encerra o grupo para todos."),
  ).not.toBeInTheDocument();
});
it("mostra convites de amizade apenas quando existem e preserva recusa e pedidos enviados", async () => {
  const social = setup({
      requests: [
        { id: "r1", nickname: "Caio", incoming: true },
        { id: "r2", nickname: "Lu", incoming: false },
      ],
    }),
    user = userEvent.setup();
  expect(screen.getByRole("tab", { name: /Amigos/ })).toHaveTextContent("1");
  await user.click(screen.getByRole("tab", { name: /Amigos/ }));
  expect(screen.getByRole("heading", { name: "Seus amigos" })).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Recusar amizade de Caio" }),
  );
  expect(social.act).toHaveBeenCalledWith("reply_friend_request", {
    p_id: "r1",
    p_accept: false,
  });
  await user.click(screen.getByText("Enviados · 1"));
  expect(screen.getByText("Lu")).toBeVisible();
  social.state = { ...social.state!, requests: [] };
  social.rerender();
  expect(screen.queryByLabelText(/pedidos pendentes/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Enviados/)).not.toBeInTheDocument();
});
it("mantém os dados consultáveis quando a sincronização falha e permite tentar novamente", async () => {
  const user = userEvent.setup(),
    social = setup({}, { error: "Não foi possível atualizar a Arena" });
  expect(screen.getByRole("article")).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Não foi possível atualizar",
  );
  await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(social.refresh).toHaveBeenCalledOnce();
});
it("apresenta carregamento e estados vazios compactos sem inventar dados", async () => {
  const social = setup({}, { state: null, busy: true }),
    user = userEvent.setup();
  expect(screen.getByRole("status")).toHaveTextContent("Conectando seu time");
  social.busy = false;
  social.state = { code, groups: [], friends: [], workouts: [], requests: [] };
  social.rerender();
  expect(
    screen.getByRole("heading", { name: "Não quer fazer isso sozinho?" }),
  ).toBeVisible();
  await user.click(screen.getByRole("tab", { name: "Amigos" }));
  expect(
    screen.getByRole("heading", { name: "Quem treina com você?" }),
  ).toBeVisible();
  expect(
    within(screen.getByRole("tablist")).queryByLabelText(/pedidos pendentes/),
  ).not.toBeInTheDocument();
});
it("retorna à lista se o grupo aberto for removido por uma sincronização", async () => {
  const social = setup(),
    user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Detalhes de Treino das 7" }),
  );
  social.state = { ...social.state!, groups: [] };
  social.rerender();
  expect(
    screen.getByRole("heading", { name: "Não quer fazer isso sozinho?" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Sair e encerrar grupo" }),
  ).not.toBeInTheDocument();
});
it("mostra descansos, reagendamento e falta de plano nos detalhes sem alterar a corrida", async () => {
  const social = setup(),
    user = userEvent.setup();
  social.state!.groups[0].members = [
    {
      id: "me",
      nickname: "Dani",
      accepted: true,
      trained: false,
      needsPlan: true,
    },
    {
      id: "bia",
      nickname: "Bia",
      accepted: true,
      trained: false,
      resting: true,
      rescheduledTo: "2026-10-18",
    },
    {
      id: "caio",
      nickname: "Caio",
      accepted: true,
      trained: false,
      resting: true,
    },
  ];
  social.rerender();
  await user.click(
    screen.getByRole("button", { name: "Detalhes de Treino das 7" }),
  );
  expect(screen.getByText("Sem plano")).toBeVisible();
  expect(screen.getByText("Treino reagendado")).toBeVisible();
  expect(screen.getByText("Descanso protegido")).toBeVisible();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});

it("reutiliza o avatar com moldura equipada dos amigos, sem exibir molduras antigas", async () => {
  setup({
    friends: [
      {
        id: "friend-1",
        nickname: "Bia",
        avatar: { ...blankProfile(), nickname: "Bia" },
        frame: "frame-sport-band",
      },
      {
        id: "friend-2",
        nickname: "Dani",
        avatar: { ...blankProfile(), nickname: "Dani" },
        frame: "frame-energy",
      },
    ],
  });
  await userEvent.click(screen.getByRole("tab", { name: "Amigos" }));
  expect(screen.getByRole("img", { name: "Avatar de Bia" })).toHaveAttribute(
    "data-frame",
    "frame-sport-band",
  );
  expect(
    screen.getByRole("img", { name: "Avatar de Dani" }),
  ).not.toHaveAttribute("data-frame");
  expect(document.querySelectorAll(".avatar-frame-art")).toHaveLength(1);
});

it("destaca a equipe com avatares e ofensiva sem repetir a mascote nos cards", () => {
  setup();
  const card = screen.getByRole("article", { name: "Grupo Treino das 7" });
  expect(
    within(card).getByRole("heading", { name: "Treino das 7" }),
  ).toBeVisible();
  expect(within(card).getByLabelText("2 integrantes aceitos")).toBeVisible();
  expect(
    within(card).getByRole("button", { name: "Detalhes de Treino das 7" }),
  ).toHaveTextContent("Abrir equipe");
  expect(card.querySelector(".capibora-mascot")).not.toBeInTheDocument();
});

it("preserva a última equipe consultada em destaque e retorna com foco à lista", async () => {
  const social = setup(),
    user = userEvent.setup(),
    group = social.state!.groups[0];
  social.state = {
    ...social.state!,
    groups: [group, { ...group, id: "other", name: "Outro time", streak: 7 }],
  };
  social.rerender();
  await user.click(
    screen.getByRole("button", { name: "Detalhes de Outro time" }),
  );
  expect(screen.getByRole("heading", { name: "Outro time" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Voltar para equipes" }));
  expect(
    screen.getByRole("article", { name: "Grupo Outro time" }),
  ).toBeVisible();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Detalhes de Outro time" }),
    ).toHaveFocus(),
  );
});

it("convites pendentes não escondem a chamada para criar grupo nem exibem Seus grupos", () => {
  const social = setup();
  social.state!.groups[0].invited = true;
  social.rerender();
  expect(screen.getByRole("button", { name: "Criar grupo" })).toBeVisible();
  expect(
    screen
      .getByRole("region", { name: "Treine em companhia" })
      .querySelector("img"),
  ).toHaveAttribute(
    "src",
    `${import.meta.env.BASE_URL}mascot/web/capi-sosa.webp`,
  );
  expect(
    screen.queryByRole("heading", { name: "Seus grupos" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /^Convites/ })).toBeVisible();
});

it("preserva descanso protegido, reagendamento, falta de plano e convite nos detalhes compactos", async () => {
  const social = setup();
  social.state!.groups[0].members = [
    { id: "r", nickname: "Bia", accepted: true, trained: false, resting: true },
    {
      id: "s",
      nickname: "Caio",
      accepted: true,
      trained: false,
      resting: true,
      rescheduledTo: "2026-10-20",
    },
    {
      id: "p",
      nickname: "Lu",
      accepted: true,
      trained: false,
      needsPlan: true,
    },
    { id: "i", nickname: "Ana", accepted: false, trained: false },
  ];
  social.rerender();
  await userEvent.click(
    screen.getByRole("button", { name: "Detalhes de Treino das 7" }),
  );
  const members = within(
    screen.getByRole("region", { name: "Integrantes do grupo" }),
  );
  for (const message of [
    "Descanso protegido",
    "Treino reagendado",
    "Sem plano",
    "Convidado",
  ])
    expect(members.getByText(message)).toBeVisible();
  expect(screen.getByText(/4\/5 vagas/)).toBeVisible();
  expect(screen.queryByText(/falhou|perdeu/)).not.toBeInTheDocument();
});

it.each(["feminine", "masculine", "neutral", undefined])(
  "adapta o convite sem grupo ao tratamento %s",
  (treatment) => {
    setup(
      { groups: [] },
      {},
      {
        account: {
          ...account,
          phrasePreferences: { displayName: "Dani", treatment },
        } as Account,
      },
    );
    expect(
      screen.getByRole("heading", {
        name: `Não quer fazer isso ${treatment === "feminine" ? "sozinha" : "sozinho"}?`,
      }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Crie seu grupo ou entre em um grupo com seus amigos. É muito mais fácil treinar com companhia...",
      ),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Criar grupo" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Seus grupos" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  },
);

it("convida e sai pelas confirmações existentes mantendo o painel ao cancelar", async () => {
  const user = userEvent.setup(),
    social = setup({ friends: [{ id: "new", nickname: "Caio" }] });
  await user.click(
    screen.getByRole("button", { name: "Detalhes de Treino das 7" }),
  );
  await user.click(screen.getByText("Gerenciar grupo"));
  await user.click(screen.getByRole("button", { name: "Convidar amigo" }));
  const invite = screen.getByRole("dialog", { name: "Convidar amigo" });
  await user.selectOptions(within(invite).getByLabelText("Amigo"), "new");
  await user.click(within(invite).getByRole("button", { name: "Confirmar" }));
  expect(social.act).toHaveBeenLastCalledWith(
    "arena_group_command",
    expect.objectContaining({
      p_id: "group-1",
      p_action: "invite",
      p_target: "new",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Sair do grupo" }));
  let leave = screen.getByRole("dialog", { name: "Sair do grupo" });
  await user.click(within(leave).getByRole("button", { name: "Cancelar" }));
  expect(
    screen.getByRole("region", { name: "Equipe Treino das 7" }),
  ).toBeVisible();
  expect(social.act).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Sair do grupo" }));
  leave = screen.getByRole("dialog", { name: "Sair do grupo" });
  await user.click(within(leave).getByRole("button", { name: "Confirmar" }));
  expect(social.act).toHaveBeenLastCalledWith(
    "arena_group_command",
    expect.objectContaining({ p_action: "leave" }),
  );
  social.state = { ...social.state!, groups: [] };
  social.rerender();
  expect(
    screen.getByRole("region", { name: "Treine em companhia" }),
  ).toBeVisible();
});

it("utiliza o avatar real do amigo mesmo sem moldura e mantém suas ações compactas", async () => {
  setup(
    {
      friends: [
        {
          id: "bia",
          nickname: "Bia",
          avatar: { ...blankProfile(), nickname: "Bia" },
        },
      ],
    },
    {},
    {},
  );
  await userEvent.click(screen.getByRole("tab", { name: "Amigos" }));
  expect(screen.getByRole("img", { name: "Avatar de Bia" })).toBeVisible();
  expect(screen.getByText("1 amigo")).toBeVisible();

  expect(
    screen.getByRole("button", { name: "Ver perfil de Bia" }),
  ).toBeVisible();
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
});

it("abre ficha do rival com Voltar e preserva a aba e o foco no amigo", async () => {
  nicknameRpc.mockResolvedValueOnce({
    nickname: "Bia",
    displayName: "Beatriz",
    badges: [],
    streak: { current: 3, best: 8 },
  });
  setup({}, {}, { initialTab: "friends" });
  await userEvent.click(
    screen.getByRole("button", { name: "Ver perfil de Bia" }),
  );
  const panel = screen.getByRole("region", { name: "Ficha de Bia" });
  expect(await within(panel).findByText("Beatriz")).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await userEvent.click(
    within(panel).getByRole("button", { name: "Voltar para amigos" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Ver perfil de Bia" }),
    ).toHaveFocus(),
  );
  expect(screen.getByRole("tab", { name: "Amigos" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

it("retira o perfil privado se o amigo não estiver mais na lista sincronizada", async () => {
  nicknameRpc.mockResolvedValueOnce({ nickname: "Bia", badges: [] });
  const social = setup({}, {}, { initialTab: "friends" });
  await userEvent.click(
    screen.getByRole("button", { name: "Ver perfil de Bia" }),
  );
  await screen.findByText("Nenhuma medalha compartilhada");
  social.state!.friends = [];
  social.rerender();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("acompanha a aba restaurada pelo histórico sem apagar o formulário aberto pela própria Arena", async () => {
  const user = userEvent.setup();
  const props: Partial<ComponentProps<typeof SocialPanel>> = {
    initialTab: "groups",
    onTabChange: vi.fn(),
  };
  const social = setup({}, {}, props);
  props.initialTab = "friends";
  social.rerender();
  expect(screen.getByRole("tab", { name: "Amigos" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await user.click(screen.getByRole("button", { name: /Adicionar amigo/ }));
  props.initialTab = "friends";
  social.rerender();
  expect(screen.getByLabelText(/Nick do amigo/)).toBeVisible();
  props.initialTab = "challenges";
  social.rerender();
  expect(screen.getByRole("tab", { name: "Desafios" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.queryByLabelText(/Nick do amigo/)).not.toBeInTheDocument();
});

it("mantém grupos em cache visíveis se a atualização do perfil falhar offline", () => {
  setup(
    {},
    { error: "Sem conexão. As informações salvas podem estar desatualizadas" },
    {
      account: {
        ...account,
        profileError: "Não foi possível verificar seu perfil",
      },
    },
  );
  expect(
    screen.getByRole("article", { name: "Grupo Treino das 7" }),
  ).toBeVisible();
  expect(
    screen.getByText(/As informações salvas podem estar desatualizadas/),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Detalhes de Treino das 7" }),
  ).toBeEnabled();
});

it("mostra a foto recebida do amigo sem exigir moldura", async () => {
  const photo = "data:image/png;base64,YQ==";
  setup(
    {
      friends: [
        {
          id: "photo-friend",
          nickname: "Bia",
          avatar: { ...blankProfile(), nickname: "Bia", photo },
        },
      ],
    },
    {},
    { initialTab: "friends" },
  );
  expect(screen.getByRole("img", { name: "Avatar de Bia" })).toHaveAttribute(
    "src",
    photo,
  );
  expect(document.querySelector(".avatar-frame-art")).toBeNull();
});

it.each([5, 8])(
  "preserva %s integrantes e não mostra novas vagas quando o grupo está cheio",
  async (total) => {
    const social = setup();
    social.state!.groups[0].members = Array.from({ length: total }, (_, i) => ({
      id: `p${i}`,
      nickname: `Pessoa${i}`,
      accepted: i < 3,
      trained: false,
    }));
    social.rerender();
    await userEvent.click(
      screen.getByRole("button", { name: "Detalhes de Treino das 7" }),
    );
    const members = screen.getByRole("region", {
      name: "Integrantes do grupo",
    });
    expect(within(members).getAllByRole("listitem")).toHaveLength(total);
    expect(
      within(members).queryByRole("button", { name: /Convidar para a vaga/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${total}/5 vagas`))).toBeVisible();
  },
);

it("a ficha oferece desafio rápido e provocação sem criar operações antecipadamente", async () => {
  nicknameRpc.mockResolvedValueOnce({ nickname: "Bia", badges: [] });
  const onChallenge = vi.fn(),
    social = setup({}, {}, { initialTab: "friends", onChallenge });
  await userEvent.click(
    screen.getByRole("button", { name: "Ver perfil de Bia" }),
  );
  await screen.findByText("Nenhuma medalha compartilhada");
  const rival = screen.getByRole("region", { name: "Ficha de Bia" });
  await userEvent.click(
    within(rival).getByRole("button", { name: "Provocar" }),
  );
  expect(social.act).not.toHaveBeenCalled();
  expect(
    screen.getByRole("group", { name: "Escolher provocação" }),
  ).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Fechar janela" }));
  await userEvent.click(
    within(rival).getByRole("button", { name: "Desafiar" }),
  );
  expect(onChallenge).toHaveBeenCalledWith("friend-1");
  expect(screen.getByRole("tab", { name: "Desafios" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(social.act).not.toHaveBeenCalled();
});
it("contadores de convites usam os dados disponíveis das três abas", () => {
  const social = setup(
    { requests: [{ id: "request", nickname: "Caio", incoming: true }] },
    {},
    { challengeInvites: 2 },
  );
  social.state!.groups[0].invited = true;
  social.rerender();
  expect(
    within(screen.getByRole("tab", { name: /Grupos/ })).getByLabelText(
      "1 convites pendentes",
    ),
  ).toBeVisible();
  expect(
    within(screen.getByRole("tab", { name: /Amigos/ })).getByLabelText(
      "1 pedidos pendentes",
    ),
  ).toBeVisible();
  expect(
    within(screen.getByRole("tab", { name: /Desafios/ })).getByLabelText(
      "2 convites pendentes",
    ),
  ).toBeVisible();
});

it("restaura o detalhe solicitado por URL quando a lista em cache ainda não tinha a equipe", () => {
  const social = setup({}, {}, { initialGroupId: "group-1" });
  const groups = social.state!.groups;
  social.state = { ...social.state!, groups: [] };
  social.rerender();
  expect(
    screen.queryByRole("region", { name: "Equipe Treino das 7" }),
  ).not.toBeInTheDocument();
  social.state = { ...social.state!, groups };
  social.rerender();
  expect(
    screen.getByRole("region", { name: "Equipe Treino das 7" }),
  ).toBeVisible();
  expect(social.refresh).not.toHaveBeenCalled();
});
