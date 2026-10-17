import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import TrainingScheduleSettings from "./TrainingScheduleSettings";
import WorkoutCalendar from "./WorkoutCalendar";
import type { TrainingController } from "./useTrainingPlan";
import type { Workout } from "./model";

function controller(days = [1, 2, 3, 4, 5, 6, 7]): TrainingController {
  return {
    enabled: true,
    busy: false,
    error: "",
    state: {
      revision: 1,
      timezone: "UTC",
      today: "2026-10-17",
      startedOn: "2026-10-12",
      weeklyExtraLimit: 2,
      extraRests: [],
      plans: [{ revision: 1, effectiveFrom: "2026-10-12", trainingDays: days }],
    },
    refresh: vi.fn(),
    save: vi.fn().mockResolvedValue(true),
    rest: vi.fn(),
    getCurrent: vi.fn(),
    reschedule: vi.fn(),
  };
}

it("permite dois descansos, bloqueia três e permite corrigir antes de salvar", async () => {
  const training = controller(),
    user = userEvent.setup();
  render(<TrainingScheduleSettings training={training} onLogin={vi.fn()} />);
  const save = screen.getByRole("button", { name: "Salvar semana" });
  expect(save).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Domingo" }));
  expect(save).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Sábado" }));
  expect(save).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Sexta-feira" }));
  expect(save).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Escolha exatamente 5 dias de treino e 2 de descanso",
  );
  await user.click(save);
  expect(training.save).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Sexta-feira" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  await user.click(save);
  expect(training.save).toHaveBeenCalledExactlyOnceWith([1, 2, 3, 4, 5]);
  expect(await screen.findByRole("status")).toHaveTextContent("Semana salva");
});

it("preserva a seleção antiga com mais descansos e exige adequação antes de salvar", async () => {
  const training = controller([1, 3, 5]);
  render(<TrainingScheduleSettings training={training} onLogin={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Terça-feira" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(screen.getByRole("button", { name: "Salvar semana" })).toBeDisabled();
  expect(training.save).not.toHaveBeenCalled();
});

it("mantém o progresso separado da seleção não salva e atualiza após novo treino", async () => {
  const training = controller([1, 2, 3, 4, 5]);
  const workouts: Workout[] = ["2026-10-12", "2026-10-14", "2026-10-16"].map(
    (date) => ({ id: date, date, activity: "Corrida", minutes: 30 }),
  );
  const onLogin = vi.fn();
  const { rerender } = render(
    <TrainingScheduleSettings training={training} workouts={workouts} onLogin={onLogin} />,
  );
  const progress = within(screen.getByRole("region", { name: "Progresso da semana" }));
  expect(progress.getByText("60%")).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Progresso da semana" })).toHaveTextContent("3/5");
  expect(progress.getByText("Faltam 2 treinos para concluir a semana")).toBeInTheDocument();
  expect(progress.getByRole("progressbar")).toHaveAttribute("value", "3");
  await userEvent.click(screen.getByRole("button", { name: "Sexta-feira" }));
  expect(screen.getByRole("button", { name: "Salvar semana" })).toBeDisabled();
  expect(progress.getByText("60%")).toBeInTheDocument();
  rerender(
    <TrainingScheduleSettings
      training={training}
      workouts={[...workouts, { id: "thu", date: "2026-10-15", activity: "Corrida", minutes: 20 }]}
      onLogin={onLogin}
    />,
  );
  expect(screen.getByRole("region", { name: "Progresso da semana" })).toHaveTextContent("4/5");
  expect(progress.getByText("80%")).toBeInTheDocument();
  expect(progress.getByText("Falta 1 treino para concluir a semana")).toBeInTheDocument();
});

it("integra o contador ao calendário e comemora a meta completa", () => {
  const schedule = controller([1, 2, 3, 4, 5]);
  render(
    <WorkoutCalendar
      workouts={[12, 13, 14, 15, 16].map((day) => ({
        id: String(day), date: `2026-10-${day}`, activity: "Corrida", minutes: 30,
      }))}
      today="2026-10-17"
      view={{ month: "2026-10", day: "2026-10-17" }}
      onView={vi.fn()}
      onRegister={vi.fn()}
      schedule={schedule}
      training={schedule.state}
    />,
  );
  const progress = within(screen.getByRole("region", { name: "Progresso da semana" }));
  expect(screen.getByRole("region", { name: "Progresso da semana" })).toHaveTextContent("5/5");
  expect(progress.getByText("100%")).toBeInTheDocument();
  expect(progress.getByText("Semana concluída. Você fez acontecer 🔥")).toBeInTheDocument();
});

it("mostra a semana antes do calendário na tela de treinos e permite que visitantes entrem", async () => {
  const training = { ...controller(), enabled: false, state: null },
    onLogin = vi.fn();
  render(
    <WorkoutCalendar
      workouts={[]}
      today="2026-10-17"
      view={{ month: "2026-10", day: "2026-10-17" }}
      onView={vi.fn()}
      onRegister={vi.fn()}
      schedule={training}
      onLogin={onLogin}
    />,
  );
  const week = screen.getByRole("region", { name: "Semana de treinos" });
  expect(screen.queryByRole("region", { name: "Progresso da semana" })).not.toBeInTheDocument();
  const calendar = screen.getByRole("region", {
    name: "Calendário de treinos",
  });
  expect(
    week.compareDocumentPosition(calendar) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  await userEvent.click(
    screen.getByRole("button", { name: "Entre para configurar sua semana" }),
  );
  expect(onLogin).toHaveBeenCalledOnce();
});
