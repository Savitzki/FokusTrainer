import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import ArenaChallengePreview from "./ArenaChallengePreview";
import ChallengeResult from "./ChallengeResult";
import type { Challenge } from "./gamification";
const c: Challenge = {
  id: "c",
  name: "Disputa",
  kind: "consistency",
  start: "2026-10-20",
  end: "2026-10-26",
  inviteUntil: "2026-10-19T23:59:00Z",
  closed: false,
  cancelled: false,
  invited: false,
  target: 10,
  participants: [
    { id: "a", nickname: "Dani", accepted: true },
    { id: "b", nickname: "Bia", accepted: true },
  ],
  board: [
    {
      id: "a",
      nickname: "Dani",
      completed: 2,
      planned: 4,
      percent: 50,
      place: 1,
    },
    {
      id: "b",
      nickname: "Bia",
      completed: 1,
      planned: 3,
      percent: 33.3,
      place: 2,
    },
  ],
};
it("o duelo usa pontuações e percentuais do servidor sem declarar vitória antecipada", () => {
  const { container } = render(
    <ArenaChallengePreview challenge={c} userId="a" />,
  );
  expect(screen.getByText("VS")).toBeVisible();
  expect(screen.getByText("33,3%")).toBeVisible();
  expect(screen.getByRole("progressbar")).toHaveAttribute("value", "50");
  expect(screen.queryByText(/Vitória/)).not.toBeInTheDocument();
  expect(container.querySelectorAll(".arena-versus-side")).toHaveLength(2);
});
it("cooperativos apresentam missão compartilhada e não usam VS", () => {
  render(
    <ArenaChallengePreview
      challenge={{ ...c, kind: "collective" }}
      userId="a"
    />,
  );
  expect(screen.queryByText("VS")).not.toBeInTheDocument();
  expect(screen.getByText("3/10 treinos")).toBeVisible();
  expect(screen.getByText("7 treinos restantes")).toBeVisible();
  expect(screen.getByRole("progressbar")).toHaveAttribute("max", "10");
});
it("competição com mais pessoas mantém classificação, sem forçar duelo", () => {
  render(
    <ArenaChallengePreview
      challenge={{
        ...c,
        kind: "frequency",
        participants: [
          ...c.participants,
          { id: "d", nickname: "Caio", accepted: true },
        ],
      }}
      userId="a"
    />,
  );
  expect(screen.queryByText("VS")).not.toBeInTheDocument();
  expect(screen.getByLabelText("3 participantes")).toBeVisible();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});
it("cancelamento não celebra, não compartilha e não declara vencedor", () => {
  const { container } = render(
    <ChallengeResult challenge={{ ...c, closed: true, cancelled: true }} />,
  );
  expect(screen.getByText("Desafio cancelado")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Compartilhar" }),
  ).not.toBeInTheDocument();
  expect(container.querySelector(".has-victory")).toBeNull();
  expect(container.querySelector(".capibora-mascot")).toBeNull();
});
it("empate consolidado é explícito e preserva os pontos de cada participante", () => {
  render(
    <ChallengeResult
      challenge={{
        ...c,
        closed: true,
        board: c.board.map((p) => ({ ...p, place: 1, percent: 50 })),
      }}
    />,
  );
  expect(screen.getByText("EMPATE")).toBeVisible();
  expect(screen.getAllByText("50%")).toHaveLength(2);
  expect(screen.queryByText(/Vitória de/)).not.toBeInTheDocument();
});
it("destaca apenas vencedor consolidado, com avatar maior, e nunca decide pelos pontos locais", () => {
  const { container, rerender } = render(
    <ChallengeResult
      challenge={{
        ...c,
        closed: true,
        board: c.board.map((p) => ({ ...p, place: p.id === "b" ? 1 : 2 })),
      }}
    />,
  );
  expect(screen.getByText("Vitória de @Bia")).toBeVisible();
  expect(container.querySelector(".arena-result-winner")).toHaveTextContent(
    "@Bia",
  );
  expect(
    container.querySelector(".arena-result-winner .team-avatar"),
  ).toHaveStyle({ width: "60px" });
  rerender(
    <ChallengeResult
      challenge={{
        ...c,
        closed: true,
        board: c.board.map((p) => ({ ...p, place: 1 })),
      }}
    />,
  );
  expect(container.querySelector(".arena-result-winner")).toBeNull();
  expect(screen.getByText("EMPATE")).toBeVisible();
});
