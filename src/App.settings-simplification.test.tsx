import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "./model";
import App from "./App";
const push = vi.hoisted(() => ({ supported: vi.fn(), enable: vi.fn() }));
vi.mock("./push", () => ({
  pushPublicKey: "configured",
  pushSupported: push.supported,
  enablePush: push.enable,
  disablePush: vi.fn(),
}));
vi.mock("./account", () => ({
  useAccount: () => ({
    user: { id: "settings-a" },
    configured: true,
    initializing: false,
    profileChecked: true,
    profileLoading: false,
    profileError: "",
    profile: {
      nickname: "Dani",
      style: "initials",
      color: "orange",
      photo: null,
    },
  }),
}));
vi.mock("./backend", () => ({
  accountConfigured: false,
  backendRpc: async (name: string) =>
    name === "get_social_state"
      ? { code: "code", workouts: [], friends: [], requests: [], groups: [] }
      : name === "sync_weight_entries"
        ? { records: [], applied: [] }
        : {
            serverNow: "2026-10-17T12:00:00Z",
            today: "2026-10-17",
            timezone: "UTC",
            minimumMinutes: 35,
            maximumMinutes: 240,
            session: null,
          },
}));
beforeEach(() => {
  push.supported.mockReturnValue(true);
  push.enable.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", {
    onLine: true,
    serviceWorker: {
      getRegistration: vi
        .fn()
        .mockResolvedValue({
          pushManager: { getSubscription: vi.fn().mockResolvedValue(null) },
        }),
    },
  });
  vi.stubGlobal("Notification", { permission: "granted" });
  window.history.replaceState(null, "", "/#/configuracoes");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("separa os horários locais do push e mantém os dois editáveis sem redefinir preferências", async () => {
  const user = userEvent.setup();
  render(<App />);
  const local = document.querySelector(".local-reminders")!;
  expect(local).not.toHaveAttribute("open");
  await user.selectOptions(screen.getByLabelText("Horário dos avisos"), "19");
  await user.click(
    screen.getByRole("button", { name: "Ativar avisos neste aparelho" }),
  );
  expect(push.enable).toHaveBeenCalledExactlyOnceWith({
    hour: 19,
    tone: "gentle",
  });
  await user.click(screen.getByText("Lembretes com o app aberto"));
  fireEvent.change(screen.getByLabelText("Horário: treino"), {
    target: { value: "23:59" },
  });
  await user.click(screen.getByRole("switch", { name: "Lembrete de treino" }));
  expect(
    JSON.parse(localStorage.getItem(`${STORAGE_KEY}:account:settings-a`)!)
      .reminders[0],
  ).toMatchObject({ time: "23:59", enabled: true });
  expect(JSON.parse(localStorage.getItem("fokus-push:settings-a")!)).toEqual({
    hour: 19,
    tone: "gentle",
  });
});
it("mostra os lembretes locais diretamente quando o aparelho não oferece push", () => {
  push.supported.mockReturnValue(false);
  render(<App />);
  expect(document.querySelector(".local-reminders")).toHaveAttribute("open");
  expect(screen.getByLabelText("Horário: treino")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Ativar avisos neste aparelho" }),
  ).not.toBeInTheDocument();
});
