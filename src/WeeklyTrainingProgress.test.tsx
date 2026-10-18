import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import WeeklyTrainingProgress from "./WeeklyTrainingProgress";
import type { TrainingState } from "./training";
import type { Workout } from "./model";

const training: TrainingState = {
  revision: 1,
  timezone: "UTC",
  today: "2026-10-17",
  startedOn: "2026-10-12",
  weeklyExtraLimit: 2,
  extraRests: [],
  plans: [
    { revision: 1, effectiveFrom: "2026-10-12", trainingDays: [1, 2, 3, 4, 5] },
  ],
};
const workouts = (days: number[]): Workout[] =>
  days.map((day) => ({
    id: String(day),
    date: `2026-10-${day}`,
    activity: "Corrida",
    minutes: 30,
  }));

it("atualiza o progresso da conta e usa singular no último treino restante", () => {
  const view = render(
    <WeeklyTrainingProgress
      training={training}
      workouts={workouts([12, 14, 16])}
    />,
  );
  expect(
    screen.getByRole("region", { name: "Progresso da semana" }),
  ).toHaveTextContent("3/5");
  expect(screen.getByText("60%")).toBeInTheDocument();
  expect(
    screen.getByText("Faltam 2 treinos para concluir a semana"),
  ).toBeInTheDocument();
  view.rerender(
    <WeeklyTrainingProgress
      training={training}
      workouts={workouts([12, 13, 14, 16])}
    />,
  );
  expect(screen.getByText("80%")).toBeInTheDocument();
  expect(
    screen.getByText("Falta 1 treino para concluir a semana"),
  ).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("value", "4");
});

it("comemora a meta completa sem exibir progresso de visitante", () => {
  const view = render(
    <WeeklyTrainingProgress
      training={training}
      workouts={workouts([12, 13, 14, 15, 16])}
    />,
  );
  expect(screen.getByText("100%")).toBeInTheDocument();
  expect(
    screen.getByText("Semana concluída. Você fez acontecer 🔥"),
  ).toBeInTheDocument();
  view.rerender(
    <WeeklyTrainingProgress
      training={null}
      workouts={workouts([12, 13, 14])}
    />,
  );
  expect(
    screen.queryByRole("region", { name: "Progresso da semana" }),
  ).not.toBeInTheDocument();
});

it("explica o cumprimento obrigatório no início e exclui treino voluntário", () => {
  render(
    <WeeklyTrainingProgress
      compact
      training={training}
      workouts={workouts([12, 17])}
    />,
  );
  expect(
    screen.getByText("de 5 treinos", { exact: false }),
  ).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("value", "1");
  expect(screen.getByText("20%")).toBeInTheDocument();
  expect(
    screen.getByText("Faltam 4 treinos para cumprir seu plano."),
  ).toBeInTheDocument();
});

it("usa a meta efetiva de uma semana de transição, incluindo compensação e proteções", () => {
  const transition: TrainingState = {
    ...training,
    plans: [
      ...training.plans,
      {
        revision: 2,
        effectiveFrom: "2026-10-15",
        trainingDays: [1, 2, 5, 6, 7],
      },
    ],
    reschedules: [
      {
        id: "move",
        originalDay: "2026-10-14",
        targetDay: "2026-10-15",
        weekStart: "2026-10-12",
        createdAt: "2026-10-14T10:00:00Z",
        revision: 2,
      },
    ],
  };
  const view = render(
    <WeeklyTrainingProgress
      compact
      training={transition}
      workouts={workouts([12, 14, 15, 17])}
    />,
  );
  // Mon, Tue, compensatory Thu, Fri, Sat, Sun: six effective obligations.
  expect(screen.getByRole("progressbar")).toHaveAttribute("max", "6");
  expect(screen.getByRole("progressbar")).toHaveAttribute("value", "3");
  expect(screen.getByText("50%")).toBeInTheDocument();
  view.rerender(
    <WeeklyTrainingProgress
      compact
      training={{
        ...transition,
        extraRests: ["2026-10-13"],
        medicalRests: ["2026-10-16"],
      }}
      workouts={workouts([12, 14, 15, 17])}
    />,
  );
  expect(screen.getByRole("progressbar")).toHaveAttribute("max", "4");
  expect(screen.getByText("75%")).toBeInTheDocument();
});
