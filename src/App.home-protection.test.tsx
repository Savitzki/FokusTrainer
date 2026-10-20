import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import App from "./App";
// The real opening duration is covered in startupScreen.test.tsx.
vi.mock("./useMinimumLoading", () => ({
  useMinimumLoading: (pending: boolean) => pending,
}));
import { freshData, STORAGE_KEY } from "./model";
import type { TrainingState } from "./training";
import type { EconomyState } from "./economy";
const mock = vi.hoisted(() => ({
  training: null as TrainingState | null,
  economy: null as EconomyState | null,
  refresh: vi.fn(),
  getCurrent: vi.fn(),
  rest: vi.fn(),
  useKit: vi.fn(),
  acknowledgeAutomatic: vi.fn(),
  serverRead: false,
  active: false,
  trained: false,
}));
const account = vi.hoisted(() => ({
  configured: true,
  initializing: false,
  user: { id: "protection-user" },
  profileChecked: true,
  profile: {
    nickname: "Dani",
    style: "initials",
    color: "orange",
    photo: null,
  },
}));
vi.mock("./account", () => ({ useAccount: () => account }));
vi.mock("./backend", () => ({ accountConfigured: false, backendRpc: vi.fn() }));
vi.mock("./useTrainingPlan", () => ({
  useTrainingPlan: () => ({
    state: mock.training,
    enabled: true,
    busy: false,
    refresh: mock.refresh,
    getCurrent: mock.getCurrent,
    rest: mock.rest,
  }),
}));
vi.mock("./useEconomy", () => ({
  useEconomy: () => ({
    state: mock.economy,
    enabled: true,
    busy: false,
    refresh: mock.refresh,
    useKit: mock.useKit,
    acknowledgeAutomatic: mock.acknowledgeAutomatic,
    sync: { lastSuccess: mock.serverRead ? Date.now() : 0, stale: !mock.serverRead },
  }),
}));
vi.mock("./social", () => ({
  deviceTimezone: () => "America/Sao_Paulo",
  useSocial: () => ({ state: null, busy: false, refresh: mock.refresh }),
}));
vi.mock("./useWorkoutSession", () => ({
  useSessionClock: () => 1200,
  useWorkoutSession: () => ({
    state: {
      session: mock.active
        ? {
            status: "active",
            id: "session",
            activity: "Corrida",
            startedAt: "2026-10-20T01:00:00Z",
          }
        : null,
      serverNow: "2026-10-20T02:30:00Z",
    },
    busy: false,
    anchor: { current: 0 },
    refresh: mock.refresh,
  }),
}));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T02:30:00Z"));
  sessionStorage.clear();
  mock.refresh.mockReset().mockResolvedValue(true);
  mock.rest.mockReset().mockResolvedValue(true);
  mock.useKit.mockReset().mockResolvedValue(true);
  mock.getCurrent.mockImplementation(() => mock.training);
  mock.active = false;
  mock.serverRead = false;
  mock.acknowledgeAutomatic.mockReset().mockResolvedValue(true);
  mock.trained = false;
  mock.training = {
    revision: 1,
    today: "2026-10-19",
    startedOn: "2026-10-18",
    timezone: "America/Sao_Paulo",
    weeklyExtraLimit: 2,
    extraRests: [],
    medicalRests: [],
    plans: [
      {
        revision: 1,
        effectiveFrom: "2026-10-18",
        trainingDays: [1, 2, 3, 4, 5, 6, 7],
      },
    ],
  };
  mock.economy = {
    revision: 1,
    balance: 1234,
    kits: 2,
    today: "2026-10-19",
    timezone: "America/Sao_Paulo",
    kitsUsedThisWeek: 0,
    rules: {
      workoutReward: 10,
      weightReward: 2,
      kitPrice: 250,
      weeklyKitLimit: 2,
    },
    history: { entries: [], hasMore: false },
    protections: [],
  };
});
afterEach(() => vi.useRealTimers());
function mount(withHistory = true, completed = false) {
  const data = freshData();
  data.workouts = withHistory
    ? [
        {
          id: "previous",
          date: "2026-10-18",
          activity: "Corrida",
          minutes: 35,
          confirmedAt: "2026-10-18T12:00:00Z",
        },
      ]
    : [];
  if (completed)
    data.workouts.push({
      id: "today",
      date: "2026-10-19",
      activity: "Corrida",
      minutes: 35,
      confirmedAt: "2026-10-20T01:00:00Z",
    });
  localStorage.setItem(
    `${STORAGE_KEY}:account:protection-user`,
    JSON.stringify(data),
  );
  return render(<App />);
}
it("sugere kit após 23h, confirma as regras e só então consome pela operação existente", async () => {
  mount();
  const prompt = await screen.findByRole("dialog", {
    name: "Sua ofensiva ainda precisa de cuidado",
  });
  expect(prompt).toHaveTextContent("00:00");
  expect(mock.refresh).toHaveBeenCalledTimes(4);
  expect(mock.useKit).not.toHaveBeenCalled();
  await userEvent.click(
    within(prompt).getByRole("button", { name: "Usar Kit Médico" }),
  );
  expect(screen.getByRole("dialog", { name: "Kit Médico" })).toHaveTextContent(
    "não será devolvido",
  );
  await userEvent.click(screen.getByRole("button", { name: "Usar 1 kit" }));
  await waitFor(() =>
    expect(mock.useKit).toHaveBeenCalledExactlyOnceWith("2026-10-19"),
  );
  expect(mock.rest).not.toHaveBeenCalled();
});
it("permite descanso contextual, sem botões de proteção fixos nem consumo automático", async () => {
  mount();
  await screen.findByRole("dialog");
  const hero = screen.getByRole("region", { name: "Treino de hoje" });
  expect(
    within(hero).queryByRole("button", { name: /Descansar|kit/i }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Descansar hoje" }));
  expect(
    screen.getByRole("dialog", { name: "Descansar hoje?" }),
  ).toBeInTheDocument();
  expect(mock.rest).not.toHaveBeenCalled();
});
it("não repete após fechar e mostra CapiWhey no cabeçalho com o saldo real", async () => {
  const view = mount();
  await screen.findByRole("dialog");
  await userEvent.click(screen.getByRole("button", { name: "Agora não" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "1.234 CapiWhey · Ver loja e kits" }),
  ).toBeInTheDocument();
  view.unmount();
  mount();
  await actSettled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(mock.useKit).not.toHaveBeenCalled();
});
async function actSettled() {
  await waitFor(() =>
    expect(
      screen.getByRole("region", { name: "Treino de hoje" }),
    ).toBeInTheDocument(),
  );
}

it("mostra o kit já consumido pelo servidor e registra a leitura sem repetir nesta visita", async () => {
  vi.setSystemTime(new Date("2026-10-19T15:00:00Z"));
  const protection = { id: "auto-1", day: "2026-10-18", usedAt: "2026-10-19T03:00:01Z" };
  mock.economy!.automaticNotices = [protection];
  mock.economy!.protections = [protection];
  mock.serverRead = true;
  mount();
  const notice = await screen.findByRole("dialog", { name: "Kit Médico usado automaticamente" });
  expect(notice).toHaveTextContent("18 de outubro");
  expect(mock.useKit).not.toHaveBeenCalled();
  await userEvent.click(within(notice).getByRole("button", { name: "Entendi" }));
  expect(mock.acknowledgeAutomatic).toHaveBeenCalledExactlyOnceWith(["auto-1"]);
  await actSettled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("não anuncia consumo automático com base apenas no cache", async () => {
  vi.setSystemTime(new Date("2026-10-19T15:00:00Z"));
  mock.economy!.automaticNotices = [{ id: "cached", day: "2026-10-18", usedAt: "2026-10-19T03:00:01Z" }];
  mount();
  await actSettled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(mock.acknowledgeAutomatic).not.toHaveBeenCalled();
});
it.each([
  "daytime",
  "midnight",
  "no-streak",
  "completed",
  "rest",
  "extra",
  "kit",
  "rescheduled",
  "active",
  "no-benefits",
  "stale-day",
  "read-failed",
])("não sugere quando %s", async (state) => {
  if (state === "daytime") vi.setSystemTime(new Date("2026-10-20T01:59:00Z"));
  if (state === "midnight") vi.setSystemTime(new Date("2026-10-20T03:00:00Z"));
  if (state === "rest")
    mock.training!.plans[0].trainingDays = [2, 3, 4, 5, 6, 7];
  if (state === "extra") mock.training!.extraRests = ["2026-10-19"];
  if (state === "kit") mock.training!.medicalRests = ["2026-10-19"];
  if (state === "rescheduled")
    mock.training!.reschedules = [
      {
        id: "r",
        originalDay: "2026-10-19",
        targetDay: "2026-10-20",
        weekStart: "2026-10-19",
        createdAt: "2026-10-19T12:00:00Z",
        revision: 2,
      },
    ];
  if (state === "active") mock.active = true;
  if (state === "no-benefits") {
    mock.economy!.kits = 0;
    mock.training!.weeklyExtraLimit = 0;
  }
  if (state === "stale-day") mock.economy!.today = "2026-10-18";
  if (state === "read-failed") mock.refresh.mockResolvedValue(false);
  mount(state !== "no-streak", state === "completed");
  await actSettled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(mock.useKit).not.toHaveBeenCalled();
});
