import { render, screen, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { Account } from "./account";
import { blankProfile } from "./profile";
import SocialPanel from "./SocialPanel";
import type { SocialState, useSocial } from "./social";

const nicknameRpc = vi.hoisted(() => vi.fn());
vi.mock("./backend", () => ({ backendRpc: nicknameRpc }));

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
  expect(screen.getByText("Treinos pendentes")).toBeVisible();
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
  expect(screen.getByText("Descanso do grupo")).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "Detalhes de Time em pausa" }),
  );
  expect(
    screen.getByRole("heading", { name: "Descanso coletivo" }),
  ).toBeVisible();
  expect(
    screen.getByText(
      "Todos estão descansando hoje. A ofensiva permanece protegida.",
    ),
  ).toBeVisible();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(screen.queryByText(/a confirmar o treino/)).not.toBeInTheDocument();
  expect(screen.getAllByText("Descanso", { exact: true })).toHaveLength(2);
  expect(screen.queryByText("Falta treinar")).not.toBeInTheDocument();
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
  await user.click(screen.getByRole("button", { name: "Meu código" }));
  expect(screen.getByLabelText("Seu código de amigo")).toHaveValue(code);
  await user.click(
    screen.getByRole("button", { name: "Voltar para amigos e grupos" }),
  );
  await user.click(screen.getByRole("button", { name: "Adicionar amigo" }));
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
  await user.click(screen.getByRole("button", { name: "Criar grupo com Bia" }));
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
it("abre os detalhes com corrida e progresso, acompanha atualizações e volta ao resumo", async () => {
  const user = userEvent.setup(),
    social = setup();
  await user.click(
    screen.getByRole("button", { name: "Detalhes de Treino das 7" }),
  );
  expect(
    screen.getByRole("heading", { name: "Corrida em andamento" }),
  ).toBeVisible();
  expect(screen.getByText("1 concluiu · 1 pendente")).toBeVisible();
  expect(
    screen.getByRole("progressbar", { name: /Treinos de hoje/ }),
  ).toHaveAttribute("aria-valuenow", "1");
  expect(screen.getByText("Recorde 8")).toBeVisible();
  const group = social.state!.groups[0];
  social.state = {
    ...social.state!,
    groups: [
      {
        ...group,
        completed: true,
        streak: 4,
        members: group.members.map((m) => ({
          ...m,
          trained: true,
          confirmedAt: "2026-10-16T12:00:00.123456Z",
        })),
      },
    ],
  };
  social.rerender();
  expect(screen.getByRole("heading", { name: "Dia concluído" })).toBeVisible();
  expect(screen.getAllByLabelText("1º a confirmar o treino")).toHaveLength(2);
  expect(screen.getByRole("article").querySelectorAll("time")).toHaveLength(2);
  await user.click(
    screen.getByRole("button", { name: "Voltar para seus grupos" }),
  );
  expect(screen.getByText("Todos concluíram")).toBeVisible();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});
it("preserva convites e a ação de encerrar nos detalhes do grupo", async () => {
  const user = userEvent.setup(),
    social = setup();
  social.state!.groups[0].invited = true;
  social.state!.groups[0].status = "pending";
  social.rerender();
  expect(screen.getByText("Convite para o grupo")).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Detalhes de Treino das 7" }),
  );
  expect(
    screen.getByRole("heading", { name: "Participantes e convites" }),
  ).toBeVisible();
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
  await user.click(screen.getByText("Regras e ações do grupo"));
  expect(screen.getByText("Sair encerra o grupo para todos.")).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Sair e encerrar grupo" }),
  );
  expect(social.act).toHaveBeenCalledWith("close_streak_group", {
    p_id: "group-1",
  });
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
  expect(screen.getByRole("heading", { name: "Seus amigos 1" })).toBeVisible();
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
    screen.getByRole("heading", { name: "Nenhum grupo ainda" }),
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
  expect(screen.getByRole("heading", { name: "Seus grupos" })).toBeVisible();
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
  expect(screen.getByText("Transferido")).toBeVisible();
  expect(screen.getByTitle("Treino transferido para 2026-10-18")).toBeVisible();
  expect(screen.getByText("Descanso", { exact: true })).toBeVisible();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
});
