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
  return { onChanged, container: result.container, rerender: () => result.rerender(element()) };
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
  await user.click(screen.getByRole("button", { name: "Encerrados" }));
  expect(screen.getByText("Mês passado")).toBeVisible();
  expect(screen.queryByText("Semana em dupla")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Encerrados" })).toHaveAttribute(
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
    within(screen.getByLabelText("Detalhes de Semana em dupla")).getByText(
      "100%",
    ),
  ).toBeVisible();
  await user.click(screen.getByLabelText("Detalhes de Semana em dupla"));
  const board = screen.getByRole("list");
  expect(within(board).getAllByText(/🏅/)).toHaveLength(2);
  expect(within(board).getByText(/@Dani/)).toBeVisible();
  expect(within(board).getByText(/@Bia/)).toBeVisible();
});
it("mantém aceitação e recusa de convites no detalhe sem mudar os argumentos", async () => {
  resource.state = [challenge({ invited: true, recordingPolicy: "timed" })];
  const user = userEvent.setup(),
    { onChanged } = setup();
  expect(screen.getByText("Convite", { exact: true })).toBeVisible();
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
  await user.click(screen.getByRole("button", { name: "Encerrados" }));
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

it("separa convites e prioriza os desafios aceitos sem misturar resultados antigos", () => {
  resource.state = [
    challenge({ id: "invite", name: "Convite novo", invited: true }),
    challenge(),
    challenge({ id: "old", name: "Antigo", closed: true }),
  ];
  setup();
  const active = screen.getByRole("region", { name: "Em andamento" }),
    invitations = screen.getByRole("region", { name: "Convites" });
  expect(
    active.compareDocumentPosition(invitations) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(within(active).getByText("Semana em dupla")).toBeVisible();
  expect(within(invitations).getByText("Convite novo")).toBeVisible();
  expect(screen.queryByText("Antigo")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Novo desafio" }),
  ).toHaveTextContent("Criar");
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
