import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { freshData, localDate, STORAGE_KEY, type Workout } from "./model";
import App from "./App";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  send: vi.fn(),
  workouts: [] as Workout[],
}));
const account = vi.hoisted(() => ({
  user: { id: "me" },
  configured: true,
  initializing: false,
  profileLoading: false,
  profileChecked: true,
  profile: {
    nickname: "Dani",
    style: "initials",
    color: "orange",
    photo: null,
  },
}));
vi.mock("./account", () => ({ useAccount: () => account }));
vi.mock("./backend", () => ({ backendRpc: mocks.rpc, accountConfigured: false }));
vi.mock("./groupNotifications", () => ({ sendGroupWorkoutNotice: mocks.send }));
beforeEach(() => {
  mocks.workouts = [];
  mocks.send.mockReset();
  mocks.rpc.mockReset();
  mocks.rpc.mockImplementation(async (name, args) => {
    if (name === "confirm_daily_workout") {
      mocks.workouts = [
        {
          id: "server-id",
          date: args.p_day,
          activity: args.p_activity,
          minutes: args.p_minutes,
          confirmedAt: new Date().toISOString(),
        },
      ];
      return null;
    }
    if (name === "sync_weights") return { records: [], applied: [] };
    return {
      code: "code",
      workouts: mocks.workouts,
      friends: [],
      requests: [],
      groups: [
        {
          id: "group",
          name: "Time",
          status: "active",
          timezone: "UTC",
          today: localDate(),
          members: [
            { id: "me", nickname: "Dani", accepted: true, trained: false },
            { id: "friend", nickname: "Bia", accepted: true, trained: false },
          ],
        },
      ],
    };
  });
});
it("oferece o aviso somente após um treino novo e respeita a decisão Agora não", async () => {
  const user = userEvent.setup();
  const view = render(<App />);
  await waitFor(() =>
    expect(mocks.rpc).toHaveBeenCalledWith("get_social_state"),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Registrar treino" }));
  await user.type(screen.getByLabelText("Duração (minutos)"), "30");
  await user.click(screen.getByRole("button", { name: "Confirmar treino" }));
  expect(
    await screen.findByRole("dialog", { name: "Avisar o time?" }),
  ).toBeInTheDocument();
  expect(mocks.send).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Agora não" }));
  fireEvent(window, new Event("online"));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  view.unmount();
  render(<App />);
  await screen.findByRole("button", { name: "Treino de hoje concluído" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(mocks.send).not.toHaveBeenCalled();
});
it("não oferece nem envia avisos ao recuperar um treino de outro aparelho", async () => {
  mocks.workouts = [
    {
      id: "remote",
      date: localDate(),
      activity: "Bike",
      minutes: 30,
      confirmedAt: new Date().toISOString(),
    },
  ];
  const data = freshData();
  localStorage.setItem(`${STORAGE_KEY}:account:me`, JSON.stringify(data));
  render(<App />);
  await screen.findByRole("button", { name: "Treino de hoje concluído" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(mocks.send).not.toHaveBeenCalled();
});
