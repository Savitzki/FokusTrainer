import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import WeeklyTrainingProgress from "./WeeklyTrainingProgress";
import type { TrainingState } from "./training";
import type { Workout } from "./model";

const training: TrainingState = {
  revision: 1, timezone: "UTC", today: "2026-10-17", startedOn: "2026-10-12",
  weeklyExtraLimit: 2, extraRests: [],
  plans: [{ revision: 1, effectiveFrom: "2026-10-12", trainingDays: [1, 2, 3, 4, 5] }],
};
const workouts = (days: number[]): Workout[] => days.map((day) => ({
  id: String(day), date: `2026-10-${day}`, activity: "Corrida", minutes: 30,
}));

it("atualiza o progresso da conta e usa singular no último treino restante", () => {
  const view = render(<WeeklyTrainingProgress training={training} workouts={workouts([12, 14, 16])} />);
  expect(screen.getByRole("region", { name: "Progresso da semana" })).toHaveTextContent("3/5");
  expect(screen.getByText("60%")).toBeInTheDocument();
  expect(screen.getByText("Faltam 2 treinos para concluir a semana")).toBeInTheDocument();
  view.rerender(<WeeklyTrainingProgress training={training} workouts={workouts([12, 13, 14, 16])} />);
  expect(screen.getByText("80%")).toBeInTheDocument();
  expect(screen.getByText("Falta 1 treino para concluir a semana")).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("value", "4");
});

it("comemora a meta completa sem exibir progresso de visitante", () => {
  const view = render(<WeeklyTrainingProgress training={training} workouts={workouts([12, 13, 14, 15, 16])} />);
  expect(screen.getByText("100%")).toBeInTheDocument();
  expect(screen.getByText("Semana concluída. Você fez acontecer 🔥")).toBeInTheDocument();
  view.rerender(<WeeklyTrainingProgress training={null} workouts={workouts([12, 13, 14])} />);
  expect(screen.queryByRole("region", { name: "Progresso da semana" })).not.toBeInTheDocument();
});
