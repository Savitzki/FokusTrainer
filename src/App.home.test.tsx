import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { freshData, STORAGE_KEY, type Workout } from "./model";
import type { TrainingState } from "./training";

const mocks = vi.hoisted(() => ({
  state: null as TrainingState | null,
  workouts: [] as Workout[],
  refresh: vi.fn().mockResolvedValue(true),
  getCurrent: vi.fn(),
}));
const account = vi.hoisted(() => ({
  user: { id: "home-user" },
  configured: true,
  initializing: false,
  profileChecked: true,
  profileLoading: false,
  profile: {
    nickname: "Dani",
    style: "initials",
    color: "orange",
    photo: null,
  },
}));
vi.mock("./account", () => ({ useAccount: () => account }));
vi.mock("./useTrainingPlan", () => ({
  useTrainingPlan: () => ({
    state: mocks.state,
    enabled: true,
    busy: false,
    error: "",
    refresh: mocks.refresh,
    getCurrent: mocks.getCurrent,
  }),
}));
vi.mock("./backend", () => ({
  accountConfigured: false,
  backendRpc: async (name: string) => {
    if (name === "get_social_state")
      return {
        code: "code",
        workouts: mocks.workouts,
        friends: [],
        requests: [],
        groups: [],
      };
    if (name === "sync_weight_entries") return { records: [], applied: [] };
    return {
      serverNow: "2026-10-14T13:17:00Z",
      today: mocks.state!.today,
      timezone: "America/Sao_Paulo",
      minimumMinutes: 35,
      maximumMinutes: 240,
      session: null,
    };
  },
}));
beforeEach(() => {
  mocks.state = {
    revision: 1,
    today: "2026-10-14",
    startedOn: "2026-10-12",
    timezone: "America/Sao_Paulo",
    weeklyExtraLimit: 2,
    extraRests: [],
    medicalRests: [],
    plans: [
      {
        revision: 1,
        effectiveFrom: "2026-10-12",
        trainingDays: [1, 2, 3, 4, 5],
      },
    ],
  };
  mocks.workouts = [];
  mocks.getCurrent.mockImplementation(() => mocks.state);
});
function mount(trained = false) {
  if (trained)
    mocks.workouts = [
      {
        id: "confirmed",
        date: mocks.state!.today,
        activity: "Corrida",
        minutes: 45,
        confirmedAt: `${mocks.state!.today}T13:17:00Z`,
      },
    ];
  const data = freshData();
  data.workouts = mocks.workouts;
  localStorage.setItem(
    `${STORAGE_KEY}:account:home-user`,
    JSON.stringify(data),
  );
  return render(<App />);
}
it("mantém o incentivo, a chama apagada e as proteções no treino obrigatório pendente", () => {
  mount();
  const hero = screen.getByRole("region", { name: "Treino de hoje" });
  expect(
    within(hero).getByRole("button", { name: "Registrar treino" }),
  ).toBeEnabled();
  expect(
    within(hero).getByRole("button", { name: /Descansar hoje/ }),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole("region", { name: "Sua ofensiva" })).getByRole(
      "img",
    ),
  ).toHaveAccessibleName(/Chama apagada/);
  expect(hero.querySelector("time")).toBeNull();
  expect(screen.getByLabelText("0 dias de ofensiva")).toBeInTheDocument();
});
it("aproxima o horário do status, respeita o fuso da conta e mantém a chama acesa", () => {
  mount(true);
  const status = screen.getByRole("button", {
    name: "Treino de hoje concluído",
  });
  expect(status).toBeDisabled();
  expect(status).toHaveTextContent("Treino registrado às 10:17");
  expect(status.querySelector("time")).toHaveAttribute(
    "datetime",
    "2026-10-14T13:17:00Z",
  );
  expect(screen.getByLabelText("1 dia de ofensiva")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /Chama acesa/ })).toBeInTheDocument();
});
it.each([false, true])(
  "diferencia descanso programado com treino voluntário=%s sem somar pontos",
  (trained) => {
    mocks.state!.today = "2026-10-17";
    mount(trained);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      trained
        ? "Treino extra. Tá pago."
        : /Hoje pode\.|Descansa\.|Tá liberado\./,
    );
    expect(
      screen.getByText(
        trained ? "Você treinou no seu descanso" : "Descanso programado",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        trained
          ? "Ofensiva protegida · sem pontos extras"
          : "Sua ofensiva está protegida",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("0 dias de ofensiva")).toBeInTheDocument();
    if (!trained)
      expect(
        within(screen.getByRole("region", { name: "Sua ofensiva" })).getByRole(
          "img",
        ),
      ).toHaveAccessibleName("Dia de descanso: sua ofensiva está protegida");
    if (trained) {
      expect(
        screen.getByRole("button", { name: "Treino de hoje concluído" }),
      ).toHaveTextContent("Treino voluntário registrado às 10:17");
      expect(
        screen.getByRole("group", { name: /^Dias ativos: 1 dia/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("progressbar", {
          name: "Treinos concluídos na semana",
        }),
      ).toHaveAttribute("value", "0");
    }
  },
);
it.each([
  ["extra", "Descanso extra", "Hoje é pausa."],
  ["kit", "Kit Médico usado", "Hoje é pausa."],
  ["moved", "Descanso por reagendamento", "Hoje ficou livre."],
] as const)(
  "mostra a proteção real de %s sem horário de treino",
  (kind, label, heading) => {
    if (kind === "extra") mocks.state!.extraRests = [mocks.state!.today];
    if (kind === "kit") mocks.state!.medicalRests = [mocks.state!.today];
    if (kind === "moved")
      mocks.state!.reschedules = [
        {
          id: "move",
          originalDay: "2026-10-14",
          targetDay: "2026-10-17",
          weekStart: "2026-10-12",
          createdAt: "2026-10-14T10:00:00Z",
          revision: 2,
        },
      ];
    mount();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      heading,
    );
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText("Sua ofensiva está protegida")).toBeInTheDocument();
    expect(
      screen
        .getByRole("region", { name: "Sua ofensiva" })
        .querySelector("time"),
    ).toBeNull();
  },
);
it("identifica o treino compensatório e mantém peso vazio e o período do tempo total", () => {
  mocks.state!.today = "2026-10-17";
  mocks.state!.reschedules = [
    {
      id: "move",
      originalDay: "2026-10-14",
      targetDay: "2026-10-17",
      weekStart: "2026-10-12",
      createdAt: "2026-10-14T10:00:00Z",
      revision: 2,
    },
  ];
  mount();
  expect(screen.getByText("Treino compensatório")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Registrar treino" }),
  ).toBeEnabled();
  expect(
    screen.getByRole("group", { name: /^Peso: — kg. Último peso registrado/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("group", {
      name: /^Tempo treinado: 0 min. Tempo total de todos/,
    }),
  ).toBeInTheDocument();
});

it("prioriza a mascote e a frase e coloca a ofensiva antes da semana", () => {
  mount();
  const hero = screen.getByRole("region", { name: "Treino de hoje" });
  expect(hero.querySelector(".capibora-mascot")).toHaveAttribute(
    "width",
    "136",
  );
  expect(hero.querySelector(".today-card-heading")).toBeNull();
  const streak = screen.getByRole("region", { name: "Sua ofensiva" });
  const week = screen.getByRole("region", { name: "Progresso da semana" });
  expect(
    streak.compareDocumentPosition(week) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
