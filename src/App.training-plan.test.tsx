import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { localDate } from "./model";
import type { TrainingState } from "./training";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  save: vi.fn(),
  state: null as TrainingState | null,
}));
vi.mock("./backend", () => ({
  accountConfigured: false,
  backendRpc: mocks.rpc,
}));
const account = vi.hoisted(() => ({
  user: { id: "new-planner" },
  configured: true,
  initializing: false,
  profileChecked: true,
  profile: {
    nickname: "Dani",
    style: "initials",
    color: "orange",
    photo: null,
  },
  profileLoading: false,
}));
vi.mock("./account", () => ({ useAccount: () => account }));
vi.mock("./useTrainingPlan", async () => {
  const { useState, useRef, useCallback } = await import("react");
  return {
    useTrainingPlan: () => {
      const [state, setState] = useState(mocks.state);
      const latest = useRef(state);
      latest.current = state;
      const refresh = useCallback(async () => true, []);
      const getCurrent = useCallback(() => latest.current, []);
      return {
        state,
        enabled: true,
        busy: false,
        error: "",
        refresh,
        getCurrent,
        save: async (days: number[]) => {
          const okay = await mocks.save(days);
          if (okay)
            setState({
              ...state!,
              revision: 1,
              planRequired: false,
              plans: [
                {
                  revision: 1,
                  effectiveFrom: state!.today,
                  trainingDays: days,
                },
              ],
            });
          return okay;
        },
        rest: vi.fn(),
        reschedule: vi.fn(),
      };
    },
  };
});
beforeEach(() => {
  mocks.save.mockReset().mockResolvedValue(true);
  mocks.rpc.mockReset();
  mocks.state = {
    revision: 0,
    today: localDate(),
    startedOn: localDate(),
    timezone: "UTC",
    weeklyExtraLimit: 2,
    extraRests: [],
    plans: [],
    planRequired: true,
    legacyScheduleBefore: null,
  };
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === "get_social_state")
      return {
        code: "code",
        workouts: [],
        friends: [],
        requests: [],
        groups: [],
      };
    if (name === "sync_weight_entries") return { records: [], applied: [] };
    return {
      serverNow: new Date().toISOString(),
      today: localDate(),
      timezone: "UTC",
      minimumMinutes: 35,
      maximumMinutes: 240,
      session: null,
    };
  });
});
it("permite navegar, mas exige o primeiro plano antes de oferecer os métodos manual e cronometrado", async () => {
  const user = userEvent.setup();
  render(<App />);
  expect(screen.queryByText("Descanso programado")).not.toBeInTheDocument();
  expect(screen.queryByText("Treinar mesmo assim")).not.toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: "Peso" }));
  expect(screen.getByRole("heading", { name: "Meu peso" })).toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: "Início" }));
  await user.click(screen.getByRole("button", { name: "Registrar treino" }));
  expect(
    screen.getByRole("dialog", { name: "Seu plano semanal" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Registrar manualmente/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Iniciar treino/ }),
  ).not.toBeInTheDocument();
  for (const name of [
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
  ])
    await user.click(screen.getByRole("button", { name }));
  await user.click(screen.getByRole("button", { name: "Criar meu plano" }));
  expect(
    await screen.findByRole("button", { name: /Registrar manualmente/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Iniciar treino/ }),
  ).toBeInTheDocument();
  expect(mocks.save).toHaveBeenCalledExactlyOnceWith([1, 2, 3, 4, 5]);
  expect(
    mocks.rpc.mock.calls.some(([name]) =>
      ["confirm_manual_workout", "start_workout_session"].includes(name),
    ),
  ).toBe(false);
});
it("falha ao criar mantém o bloqueio sem mostrar sucesso", async () => {
  mocks.save.mockResolvedValue(false);
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Registrar treino" }));
  for (const name of [
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
  ])
    await user.click(screen.getByRole("button", { name }));
  await user.click(screen.getByRole("button", { name: "Criar meu plano" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
  expect(
    screen.getByRole("dialog", { name: "Seu plano semanal" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Registrar manualmente/ }),
  ).not.toBeInTheDocument();
});
