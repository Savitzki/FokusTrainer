import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import TrainingScheduleSettings from "./TrainingScheduleSettings";
import WorkoutCalendar from "./WorkoutCalendar";
import { WEEKDAYS } from "./training";
import type { TrainingController } from "./useTrainingPlan";
function controller(days: number[] = []): TrainingController {
  return {
    enabled: true,
    busy: false,
    error: "",
    state: {
      revision: days.length ? 1 : 0,
      timezone: "UTC",
      today: "2026-10-17",
      startedOn: "2026-10-12",
      weeklyExtraLimit: 2,
      extraRests: [],
      plans: days.length
        ? [{ revision: 1, effectiveFrom: "2026-10-12", trainingDays: days }]
        : [],
      planRequired: !days.length,
      legacyScheduleBefore: null,
    },
    refresh: vi.fn(),
    save: vi.fn().mockResolvedValue(true),
    rest: vi.fn(),
    getCurrent: vi.fn(),
    reschedule: vi.fn(),
  };
}
it.each([1, 2, 3, 4, 5, 6, 7])(
  "cria um plano de %i dias apenas depois da confirmação",
  async (count) => {
    const user = userEvent.setup(),
      training = controller();
    render(<TrainingScheduleSettings training={training} onLogin={vi.fn()} />);
    await user.selectOptions(
      screen.getByLabelText("Quantos dias por semana você quer treinar?"),
      String(count),
    );
    expect(
      screen.getByText(
        new RegExp(`${count} dia.*treino · ${7 - count} dia.*descanso`),
      ),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Escolher dias" }));
    expect(
      screen.getByRole("button", { name: "Revisar plano" }),
    ).toBeDisabled();
    for (const name of WEEKDAYS.slice(0, count))
      await user.click(screen.getByRole("button", { name }));
    await user.click(screen.getByRole("button", { name: "Revisar plano" }));
    expect(training.save).not.toHaveBeenCalled();
    expect(screen.getByText("Quando começa a valer")).toBeVisible();
    expect(screen.getByText(/17 de outubro de 2026 · hoje/)).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Confirmar e salvar" }),
    );
    expect(training.save).toHaveBeenCalledExactlyOnceWith(
      Array.from({ length: count }, (_, i) => i + 1),
    );
  },
);
it("mantém o plano ativo bloqueado e substitui a quantidade com vigência amanhã", async () => {
  const user = userEvent.setup(),
    training = controller([1, 2, 3, 4, 5]);
  render(<TrainingScheduleSettings training={training} onLogin={vi.fn()} />);
  expect(screen.getByText("Bloqueado")).toBeVisible();
  for (const button of within(
    screen.getByRole("group", { name: "Dias de treino" }),
  ).getAllByRole("button"))
    expect(button).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Substituir plano" }));
  await user.selectOptions(
    screen.getByLabelText("Quantos dias por semana você quer treinar?"),
    "3",
  );
  await user.click(screen.getByRole("button", { name: "Escolher dias" }));
  expect(screen.getByRole("button", { name: "Quarta-feira" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: "Quinta-feira" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await user.click(screen.getByRole("button", { name: "Terça-feira" }));
  await user.click(screen.getByRole("button", { name: "Sexta-feira" }));
  await user.click(screen.getByRole("button", { name: "Revisar plano" }));
  expect(screen.getByText(/18 de outubro de 2026/)).toBeVisible();
  expect(training.save).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Voltar e editar" }));
  expect(screen.getByRole("button", { name: "Sexta-feira" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await user.click(screen.getByRole("button", { name: "Revisar plano" }));
  await user.click(screen.getByRole("button", { name: "Confirmar e salvar" }));
  expect(training.save).toHaveBeenCalledExactlyOnceWith([1, 3, 5]);
  expect(training.state?.plans[0].trainingDays).toEqual([1, 2, 3, 4, 5]);
});
it("não salva seleção diferente da quantidade nem anuncia sucesso em falhas", async () => {
  const user = userEvent.setup(),
    training = controller([1, 3, 5]);
  vi.mocked(training.save).mockResolvedValue(false);
  render(<TrainingScheduleSettings training={training} onLogin={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "Substituir plano" }));
  await user.click(screen.getByRole("button", { name: "Escolher dias" }));
  await user.click(screen.getByRole("button", { name: "Domingo" }));
  expect(screen.getByRole("button", { name: "Revisar plano" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Domingo" }));
  await user.click(screen.getByRole("button", { name: "Revisar plano" }));
  await user.click(screen.getByRole("button", { name: "Confirmar e salvar" }));
  expect(screen.queryByText("Novo plano confirmado")).not.toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Confirmar plano semanal" }),
  ).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Cancelar substituição" }),
  );
  expect(screen.getByText("Bloqueado")).toBeVisible();
});
it("apresenta o plano antes do calendário e histórico, sem seção recolhida", async () => {
  const training = controller([1, 3, 5]);
  render(
    <WorkoutCalendar
      workouts={[]}
      today="2026-10-17"
      view={{ month: "2026-10", day: "2026-10-17" }}
      onView={vi.fn()}
      schedule={training}
      training={training.state}
    />,
  );
  const plan = screen.getByRole("region", { name: "Semana de treinos" }),
    calendar = screen.getByRole("region", { name: "Calendário da ofensiva" }),
    history = screen.getByRole("region", { name: "Histórico de treinos" });
  expect(plan).toBeVisible();
  expect(history).toBeVisible();
  expect(
    plan.compareDocumentPosition(calendar) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    calendar.compareDocumentPosition(history) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Registrar treino" }),
  ).not.toBeInTheDocument();
});
it("visitantes podem abrir o login para configurar o plano", async () => {
  const onLogin = vi.fn();
  render(
    <TrainingScheduleSettings
      training={{ ...controller(), enabled: false, state: null }}
      onLogin={onLogin}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Entre para configurar sua semana" }),
  );
  expect(onLogin).toHaveBeenCalledOnce();
});
