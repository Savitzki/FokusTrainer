import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { freshData, STORAGE_KEY, type Workout } from "./model";
import type { TrainingState } from "./training";
import type { EconomyState } from "./economy";
import type { RecordingState } from "./workoutRecording";
vi.mock("./useMinimumLoading", () => ({
  useMinimumLoading: (pending: boolean) => pending,
}));
const m = vi.hoisted(() => ({
  training: null as TrainingState | null,
  economy: null as EconomyState | null,
  recording: null as RecordingState | null,
  refresh: vi.fn(),
  getCurrent: vi.fn(),
  useKit: vi.fn(),
  reschedule: vi.fn(),
  rest: vi.fn(),
  trainingError: "",
  economyError: "",
  workouts: [] as Workout[],
  anchor: { current: 0 },
}));
const account = vi.hoisted(() => ({
  configured: true,
  initializing: false,
  user: { id: "missed-user" } as { id: string } | null,
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
    state: m.training,
    enabled: true,
    busy: false,
    error: m.trainingError,
    refresh: m.refresh,
    getCurrent: m.getCurrent,
    save: vi.fn(),
    rest: m.rest,
    reschedule: m.reschedule,
  }),
}));
vi.mock("./useEconomy", () => ({
  useEconomy: () => ({
    state: m.economy,
    enabled: true,
    busy: false,
    error: m.economyError,
    refresh: m.refresh,
    notice: "",
    useKit: m.useKit,
  }),
}));
vi.mock("./social", () => ({
  deviceTimezone: () => "America/Sao_Paulo",
  useSocial: () => ({ state: null, busy: false, refresh: m.refresh }),
}));
vi.mock("./useWorkoutSession", () => ({
  useWorkoutSession: () => ({
    state: m.recording,
    anchor: m.anchor,
    busy: false,
    refresh: m.refresh,
  }),
  useSessionClock: () => 1200,
}));
beforeEach(() => {
  account.user = { id: "missed-user" };
  sessionStorage.clear();
  m.anchor.current = performance.now();
  m.getCurrent.mockImplementation(() => m.training);
  m.refresh.mockReset().mockResolvedValue(true);
  m.useKit.mockReset().mockResolvedValue(true);
  m.reschedule.mockReset().mockResolvedValue(true);
  m.rest.mockReset();
  m.trainingError = "";
  m.economyError = "";
  m.training = {
    revision: 1,
    today: "2026-10-20",
    timezone: "America/Sao_Paulo",
    startedOn: "2026-10-19",
    planRequired: false,
    legacyScheduleBefore: null,
    weeklyExtraLimit: 2,
    weeklyRescheduleLimit: 2,
    plans: [
      {
        revision: 1,
        effectiveFrom: "2026-10-19",
        trainingDays: [1, 2, 3, 4, 5],
      },
    ],
    extraRests: [],
    medicalRests: [],
    reschedules: [],
  };
  m.economy = {
    revision: 1,
    today: "2026-10-20",
    timezone: "America/Sao_Paulo",
    balance: 1000,
    kits: 2,
    kitsUsedThisWeek: 0,
    protections: [],
    monthlyKits: {
      month: "2026-10-01",
      renewsOn: "2026-11-01",
      allowance: 2,
      freeAvailable: 2,
      purchasedAvailable: 0,
    },
    rules: {
      kitPrice: 350,
      workoutReward: 10,
      weightReward: 2,
      weeklyKitLimit: 7,
      kitUsageLimit: "inventory",
    },
    history: { entries: [], hasMore: false },
  };
  m.recording = {
    today: "2026-10-20",
    timezone: "America/Sao_Paulo",
    serverNow: "2026-10-20T15:00:00Z",
    minimumMinutes: 35,
    maximumMinutes: 240,
    session: null,
  };
  m.workouts = [
    {
      id: "prior",
      date: "2026-10-19",
      activity: "Corrida",
      minutes: 35,
      confirmedAt: "2026-10-19T15:00:00Z",
    },
  ];
});
afterEach(() => vi.useRealTimers());
function mount() {
  const data = freshData();
  data.workouts = m.workouts;
  localStorage.setItem(
    `${STORAGE_KEY}:account:missed-user`,
    JSON.stringify(data),
  );
  return render(<App />);
}
async function open() {
  await userEvent.click(
    screen.getByRole("button", { name: "Não treinei hoje" }),
  );
  const modal = screen.getByRole("dialog", {
    name: "Não treinei hoje",
  });
  await within(modal).findByRole("button", { name: /^Usar Kit Médico/ });
  return modal;
}
function noWrites() {
  expect(m.useKit).not.toHaveBeenCalled();
  expect(m.rest).not.toHaveBeenCalled();
  expect(m.reschedule).not.toHaveBeenCalled();
}
it("coloca a ação discreta antes da principal, abre a cena sem operações e restaura o foco ao fechar no X", async () => {
  mount();
  const region = screen.getByRole("region", { name: "Treino de hoje" });
  const buttons = within(region).getAllByRole("button");
  expect(buttons.map((b) => b.textContent)).toEqual([
    "Não treinei hoje",
    "Registrar treino",
  ]);
  expect(buttons[0]).not.toHaveClass("primary-button");
  expect(buttons[1]).toHaveClass("primary-button");
  const modal = await open();
  expect(m.refresh).toHaveBeenCalledTimes(4);
  expect(
    within(modal).getByRole("heading", { name: "EU CONFIEI EM VC..." }),
  ).toBeVisible();
  expect(
    within(modal).getByText("Tudo bem, vai... ainda dá pra resolver isso."),
  ).toBeVisible();
  expect(modal.querySelector(".capibora-mascot")).toHaveAttribute(
    "src",
    "mascot/web/julgando.webp",
  );
  fireEvent(modal, new Event("cancel", { cancelable: true }));
  expect(modal).toBeInTheDocument();
  noWrites();
  await userEvent.click(
    within(modal).getByRole("button", { name: "Fechar janela" }),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(buttons[0]).toHaveFocus();
  noWrites();
  expect(screen.getByLabelText("1 dia de ofensiva")).toBeVisible();
});
it.each([
  "sem plano",
  "concluído",
  "descanso",
  "extra",
  "kit",
  "reagendado",
  "sessão ativa",
  "dia encerrado",
  "visitante",
])("não mostra a opção quando %s", (state) => {
  if (state === "sem plano") {
    m.training!.plans = [];
    m.training!.planRequired = true;
  }
  if (state === "concluído")
    m.workouts.push({ ...m.workouts[0], id: "today", date: "2026-10-20" });
  if (state === "descanso") m.training!.plans[0].trainingDays = [1, 3, 5];
  if (state === "extra") m.training!.extraRests = ["2026-10-20"];
  if (state === "kit") m.training!.medicalRests = ["2026-10-20"];
  if (state === "reagendado")
    m.training!.reschedules = [
      {
        id: "move",
        originalDay: "2026-10-20",
        targetDay: "2026-10-24",
        weekStart: "2026-10-19",
        createdAt: "2026-10-20T12:00Z",
        revision: 2,
      },
    ];
  if (state === "sessão ativa")
    m.recording!.session = {
      id: "active",
      activity: "Corrida",
      status: "active",
      startedAt: "2026-10-20T14:50Z",
      endedAt: null,
      validatedSeconds: null,
      minimumSeconds: 2100,
      maximumSeconds: 14400,
      workout: null,
    };
  if (state === "dia encerrado")
    m.recording!.serverNow = "2026-10-21T03:00:00Z";
  if (state === "visitante") account.user = null;
  mount();
  expect(screen.queryByRole("button", { name: "Não treinei hoje" })).toBeNull();
  noWrites();
});
it("exige confirmação e espera o servidor, bloqueia duplo clique e confirma o uso sem ganhar pontos ou moeda", async () => {
  mount();
  const modal = await open();
  await userEvent.click(
    within(modal).getByRole("button", { name: /^Usar Kit Médico/ }),
  );
  noWrites();
  let finish!: (saved: boolean) => void;
  m.useKit.mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  await userEvent.dblClick(
    within(modal).getByRole("button", { name: "Usar 1 kit" }),
  );
  expect(m.useKit).toHaveBeenCalledExactlyOnceWith("2026-10-20");
  expect(
    within(modal).getByRole("button", { name: "Fechar janela" }),
  ).toBeDisabled();
  expect(screen.queryByText("UFA...")).toBeNull();
  await act(async () => {
    m.economy!.kits = 1;
    m.economy!.protections = [
      { id: "used", day: "2026-10-20", usedAt: "2026-10-20T15:00Z" },
    ];
    m.training!.medicalRests = ["2026-10-20"];
    finish(true);
  });
  expect(await screen.findByText("UFA...")).toBeVisible();
  expect(m.economy!.balance).toBe(1000);
  expect(m.economy!.kits).toBe(1);
  expect(screen.getByLabelText("1 dia de ofensiva")).toBeInTheDocument();
  await userEvent.click(
    within(modal).getByRole("button", { name: "Continuar" }),
  );
  expect(screen.queryByRole("button", { name: "Não treinei hoje" })).toBeNull();
  expect(m.rest).not.toHaveBeenCalled();
  expect(m.reschedule).not.toHaveBeenCalled();
});
it("não anuncia sucesso após falha de rede e permite repetir a mesma confirmação existente", async () => {
  mount();
  const modal = await open();
  await userEvent.click(
    within(modal).getByRole("button", { name: /^Usar Kit Médico/ }),
  );
  m.useKit.mockImplementationOnce(async () => {
    m.economyError = "Falha de rede";
    return false;
  });
  await userEvent.click(
    within(modal).getByRole("button", { name: "Usar 1 kit" }),
  );
  expect(await screen.findByText("Falha de rede")).toBeVisible();
  expect(screen.queryByText("UFA...")).toBeNull();
  expect(m.economy!.kits).toBe(2);
  await userEvent.click(
    within(modal).getByRole("button", { name: "Usar 1 kit" }),
  );
  expect(await screen.findByText("UFA...")).toBeVisible();
  expect(m.useKit).toHaveBeenCalledTimes(2);
});
it("sem kit mostra indisponibilidade e abre a Loja na seção de kits, sem compra automática", async () => {
  m.economy!.kits = 0;
  mount();
  await userEvent.click(
    screen.getByRole("button", { name: "Não treinei hoje" }),
  );
  const modal = screen.getByRole("dialog");
  await within(modal).findByText("Nenhum kit disponível");
  expect(
    within(modal).queryByRole("button", { name: /^Usar Kit Médico/ }),
  ).toBeNull();
  await userEvent.click(
    within(modal).getByRole("button", { name: /Ver kits na Loja/ }),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("heading", { name: "Loja" })).toBeVisible();
  expect(location.hash).toContain("secao=kits");
  noWrites();
});
it("reutiliza a seleção de reagendamento e só reage depois da troca confirmada", async () => {
  mount();
  const modal = await open();
  await userEvent.click(
    within(modal).getByRole("button", {
      name: "Reagendar treino",
    }),
  );
  expect(m.reschedule).not.toHaveBeenCalled();
  expect(within(modal).getAllByRole("radio")).toHaveLength(2);
  await userEvent.click(within(modal).getByRole("radio", { name: /sábado/ }));
  m.reschedule.mockImplementation(
    async (originalDay: string, targetDay: string) => {
      m.training!.reschedules = [
        {
          id: "move",
          originalDay,
          targetDay,
          weekStart: "2026-10-19",
          createdAt: "2026-10-20T15:00Z",
          revision: 2,
        },
      ];
      return true;
    },
  );
  await userEvent.click(
    within(modal).getByRole("button", { name: "Confirmar troca" }),
  );
  expect(m.reschedule).toHaveBeenCalledExactlyOnceWith(
    "2026-10-20",
    "2026-10-24",
  );
  expect(await screen.findByText("Tá bom...")).toBeVisible();
  expect(m.economy!.balance).toBe(1000);
  expect(m.useKit).not.toHaveBeenCalled();
  expect(m.rest).not.toHaveBeenCalled();
});
it("aceitar a falta é confirmação informativa: não grava falta, não consome kit e não interrompe antecipadamente a ofensiva", async () => {
  mount();
  const modal = await open();
  const saved = localStorage.getItem(`${STORAGE_KEY}:account:missed-user`);
  await userEvent.click(
    within(modal).getByRole("button", { name: "Aceitar a falta de hoje" }),
  );
  expect(
    within(modal).getByText(/uso automático continua ativo/),
  ).toBeVisible();
  expect(
    within(modal).getByText(/Nenhum treino ou falta será registrado agora/),
  ).toBeVisible();
  noWrites();
  await userEvent.click(
    within(modal).getByRole("button", { name: "Confirmar e fechar" }),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText(/^Nenhuma falta foi registrada/)).toBeVisible();
  expect(localStorage.getItem(`${STORAGE_KEY}:account:missed-user`)).toBe(
    saved,
  );
  expect(m.economy!.kits).toBe(2);
  expect(screen.getByLabelText("1 dia de ofensiva")).toBeVisible();
  noWrites();
});
it("uma proteção concorrente torna o modal informativo e impede novo consumo", async () => {
  const view = mount();
  const modal = await open();
  await userEvent.click(
    within(modal).getByRole("button", { name: /^Usar Kit Médico/ }),
  );
  m.training!.medicalRests = ["2026-10-20"];
  view.rerender(<App />);
  expect(within(modal).getByText(/não está mais pendente/)).toBeVisible();
  expect(
    within(modal).queryByRole("button", { name: "Usar 1 kit" }),
  ).toBeNull();
  noWrites();
});
it("uma falha de atualização não libera operações baseadas no cache; pode fechar sem consequências", async () => {
  m.refresh.mockResolvedValue(false);
  mount();
  await userEvent.click(
    screen.getByRole("button", { name: "Não treinei hoje" }),
  );
  const modal = screen.getByRole("dialog");
  await within(modal).findByRole("alert");
  expect(
    within(modal).queryByRole("button", { name: /^Usar Kit Médico/ }),
  ).toBeNull();
  await userEvent.click(
    within(modal).getByRole("button", { name: "Fechar janela" }),
  );
  noWrites();
});
it("não apresenta botão de Pausa de rotina e uma troca de conta remove o conteúdo privado", async () => {
  const view = mount();
  const modal = await open();
  expect(within(modal).getByText(/ainda está em planejamento/)).toBeVisible();
  expect(within(modal).queryByRole("button", { name: /pausa/i })).toBeNull();
  account.user = null;
  view.rerender(<App />);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.queryByText("EU CONFIEI EM VC...")).toBeNull();
  noWrites();
});

