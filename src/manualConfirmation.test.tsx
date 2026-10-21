import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import ManualWorkoutInterrogation from "./ManualWorkoutInterrogation";
import { WorkoutRegistration } from "./WorkoutRegistration";
import { freshData, parseData, type Workout } from "./model";
import type { WorkoutSessionController } from "./useWorkoutSession";
import {
  MANUAL_FINAL_QUESTION,
  MANUAL_QUESTIONS,
  pickManualQuestions,
  recentManualQuestions,
  rememberManualQuestions,
  validManualConfirmation,
  type ManualConfirmation,
} from "./manualConfirmation";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("./backend", () => ({ backendRpc: rpc, accountConfigured: true }));
const declaration: ManualConfirmation = {
  version: 1,
  questionIds: ["real", "honest"],
  answers: [true, true, true],
};
const controller = (): WorkoutSessionController => ({
  state: null,
  error: "",
  busy: false,
  recovering: false,
  refresh: vi.fn(),
  act: vi.fn(),
  anchor: { current: performance.now() },
});
beforeEach(() => {
  rpc.mockReset();
  Object.defineProperty(navigator, "onLine", {
    value: true,
    configurable: true,
  });
});
it("sorteia duas perguntas diferentes, sem repetir o par anterior", () => {
  for (const sample of [0, 0.1, 0.5, 0.99, 1]) {
    const questions = pickManualQuestions([], () => sample);
    expect(new Set(questions).size).toBe(2);
    const next = pickManualQuestions(questions, () => sample);
    expect(next.every((id) => !questions.includes(id))).toBe(true);
    expect(next.every((id) => MANUAL_QUESTIONS.some((q) => q.id === id))).toBe(
      true,
    );
  }
});
it("guarda somente IDs recentes, separados por conta", () => {
  rememberManualQuestions("a", declaration.questionIds);
  expect(recentManualQuestions("a")).toEqual(declaration.questionIds);
  expect(recentManualQuestions("b")).toEqual([]);
});
it.each([
  null,
  {},
  { version: 1 },
  { ...declaration, answers: [true, true] },
  { ...declaration, answers: [true, true, false] },
  { ...declaration, answers: ["true", true, true] },
  { ...declaration, questionIds: ["real", "real"] },
  { ...declaration, questionIds: ["real", "unknown"] },
  { ...declaration, version: 2 },
  { ...declaration, extra: true },
  { intensity: 3, feeling: "normal", completion: "full" },
])("recusa declaração incompleta ou adulterada: %j", (raw) => {
  expect(validManualConfirmation(raw)).toBe(false);
});
it("aceita somente três respostas positivas explícitas", () => {
  expect(validManualConfirmation(declaration)).toBe(true);
});
it("mostra uma pergunta por vez, mantém o sorteio ao voltar e exige a última confirmação", async () => {
  const user = userEvent.setup(),
    done = vi.fn(),
    back = vi.fn();
  const props = {
    questions: declaration.questionIds,
    busy: false,
    error: "",
    onComplete: done,
    onReturn: back,
    onCancel: vi.fn(),
  };
  const view = render(<ManualWorkoutInterrogation {...props} />);
  expect(screen.getAllByRole("heading")).toHaveLength(1);
  expect(screen.getByText(MANUAL_QUESTIONS[0].text)).toBeVisible(

  );
  expect(screen.getByText("1 de 3")).toBeInTheDocument();
  expect(screen.queryByText(MANUAL_FINAL_QUESTION)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Sim" }));
  expect(screen.getByText("2 de 3")).toBeInTheDocument();
  expect(screen.getByText(MANUAL_QUESTIONS[3].text)).toBeVisible(

  );
  await user.click(screen.getByRole("button", { name: "Voltar" }));
  view.rerender(<ManualWorkoutInterrogation {...props} />);
  expect(screen.getByText(MANUAL_QUESTIONS[0].text)).toBeVisible(

  );
  await user.click(screen.getByRole("button", { name: "Sim" }));
  await user.click(screen.getByRole("button", { name: "Sim" }));
  expect(screen.getByText(MANUAL_FINAL_QUESTION)).toBeInTheDocument();
  expect(done).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Voltar" }));
  expect(screen.getByText("2 de 3")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Sim" }));
  await user.click(screen.getByRole("button", { name: "Sim, eu confirmo." }));
  expect(done).toHaveBeenCalledExactlyOnceWith(declaration);
});
it.each([0, 1, 2])(
  "um Não na etapa %i não registra nem transmite respostas negativas",
  async (step) => {
    const user = userEvent.setup(),
      done = vi.fn(),
      back = vi.fn(),
      cancel = vi.fn();
    render(
      <ManualWorkoutInterrogation
        questions={declaration.questionIds}
        busy={false}
        error=""
        onComplete={done}
        onReturn={back}
        onCancel={cancel}
      />,
    );
    for (let n = 0; n < step; n++)
      await user.click(screen.getByRole("button", { name: "Sim" }));
    await user.click(screen.getByRole("button", { name: "Não" }));
    expect(screen.getByText("Honestidade, gostei")).toBeInTheDocument();
    expect(done).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Voltar ao formulário" }),
    );
    expect(back).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Cancelar registro" }));
    expect(cancel).toHaveBeenCalledOnce();
  },
);
it("desabilita as respostas e o retorno durante a confirmação", () => {
  render(
    <ManualWorkoutInterrogation
      questions={declaration.questionIds}
      busy
      error=""
      onComplete={vi.fn()}
      onReturn={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  for (const button of screen.getAllByRole("button"))
    expect(button).toBeDisabled();
});
async function manualForm(
  props: {
    onConfirmed?: (w: Workout) => void;
    onQueued?: (w: Workout) => void;
    draft?: Workout;
    onCancel?: () => void;
  } = {},
) {
  const user = userEvent.setup();
  const view = render(
    <WorkoutRegistration
      controller={controller()}
      today="2026-10-18"
      userId="interrogation-test"
      onStarted={vi.fn()}
      onResume={vi.fn()}
      onConfirmed={props.onConfirmed ?? vi.fn()}
      {...props}
    />,
  );
  if (!props.draft) {
    await user.click(
      screen.getByRole("button", { name: /Registrar manualmente/ }),
    );
    await user.type(screen.getByLabelText("Duração (minutos)"), "35");
  }
  return { user, ...view };
}
async function reachLast(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Sim" }));
  await user.click(screen.getByRole("button", { name: "Sim" }));
}
it("retorna ao formulário sem perder atividade, duração ou perguntas", async () => {
  const { user } = await manualForm();
  await user.selectOptions(screen.getByLabelText("Atividade"), "Corrida");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  const first = screen.getByRole("heading").textContent;
  await user.click(screen.getByRole("button", { name: "Não" }));
  await user.click(
    screen.getByRole("button", { name: "Voltar ao formulário" }),
  );
  expect(screen.getByLabelText("Atividade")).toHaveValue("Corrida");
  expect(screen.getByLabelText("Duração (minutos)")).toHaveValue(35);
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  expect(screen.getByRole("heading").textContent).toBe(first);
  expect(rpc).not.toHaveBeenCalled();
});
it("cancela o registro pelo modal existente sem confirmar", async () => {
  const cancel = vi.fn(),
    done = vi.fn(),
    queued = vi.fn();
  const { user } = await manualForm({
    onCancel: cancel,
    onConfirmed: done,
    onQueued: queued,
  });
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Não" }));
  await user.click(screen.getByRole("button", { name: "Cancelar registro" }));
  expect(cancel).toHaveBeenCalledOnce();
  expect(done).not.toHaveBeenCalled();
  expect(queued).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
it("rejeita duração inválida mesmo se o submit do formulário for forçado", async () => {
  const { user, container } = await manualForm();
  await user.clear(screen.getByLabelText("Duração (minutos)"));
  await user.type(screen.getByLabelText("Duração (minutos)"), "34");
  expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  fireEvent.submit(container.querySelector("form")!);
  expect(screen.getByText("Cê tá de sacanagem?")).toBeInTheDocument();
  expect(screen.queryByText("1 de 3")).not.toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});
it("repete uma falha com o mesmo ID e impede confirmação simultânea", async () => {
  let finish!: (w: Workout) => void;
  rpc.mockRejectedValueOnce(new Error("Conexão interrompida"));
  rpc.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const done = vi.fn(),
    { user } = await manualForm({ onConfirmed: done });
  await reachLast(user);
  await user.click(screen.getByRole("button", { name: "Sim, eu confirmo." }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Conexão interrompida",
  );
  const request = rpc.mock.calls[0][1];
  expect(validManualConfirmation(request.p_confirmation)).toBe(true);
  expect(request).not.toHaveProperty("p_review");
  await user.click(screen.getByRole("button", { name: "Sim, eu confirmo." }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmando…" }));
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(rpc.mock.calls[1][1]).toEqual(request);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  const confirmed: Workout = {
    id: request.p_request_id,
    date: "2026-10-18",
    activity: "Musculação",
    minutes: 35,
    method: "manual",
    manualConfirmed: true,
    confirmedAt: "2026-10-18T12:00:00Z",
  };
  await act(async () => finish(confirmed));
  expect(done).toHaveBeenCalledExactlyOnceWith(confirmed);
});
it("guarda offline apenas a declaração positiva, sem confirmação nem recompensa antecipada", async () => {
  const done = vi.fn(),
    queued = vi.fn(),
    { user } = await manualForm({ onConfirmed: done, onQueued: queued });
  Object.defineProperty(navigator, "onLine", {
    value: false,
    configurable: true,
  });
  await reachLast(user);
  expect(queued).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Sim, eu confirmo." }));
  expect(queued).toHaveBeenCalledOnce();
  const pending = queued.mock.calls[0][0];
  expect(validManualConfirmation(pending.manualConfirmation)).toBe(true);
  expect(pending).not.toHaveProperty("confirmedAt");
  expect(pending).not.toHaveProperty("review");
  expect(done).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
it("preserva avaliação histórica e pede nova declaração para rascunho antigo", async () => {
  const old: Workout = {
    id: "old-draft",
    date: "2026-10-18",
    activity: "Corrida",
    minutes: 35,
    method: "manual",
    review: { intensity: 3, feeling: "normal", completion: "partial" },
  };
  const data = freshData();
  data.workouts = [old];
  expect(parseData(JSON.stringify(data)).workouts).toEqual([old]);
  const { user } = await manualForm({ draft: old });
  expect(rpc).not.toHaveBeenCalled();
  await reachLast(user);
  expect(screen.getByText(MANUAL_FINAL_QUESTION)).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

it("mostra a recepção com mascote e os dois métodos, sem textos de detalhes", async () => {
  const user = userEvent.setup();
  const view = render(
    <WorkoutRegistration
      controller={controller()}
      today="2026-10-19"
      onStarted={vi.fn()}
      onResume={vi.fn()}
      onConfirmed={vi.fn()}
    />,
  );
  expect(
    screen.getByText("Acho bom mesmo..."),
  ).toBeInTheDocument();
  expect(
    view.container.querySelector(".registration-intro .capibora-mascot"),
  ).toHaveAttribute("src", "mascot/web/deboa.webp");
  expect(screen.getAllByRole("button")).toHaveLength(2);
  expect(screen.queryByLabelText("Duração (minutos)")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /Iniciar treino/ }));
  expect(screen.getByRole("heading", { name: "Iniciar treino" })).toHaveFocus();
  expect(screen.queryByText("Sobre este registro")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Duração (minutos)")).not.toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

it("só provoca abaixo do mínimo e retira o aviso ao corrigir, preservando as três perguntas", async () => {
  const user = userEvent.setup();
  render(
    <WorkoutRegistration
      controller={controller()}
      today="2026-10-19"
      onStarted={vi.fn()}
      onResume={vi.fn()}
      onConfirmed={vi.fn()}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: /Registrar manualmente/ }),
  );
  const duration = screen.getByLabelText("Duração (minutos)");
  expect(screen.queryByText("Cê tá de sacanagem?")).not.toBeInTheDocument();
  expect(screen.queryByText(/uma confirmação por dia/)).not.toBeInTheDocument();
  await user.type(duration, "34");
  expect(duration).toHaveAttribute("aria-invalid", "true");
  expect(duration).toHaveAccessibleDescription(
    "Cê tá de sacanagem? Confere essa duração aí · O mínimo é 35 min",
  );
  expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  await user.clear(duration);
  await user.type(duration, "35");
  expect(screen.queryByText("Cê tá de sacanagem?")).not.toBeInTheDocument();
  expect(duration).not.toHaveAttribute("aria-invalid");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  expect(screen.getByText("1 de 3")).toBeInTheDocument();
  expect(screen.queryByText("Pensa bem")).not.toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});
