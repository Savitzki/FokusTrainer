import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { freshData, STORAGE_KEY } from "./model";
const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  getCurrent: vi.fn(),
  notify: vi.fn(),
  state: {
    revision: 1,
    today: "2026-10-19",
    startedOn: "2026-10-12",
    timezone: "UTC",
    weeklyExtraLimit: 2,
    plans: [
      {
        revision: 1,
        effectiveFrom: "2026-10-12",
        trainingDays: [1, 2, 3, 4, 5],
      },
    ],
    extraRests: [],
  },
}));
vi.mock("./account", () => ({
  useAccount: () => ({
    user: { id: "reminder-user" },
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
  }),
}));
vi.mock("./useTrainingPlan", () => ({
  useTrainingPlan: () => ({
    state: mocks.state,
    enabled: true,
    busy: false,
    error: "",
    getCurrent: mocks.getCurrent,
  }),
}));
vi.mock("./useNotificationOnboarding", () => ({
  useNotificationOnboarding: () => ({ prompt: false, allowed: true }),
}));
vi.mock("./reminders", () => ({ claimReminder: mocks.claim }));
vi.mock("./notifications", () => ({
  notificationSupported: () => false,
  notify: mocks.notify,
}));
vi.mock("./backend", () => ({
  accountConfigured: false,
  backendRpc: async (name: string) =>
    name === "get_social_state"
      ? { code: "code", workouts: [], friends: [], requests: [], groups: [] }
      : name === "sync_weight_entries"
        ? { records: [], applied: [] }
        : {
            serverNow: "2026-10-19T17:05:00Z",
            today: "2026-10-19",
            timezone: "UTC",
            minimumMinutes: 35,
            maximumMinutes: 240,
            session: null,
          },
}));
const copy = {
  id: "afternoon-today",
  title: "Vai hoje ou não?",
  body: "Seu treino tá no plano",
  day: "2026-10-19",
  tag: "fokus-2026-10-19-reminder",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T17:05:00Z"));
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });
  Object.defineProperty(navigator, "onLine", {
    value: true,
    configurable: true,
  });
  const data = freshData();
  data.reminders[0] = {
    id: "workout",
    time: "17:00",
    enabled: true,
    lastSent: null,
  };
  localStorage.setItem(
    `${STORAGE_KEY}:account:reminder-user`,
    JSON.stringify(data),
  );
  mocks.getCurrent.mockImplementation(() => mocks.state);
  mocks.claim.mockResolvedValue(copy);
  mocks.notify.mockResolvedValue(true);
});
afterEach(() => vi.useRealTimers());
it("apresenta uma única notificação de sistema, sem repetir a mesma mensagem em toast", async () => {
  render(<App />);
  await waitFor(() => expect(mocks.notify).toHaveBeenCalledOnce());
  expect(mocks.notify).toHaveBeenCalledWith(
    copy.title,
    copy.body,
    copy.tag,
    expect.any(Function),
  );
  expect(
    screen.queryByText(`${copy.title} — ${copy.body}`),
  ).not.toBeInTheDocument();
  fireEvent(document, new Event("visibilitychange"));
  fireEvent(document, new Event("visibilitychange"));
  await act(async () => {});
  expect(mocks.claim).toHaveBeenCalledOnce();
});
it("utiliza o aviso no app somente quando a notificação de sistema não está disponível", async () => {
  mocks.notify.mockResolvedValue(false);
  render(<App />);
  expect(
    await screen.findByText(`${copy.title} — ${copy.body}`),
  ).toBeInTheDocument();
  expect(mocks.notify).toHaveBeenCalledOnce();
});
it("não emite cobranças negadas pelo servidor e não consulta repetidamente o mesmo evento", async () => {
  mocks.claim.mockResolvedValue(null);
  render(<App />);
  await waitFor(() => expect(mocks.claim).toHaveBeenCalledOnce());
  fireEvent(document, new Event("visibilitychange"));
  await act(async () => {});
  expect(mocks.claim).toHaveBeenCalledOnce();
  expect(mocks.notify).not.toHaveBeenCalled();
});
it("ignora resposta atrasada após sair da tela ou da conta", async () => {
  let resolve!: (value: typeof copy) => void;
  mocks.claim.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const view = render(<App />);
  await waitFor(() => expect(mocks.claim).toHaveBeenCalledOnce());
  view.unmount();
  await act(async () => resolve(copy));
  expect(mocks.notify).not.toHaveBeenCalled();
});
it("aguarda conexão e retoma a checagem ao reabrir a PWA", async () => {
  Object.defineProperty(navigator, "onLine", {
    value: false,
    configurable: true,
  });
  render(<App />);
  await act(async () => {});
  expect(mocks.claim).not.toHaveBeenCalled();
  Object.defineProperty(navigator, "onLine", {
    value: true,
    configurable: true,
  });
  fireEvent(document, new Event("visibilitychange"));
  await waitFor(() => expect(mocks.notify).toHaveBeenCalledOnce());
});