it("a virada do dia não transfere uma confirmação antiga para o novo dia", async () => {
  const view = mount(),
    modal = await open();
  await userEvent.click(
    within(modal).getByRole("button", { name: /^Usar Kit Médico/ }),
  );
  m.training!.today = "2026-10-21";
  m.economy!.today = "2026-10-21";
  m.recording!.today = "2026-10-21";
  m.recording!.serverNow = "2026-10-21T15:00:00Z";
  view.rerender(<App />);
  expect(within(modal).getByText(/O dia mudou/)).toBeVisible();
  expect(
    within(modal).queryByRole("button", { name: "Usar 1 kit" }),
  ).toBeNull();
  noWrites();
});
it("fechar durante a leitura não dispara operações quando a resposta chega", async () => {
  let finish!: (ok: boolean) => void;
  const waiting = new Promise<boolean>((resolve) => {
    finish = resolve;
  });
  m.refresh.mockReturnValue(waiting);
  mount();
  await userEvent.click(
    screen.getByRole("button", { name: "Não treinei hoje" }),
  );
  const modal = screen.getByRole("dialog");
  expect(within(modal).getByRole("status")).toHaveTextContent("Consultando");
  await userEvent.click(
    within(modal).getByRole("button", { name: "Fechar janela" }),
  );
  await act(async () => finish(true));
  expect(screen.queryByRole("dialog")).toBeNull();
  noWrites();
});
it("sem descanso futuro não oferece uma operação de reagendamento impossível", async () => {
  m.training!.plans[0].trainingDays = [1, 2, 3, 4, 5, 6, 7];
  mount();
  const modal = await open();
  expect(
    within(modal).getByText(
      "Não há descanso posterior disponível nesta semana",
    ),
  ).toBeVisible();
  expect(
    within(modal).queryByRole("button", { name: "Reagendar treino" }),
  ).toBeNull();
  noWrites();
});

it("não empilha a sugestão opcional das 23h após visitar esta tela, sem desativar o kit automático", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date("2026-10-21T01:59:50Z"));
  m.recording!.serverNow = "2026-10-21T01:59:50Z";
  mount();
  const modal = await open();
  await userEvent.click(
    within(modal).getByRole("button", { name: "Fechar janela" }),
  );
  await act(async () => {
    vi.advanceTimersByTime(20000);
  });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(m.refresh).toHaveBeenCalledTimes(4);
  expect(m.economy!.kits).toBe(2);
  expect(m.economy!.rules.kitUsageLimit).toBe("inventory");
  noWrites();
});
