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

it("bloqueia os dias do plano ativo e exige prévia e confirmação para substituir", async () => {
  const training = controller([1, 2, 3, 4, 5]),
    user = userEvent.setup();
  render(<TrainingScheduleSettings training={training} onLogin={vi.fn()} />);
  expect(screen.getByText("Bloqueado")).toBeInTheDocument();
  for (const day of screen
    .getByRole("group", { name: "Dias de treino" })
    .querySelectorAll("button"))
    expect(day).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Segunda-feira" }));
  expect(training.save).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Substituir plano" }));
  await user.click(screen.getByRole("button", { name: "Sexta-feira" }));
  expect(
    screen.getByRole("button", { name: "Revisar novo plano" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Sábado" }));
  await user.click(screen.getByRole("button", { name: "Revisar novo plano" }));
  expect(
    screen.getByRole("group", { name: "Prévia do novo plano" }),
  ).toBeInTheDocument();
  expect(training.save).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Confirmar substituição" }),
  );
  expect(training.save).toHaveBeenCalledExactlyOnceWith([1, 2, 3, 4, 6]);
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Novo plano confirmado",
  );
});
it("cria o primeiro plano somente com cinco dias e informa vigência hoje", async () => {
  const training = controller(),
    user = userEvent.setup(),
    done = vi.fn();
  training.state = {
    ...training.state!,
    revision: 0,
    plans: [],
    planRequired: true,
    legacyScheduleBefore: null,
  };
  render(
    <TrainingScheduleSettings
      training={training}
      onLogin={vi.fn()}
      onSaved={done}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Criar meu plano" }),
  ).toBeDisabled();
  expect(screen.getByText("Vale hoje")).toBeInTheDocument();
  for (const name of [
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
  ])
    await user.click(screen.getByRole("button", { name }));
  expect(screen.getByText("5 treinos · 2 descansos")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Criar meu plano" }));
  expect(training.save).toHaveBeenCalledExactlyOnceWith([1, 2, 3, 4, 5]);
  expect(done).toHaveBeenCalledOnce();
});
it("preserva planos legados e exige cinco dias apenas na substituição", async () => {
  const training = controller([1, 3, 5]),
    user = userEvent.setup();
  render(<TrainingScheduleSettings training={training} onLogin={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Terça-feira" })).toBeDisabled();
  expect(screen.getByText("3 treinos · 4 descansos")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Substituir plano" }));
  expect(
    screen.getByRole("button", { name: "Revisar novo plano" }),
  ).toBeDisabled();
  expect(training.save).not.toHaveBeenCalled();
});
it("falha na substituição mantém o plano anterior, a prévia e não mostra sucesso", async () => {
  const training = controller([1, 2, 3, 4, 5]),
    user = userEvent.setup();
  vi.mocked(training.save).mockResolvedValue(false);
  render(<TrainingScheduleSettings training={training} onLogin={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "Substituir plano" }));
  await user.click(screen.getByRole("button", { name: "Revisar novo plano" }));
  await user.click(
    screen.getByRole("button", { name: "Confirmar substituição" }),
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(training.state?.plans[0].trainingDays).toEqual([1, 2, 3, 4, 5]);
  await user.click(screen.getByRole("button", { name: "Voltar à seleção" }));
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.getByText("Bloqueado")).toBeInTheDocument();
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
  expect(
    screen.queryByRole("region", { name: "Progresso da semana" }),
  ).not.toBeInTheDocument();
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
