import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
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
function setup() {
  const onChanged = vi.fn();
  const element = () => (
    <ChallengesPanel
      userId="me"
      friends={[{ id: "bia", nickname: "Bia" }]}
      onChanged={onChanged}
    />
  );
  const result = render(element());
  return { onChanged, rerender: () => result.rerender(element()) };
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
  expect(screen.getByText(/Até 25 de out/)).toHaveTextContent(
    "2 participantes",
  );
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
