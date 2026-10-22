import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import RescheduleTraining from "./RescheduleTraining";
import type { TrainingController } from "./useTrainingPlan";
import type { TrainingState } from "./training";
function controller(
  overrides: Partial<TrainingState> = {},
): TrainingController {
  const state: TrainingState = {
    revision: 1,
    timezone: "UTC",
    today: "2026-10-20",
    startedOn: "2026-10-12",
    weeklyExtraLimit: 2,
    weeklyRescheduleLimit: 2,
    extraRests: [],
    medicalRests: [],
    reschedules: [],
    plans: [
      {
        revision: 1,
        effectiveFrom: "2026-10-12",
        trainingDays: [1, 2, 3, 5, 6],
      },
    ],
    ...overrides,
  };
  return {
    state,
    enabled: true,
    busy: false,
    error: "",
    refresh: vi.fn().mockResolvedValue(true),
    getCurrent: () => state,
    save: vi.fn(),
    rest: vi.fn(),
    reschedule: vi.fn().mockResolvedValue(true),
  };
}
it("seleciona somente descansos válidos e confirma uma troca antes de atualizar a tela", async () => {
  const training = controller(),
    onSaved = vi.fn(),
    user = userEvent.setup();
  render(
    <RescheduleTraining
      day="2026-10-20"
      workouts={[]}
      training={training}
      onSaved={onSaved}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Reagendar treino" }));
  expect(training.reschedule).not.toHaveBeenCalled();
  expect(screen.getAllByRole("radio")).toHaveLength(2);
  const confirm = screen.getByRole("button", { name: "Confirmar troca" });
  expect(confirm).toBeDisabled();
  await user.click(screen.getByRole("radio", { name: /quinta-feira/ }));
  await user.click(confirm);
  expect(training.reschedule).toHaveBeenCalledExactlyOnceWith(
    "2026-10-20",
    "2026-10-22",
  );
  expect(onSaved).toHaveBeenCalledExactlyOnceWith("2026-10-22");
});
it("uma recusa do servidor mantém a escolha e não confirma a troca localmente", async () => {
  const training = controller(),
    onSaved = vi.fn(),
    user = userEvent.setup();
  vi.mocked(training.reschedule).mockResolvedValue(false);
  render(
    <RescheduleTraining
      day="2026-10-20"
      workouts={[]}
      training={training}
      onSaved={onSaved}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Reagendar treino" }));
  await user.click(screen.getByRole("radio", { name: /quinta-feira/ }));
  await user.click(screen.getByRole("button", { name: "Confirmar troca" }));
  expect(onSaved).not.toHaveBeenCalled();
  expect(screen.getByRole("radio", { name: /quinta-feira/ })).toBeChecked();
});
it("explica quando não resta uma data posterior sem alterar limites ou benefícios", () => {
  render(
    <RescheduleTraining
      day="2026-10-24"
      workouts={[]}
      training={controller({ extraRests: ["2026-10-25"] })}
      onSaved={vi.fn()}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Reagendar treino" }),
  ).toBeDisabled();
  expect(screen.getByText(/Não há descanso disponível/)).toBeInTheDocument();
});

it("não abre datas do cache após falha na atualização", async () => {
  const training = controller();
  vi.mocked(training.refresh).mockResolvedValue(false);
  render(
    <RescheduleTraining
      day="2026-10-20"
      workouts={[]}
      training={training}
      onSaved={vi.fn()}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Reagendar treino" }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Não foi possível atualizar os dias disponíveis",
  );
  expect(screen.queryByRole("radio")).toBeNull();
  expect(training.reschedule).not.toHaveBeenCalled();
});
it("serializa confirmações mesmo antes de busy atualizar, sem anunciar sucesso antecipadamente", async () => {
  const training = controller(),
    onSaved = vi.fn(),
    onBusyChange = vi.fn();
  let finish!: (saved: boolean) => void;
  vi.mocked(training.reschedule).mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  render(
    <RescheduleTraining
      day="2026-10-20"
      workouts={[]}
      training={training}
      onSaved={onSaved}
      onBusyChange={onBusyChange}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Reagendar treino" }),
  );
  await userEvent.click(screen.getByRole("radio", { name: /quinta-feira/ }));
  await userEvent.dblClick(
    screen.getByRole("button", { name: "Confirmar troca" }),
  );
  expect(training.reschedule).toHaveBeenCalledTimes(1);
  expect(onSaved).not.toHaveBeenCalled();
  expect(onBusyChange).toHaveBeenLastCalledWith(true);
  await act(async () => finish(true));
  expect(onSaved).toHaveBeenCalledExactlyOnceWith("2026-10-22");
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
});

it("abre a seleção na confirmação sem outra etapa e permite voltar sem salvar", async () => {
  const training = controller(),
    onCancel = vi.fn();
  render(
    <RescheduleTraining
      initiallyOpen
      day="2026-10-20"
      workouts={[]}
      training={training}
      onSaved={vi.fn()}
      onCancel={onCancel}
    />,
  );
  expect(await screen.findAllByRole("radio")).toHaveLength(2);
  expect(training.refresh).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Reagendar treino" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(onCancel).toHaveBeenCalledOnce();
  expect(training.reschedule).not.toHaveBeenCalled();
});

it("não libera a seleção por cache após falha na leitura da confirmação", async () => {
  const training = controller();
  vi.mocked(training.refresh)
    .mockResolvedValueOnce(false)
    .mockResolvedValue(true);
  render(
    <RescheduleTraining
      initiallyOpen
      day="2026-10-20"
      workouts={[]}
      training={training}
      onSaved={vi.fn()}
    />,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível atualizar",
  );
  expect(screen.queryByRole("radio")).toBeNull();
  expect(training.reschedule).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("button", { name: "Atualizar opções" }),
  );
  expect(await screen.findAllByRole("radio")).toHaveLength(2);
  expect(training.refresh).toHaveBeenCalledTimes(2);
});
