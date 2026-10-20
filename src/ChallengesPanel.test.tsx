import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { blankProfile } from "./profile";
import type { Challenge } from "./gamification";
import ChallengesPanel from "./ChallengesPanel";

const resource = vi.hoisted(() => ({
  state: null as Challenge[] | null,
  busy: false,
  error: "",
  refresh: vi.fn(),
  act: vi.fn(),
}));
vi.mock("./useGamification", () => ({ useGameResource: () => resource }));
const challenge = (extra: Partial<Challenge> = {}): Challenge => ({
  id: "duo",
  name: "Semana em dupla",
  kind: "collective",
  start: "2026-10-19",
  end: "2026-10-25",
  inviteUntil: "2099-10-19T00:00:00Z",
  target: 10,
  closed: false,
  cancelled: false,
  invited: false,
  participants: [
    { id: "me", nickname: "Dani", accepted: true },
    { id: "bia", nickname: "Bia", accepted: true },
  ],
  board: [
    {
      id: "me",
      nickname: "Dani",
      completed: 2,
      planned: 3,
      percent: 66.67,
      place: 1,
    },
    {
      id: "bia",
      nickname: "Bia",
      completed: 1,
      planned: 3,
      percent: 33.33,
      place: 2,
    },
  ],
  ...extra,
});
function setup(props: Partial<ComponentProps<typeof ChallengesPanel>> = {}) {
  const onChanged = vi.fn();
  const element = () => (
    <ChallengesPanel
      userId="me"
      friends={[{ id: "bia", nickname: "Bia" }]}
      onChanged={onChanged}
      {...props}
    />
  );
  const result = render(element());
  return {
    onChanged,
    container: result.container,
    rerender: () => result.rerender(element()),
  };
}
beforeEach(() => {
  resource.state = [
    challenge(),
    challenge({ id: "old", name: "Mês passado", closed: true }),
  ];
  resource.error = "";
  resource.busy = false;
  resource.act.mockReset().mockResolvedValue(true);
  resource.refresh.mockReset();
});
it("prioriza desafios ativos em resumos e separa o histórico com filtros compactos", async () => {
  const user = userEvent.setup();
  setup();
  expect(screen.getByRole("heading", { name: "Seus desafios" })).toBeVisible();
  expect(screen.getByLabelText("Detalhes de Semana em dupla")).toBeVisible();
  expect(screen.queryByText("Mês passado")).not.toBeInTheDocument();
  expect(
    screen.getByRole("progressbar", { name: "Meta de Semana em dupla" }),
  ).toHaveAttribute("value", "3");
  expect(screen.getByText(/Até 25 de out/)).toBeVisible();
  expect(screen.getByTitle("2 participantes")).toBeVisible();
  expect(screen.getByRole("list")).not.toBeVisible();
  await user.click(screen.getByRole("button", { name: "Histórico" }));
  expect(screen.getByText("Mês passado")).toBeVisible();
  expect(screen.queryByText("Semana em dupla")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Histórico" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
it("expande resultados e empates existentes somente ao consultar os detalhes", async () => {
  resource.state = [
    challenge({
      kind: "consistency",
      board: challenge().board.map((p) => ({ ...p, percent: 100, place: 1 })),
    }),
  ];
  const user = userEvent.setup();
  setup();
  expect(
    within(screen.getByLabelText("Detalhes de Semana em dupla")).getAllByText(
      "100%",
    )[0],
  ).toBeVisible();
  if (resource.state?.some((c) => c.invited))
    await user.click(screen.getByRole("button", { name: /^Convites/ }));
  await user.click(screen.getByLabelText("Detalhes de Semana em dupla"));
  const board = screen.getByRole("list");
  expect(within(board).getAllByLabelText("Primeiro lugar")).toHaveLength(2);
  expect(within(board).getByText(/@Dani/)).toBeVisible();
  expect(within(board).getByText(/@Bia/)).toBeVisible();
});
it("mantém aceitação e recusa de convites no detalhe sem mudar os argumentos", async () => {
  resource.state = [challenge({ invited: true, recordingPolicy: "timed" })];
  const user = userEvent.setup(),
    { onChanged } = setup();
  await user.click(screen.getByRole("button", { name: /^Convites/ }));
  expect(screen.getByText("Convite", { exact: true })).toBeVisible();
  if (resource.state?.some((c) => c.invited))
    await user.click(screen.getByRole("button", { name: /^Convites/ }));
  await user.click(screen.getByLabelText("Detalhes de Semana em dupla"));
  expect(screen.getByText("Somente treinos cronometrados")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Aceitar" }));
  expect(resource.act).toHaveBeenCalledWith("reply_challenge_invite", {
    p_id: "duo",
    p_accept: true,
    p_timezone: expect.any(String),
  });
  expect(onChanged).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button", { name: "Recusar" }));
  expect(resource.act).toHaveBeenCalledWith("reply_challenge_invite", {
    p_id: "duo",
    p_accept: false,
    p_timezone: expect.any(String),
  });
});
it("mantém convite vencido desabilitado e ações indisponíveis durante a operação", async () => {
  resource.state = [
    challenge({ invited: true, inviteUntil: "2020-01-01T00:00:00Z" }),
  ];
  const user = userEvent.setup(),
    view = setup();
  if (resource.state?.some((c) => c.invited))
    await user.click(screen.getByRole("button", { name: /^Convites/ }));
  await user.click(screen.getByLabelText("Detalhes de Semana em dupla"));
  expect(screen.getByRole("button", { name: "Aceitar" })).toBeDisabled();
  resource.busy = true;
  view.rerender();
  expect(screen.getByRole("button", { name: "Recusar" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Novo desafio" })).toBeDisabled();
});
it("preserva o formulário e participantes quando a criação falha", async () => {
  resource.act.mockResolvedValue(false);
  const user = userEvent.setup();
  setup();
  await user.click(screen.getByRole("button", { name: "Novo desafio" }));
  await user.type(screen.getByLabelText("Nome do desafio"), "Nosso desafio");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByLabelText("@Bia"));
  await user.click(screen.getByRole("button", { name: "Enviar convites" }));
  expect(screen.getByLabelText("Nome do desafio")).toHaveValue("Nosso desafio");
  expect(screen.getByLabelText("@Bia")).toBeChecked();
});
it("mostra estados vazios, carregamento e falha com nova tentativa sem esconder dados válidos", async () => {
  resource.state = null;
  resource.busy = true;
  const user = userEvent.setup(),
    view = setup();
  expect(screen.getByRole("status")).toHaveTextContent("Buscando desafios");
  expect(screen.queryByText("Nenhum desafio ativo")).not.toBeInTheDocument();
  resource.busy = false;
  resource.state = [];
  view.rerender();
  expect(
    screen.getByRole("heading", { name: "Nenhum desafio ativo" }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Histórico" }));
  expect(
    screen.getByRole("heading", { name: "Nenhum desafio encerrado" }),
  ).toBeVisible();
  resource.state = [challenge({ closed: true })];
  resource.error = "Não foi possível atualizar os desafios";
  view.rerender();
  expect(screen.getByText("Semana em dupla")).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent(resource.error);
  await user.click(screen.getByRole("button", { name: "Atualizar" }));
  expect(resource.refresh).toHaveBeenCalledOnce();
});

it("separa Ativos, Convites e Histórico sem misturar resultados antigos", async () => {
  resource.state = [
    challenge({ id: "invite", name: "Convite novo", invited: true }),
    challenge(),
    challenge({ id: "old", name: "Antigo", closed: true }),
  ];
  setup();
  expect(
    screen.getByRole("region", { name: "Em andamento" }),
  ).toHaveTextContent("Semana em dupla");
  expect(screen.queryByText("Convite novo")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /^Convites/ }));
  expect(screen.getByRole("region", { name: "Convites" })).toHaveTextContent(
    "Convite novo",
  );
  expect(screen.queryByText("Antigo")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Histórico" }));
  expect(screen.getByText("Antigo")).toBeVisible();
});

it("usa o percentual de consistência confirmado pelo servidor e não inventa meta de frequência", () => {
  resource.state = [
    challenge({ kind: "consistency" }),
    challenge({ id: "frequency", name: "Frequência real", kind: "frequency" }),
  ];
  setup();
  expect(
    screen.getByRole("progressbar", {
      name: "Cumprimento do plano em Semana em dupla",
    }),
  ).toHaveAttribute("value", "66.67");
  expect(screen.getByRole("progressbar")).toHaveAttribute("max", "100");
  expect(
    within(screen.getByLabelText("Detalhes de Frequência real")).getByText(
      "Frequência",
    ),
  ).toBeVisible();
  expect(screen.getAllByRole("progressbar")).toHaveLength(1);
});

it("omissões no resultado não viram porcentagens ou barras fictícias", () => {
  resource.state = [
    challenge({
      kind: "consistency",
      board: challenge().board.map((p) => ({ ...p, percent: null })),
    }),
  ];
  setup();
  expect(screen.getByText("Sem resultado ainda")).toBeVisible();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Convites" }),
  ).not.toBeInTheDocument();
});

it("reaproveita fotos e molduras conhecidas dos participantes sem buscar dados adicionais", () => {
  resource.state = [challenge()];
  const { container } = setup({
    currentProfile: { ...blankProfile(), nickname: "Dani" },
    friends: [
      {
        id: "bia",
        nickname: "Bia",
        avatar: { ...blankProfile(), nickname: "Bia" },
        frame: "frame-sport-band",
      },
    ],
  });
  const participants = container.querySelector(".challenge-participants")!;
  expect(participants.querySelectorAll(".profile-avatar")).toHaveLength(2);
  expect(participants.querySelectorAll(".avatar-frame-art")).toHaveLength(1);
  expect(screen.getByTitle("2 participantes")).toBeVisible();
});

it("continua criando o mesmo desafio com os argumentos e sincronização existentes", async () => {
  resource.state = [challenge()];
  const user = userEvent.setup(),
    { onChanged } = setup();
  await user.click(screen.getByRole("button", { name: "Novo desafio" }));
  await user.type(screen.getByLabelText("Nome do desafio"), "Nosso desafio");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByLabelText("@Bia"));
  await user.click(screen.getByRole("button", { name: "Enviar convites" }));
  expect(resource.act).toHaveBeenCalledWith("create_friend_challenge", {
    p_name: "Nosso desafio",
    p_kind: "consistency",
    p_duration: 7,
    p_friends: ["bia"],
    p_target: null,
    p_timezone: expect.any(String),
  });
  expect(onChanged).toHaveBeenCalledOnce();
});
it("cria desafios novos de 7, 14 ou 28 dias sem usar o endpoint legado", async () => {
  const user = userEvent.setup();
  setup({ arenaVersion: 2 });
  await user.click(screen.getByRole("button", { name: "Novo desafio" }));
  expect(
    screen.queryByRole("option", { name: "30 dias" }),
  ).not.toBeInTheDocument();
  await user.type(screen.getByLabelText("Nome do desafio"), "Dupla nova");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.selectOptions(screen.getByLabelText("Duração"), "14");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByLabelText("@Bia"));
  await user.click(screen.getByRole("button", { name: "Enviar convites" }));
  expect(resource.act).toHaveBeenCalledWith(
    "create_arena_challenge",
    expect.objectContaining({
      p_duration: 14,
      p_friends: ["bia"],
      p_recording_policy: "any",
      p_request: expect.any(String),
      p_rematch: null,
    }),
  );
});
it("atalho de amigo pré-seleciona sem enviar convite antes da confirmação", async () => {
  const onQuickHandled = vi.fn();
  setup({
    arenaVersion: 2,
    initialFriend: "bia",
    onQuickHandled,
    friends: [
      { id: "bia", nickname: "Bia" },
      { id: "caio", nickname: "Caio" },
    ],
  });
  expect(screen.getByLabelText("@Bia")).toBeChecked();
  expect(screen.getByLabelText("@Bia")).toBeDisabled();
  expect(screen.queryByLabelText("@Caio")).not.toBeInTheDocument();
  expect(
    screen.getByRole("form", { name: "Configurar desafio" }),
  ).toHaveFocus();
  expect(screen.getByLabelText("Nome do desafio")).toHaveValue(
    "Desafio em dupla",
  );
  expect(resource.act).not.toHaveBeenCalled();
  expect(onQuickHandled).toHaveBeenCalled();
});
it("revanche de 30 dias é revisada como 28 dias sem alterar resultado anterior", async () => {
  resource.state = [
    challenge({ closed: true, start: "2026-09-01", end: "2026-09-30" }),
  ];
  const user = userEvent.setup();
  setup({ arenaVersion: 2 });
  await user.click(screen.getByRole("button", { name: "Histórico" }));
  if (resource.state?.some((c) => c.invited))
    await user.click(screen.getByRole("button", { name: /^Convites/ }));
  await user.click(screen.getByLabelText("Detalhes de Semana em dupla"));
  await user.click(screen.getByRole("button", { name: "Pedir revanche" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  expect(screen.getByLabelText("Duração")).toHaveValue("28");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  expect(
    screen.getByText(/duração anterior de 30 dias adaptada/),
  ).toBeVisible();
  expect(resource.act).not.toHaveBeenCalled();
});
it("usa o estado do servidor para liberar aceite da versão 2", async () => {
  resource.state = [
    challenge({
      invited: true,
      ruleVersion: 2,
      state: "scheduled",
      inviteUntil: "2000-01-01T00:00:00Z",
    }),
  ];
  const user = userEvent.setup();
  setup({ arenaVersion: 2 });
  if (resource.state?.some((c) => c.invited))
    await user.click(screen.getByRole("button", { name: /^Convites/ }));
  await user.click(screen.getByLabelText("Detalhes de Semana em dupla"));
  expect(screen.getByRole("button", { name: "Aceitar" })).toBeEnabled();
});

it("o fluxo em etapas mantém regras e seleção ao voltar, sem enviar antes da revisão", async () => {
  const user = userEvent.setup();
  setup({ arenaVersion: 2 });
  await user.click(screen.getByRole("button", { name: "Novo desafio" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  expect(screen.getByText("Escolha sua disputa")).toBeVisible();
  expect(resource.act).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText("Nome do desafio"), "Missão do time");
  await user.click(screen.getByRole("radio", { name: /Coletivo/ }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.selectOptions(screen.getByLabelText("Duração"), "14");
  await user.clear(screen.getByLabelText("Meta conjunta"));
  await user.type(screen.getByLabelText("Meta conjunta"), "12");
  await user.selectOptions(screen.getByLabelText("Métodos aceitos"), "timed");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByLabelText("@Bia"));
  expect(resource.act).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Voltar" }));
  expect(screen.getByLabelText("Duração")).toHaveValue("14");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  expect(screen.getByLabelText("@Bia")).toBeChecked();
  await user.click(screen.getByRole("button", { name: "Enviar convites" }));
  expect(resource.act).toHaveBeenCalledExactlyOnceWith(
    "create_arena_challenge",
    expect.objectContaining({
      p_kind: "collective",
      p_duration: 14,
      p_target: 12,
      p_friends: ["bia"],
      p_recording_policy: "timed",
      p_rematch: null,
      p_request: expect.any(String),
    }),
  );
});
it("revanche preserva o id anterior no convite novo e reenvio mantém a chave idempotente", async () => {
  resource.act.mockResolvedValue(false);
  resource.state = [
    challenge({
      kind: "frequency",
      closed: true,
      ruleVersion: 2,
      start: "2026-10-01",
      end: "2026-10-14",
      recordingPolicy: "timed",
    }),
  ];
  const user = userEvent.setup();
  setup({ arenaVersion: 2 });
  await user.click(screen.getByRole("button", { name: "Histórico" }));
  await user.click(screen.getByLabelText("Detalhes de Semana em dupla"));
  await user.click(screen.getByRole("button", { name: "Pedir revanche" }));
  expect(resource.act).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Enviar convites" }));
  expect(resource.act).toHaveBeenLastCalledWith(
    "create_arena_challenge",
    expect.objectContaining({
      p_rematch: "duo",
      p_duration: 14,
      p_kind: "frequency",
      p_recording_policy: "timed",
      p_friends: ["bia"],
    }),
  );
  const request = resource.act.mock.calls[0][1].p_request;
  await user.click(screen.getByRole("button", { name: "Enviar convites" }));
  expect(resource.act.mock.calls[1][1].p_request).toBe(request);
});
it("cancelamentos no histórico não apresentam classificação de vencedor", async () => {
  resource.state = [challenge({ closed: true, cancelled: true })];
  setup();
  await userEvent.click(screen.getByRole("button", { name: "Histórico" }));
  await userEvent.click(screen.getByLabelText("Detalhes de Semana em dupla"));
  expect(screen.getByText("Desafio cancelado")).toBeVisible();
  expect(screen.queryByLabelText("Primeiro lugar")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Pedir revanche" }),
  ).not.toBeInTheDocument();
});

it("chegar à revisão do desafio rápido não envia e usa um controle de confirmação distinto", async () => {
  const user = userEvent.setup();
  setup({ arenaVersion: 2, initialFriend: "bia" });
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  const advance = screen.getByRole("button", { name: "Continuar" });
  expect(advance).toHaveAttribute("type", "button");
  await user.click(advance);
  const confirm = screen.getByRole("button", { name: "Enviar convites" });
  expect(confirm).not.toBe(advance);
  expect(confirm).toHaveAttribute("type", "submit");
  expect(resource.act).not.toHaveBeenCalled();
  await user.click(confirm);
  expect(resource.act).toHaveBeenCalledExactlyOnceWith(
    "create_arena_challenge",
    expect.objectContaining({ p_friends: ["bia"] }),
  );
});
