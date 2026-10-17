import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import TrainingScheduleSettings from "./TrainingScheduleSettings";
import WorkoutCalendar from "./WorkoutCalendar";
import type { TrainingController } from "./useTrainingPlan";

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

it("mantém um atalho do calendário para configurações e permite que visitantes entrem", async () => {
  const training = { ...controller(), enabled: false, state: null },
    onSettings = vi.fn(),
    onLogin = vi.fn();
  const view = render(
    <WorkoutCalendar
      workouts={[]}
      today="2026-10-17"
      view={{ month: "2026-10", day: "2026-10-17" }}
      onView={vi.fn()}
      onRegister={vi.fn()}
      schedule={training}
      onSettings={onSettings}
    />,
  );
  expect(
    screen.queryByRole("region", { name: "Semana de treinos" }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Sua semana" }));
  expect(onSettings).toHaveBeenCalledOnce();
  view.unmount();
  render(<TrainingScheduleSettings training={training} onLogin={onLogin} />);
  await userEvent.click(
    screen.getByRole("button", { name: "Entre para configurar sua semana" }),
  );
  expect(onLogin).toHaveBeenCalledOnce();
});
