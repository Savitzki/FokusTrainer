import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import App from "./App";
// The real opening duration is covered in startupScreen.test.tsx.
vi.mock("./useMinimumLoading", () => ({
  useMinimumLoading: (pending: boolean) => pending,
}));
import { localDate } from "./model";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("./backend", () => ({ accountConfigured: false, backendRpc: rpc }));
vi.mock("./account", () => ({
  useAccount: () => ({
    configured: true,
    initializing: false,
    user: { id: "session-navigation" },
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
beforeEach(() => {
  rpc.mockReset().mockImplementation(async (name: string) => {
    if (name === "get_social_state")
      return {
        code: "mock",
        workouts: [],
        friends: [],
        requests: [],
        groups: [],
      };
    if (name === "sync_weight_entries") return { records: [], applied: [] };
    if (name === "get_workout_recording_state")
      return {
        serverNow: `${localDate()}T12:20:00Z`,
        today: localDate(),
        timezone: "UTC",
        minimumMinutes: 35,
        maximumMinutes: 240,
        session: {
          id: "active-server-session",
          activity: "Caminhada",
          startedAt: `${localDate()}T12:00:00Z`,
          endedAt: null,
          validatedSeconds: null,
          minimumSeconds: 2100,
          maximumSeconds: 14400,
          status: "active",
          workout: null,
        },
      };
    throw new Error(`Unexpected operation ${name}`);
  });
});
it("retoma a mesma sessão em qualquer aba sem criar, cancelar ou confirmar ao navegar", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("button", { name: /Voltar ao treino/ });
  for (const page of [
    "Treinos",
    "Arena",
    "Peso",
    "Loja",
    "Configurações",
    "Início",
  ]) {
    await user.click(screen.getByRole("link", { name: page }));
    expect(
      await screen.findByRole("button", { name: /Voltar ao treino/ }),
    ).toBeVisible();
  }
  await user.click(screen.getByRole("link", { name: "Treinos" }));
  await user.click(screen.getByRole("button", { name: /Voltar ao treino/ }));
  await waitFor(() =>
    expect(window.location.hash).toBe("#/treino-em-andamento"),
  );
  expect(
    screen.getByRole("heading", { name: "Treino em andamento" }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Finalizar treino" }),
  ).toBeDisabled();
  expect(
    rpc.mock.calls.some(([name]) =>
      [
        "start_workout_session",
        "cancel_workout_session",
        "finish_workout_session",
      ].includes(name),
    ),
  ).toBe(false);
});
