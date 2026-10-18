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
vi.mock("./backend", () => ({
  backendRpc: mocks.rpc,
  accountConfigured: false,
}));
vi.mock("./groupNotifications", () => ({ sendGroupWorkoutNotice: mocks.send }));
beforeEach(() => {
  Object.defineProperty(navigator, "onLine", {
    value: true,
    configurable: true,
  });
  mocks.workouts = [];
  mocks.send.mockReset();
  mocks.rpc.mockReset();
  mocks.rpc.mockImplementation(async (name, args) => {
    if (name === "confirm_manual_workout") {
      mocks.workouts = [
        {
          id: "server-id",
          date: args.p_day,
          activity: args.p_activity,
          minutes: args.p_minutes,
          confirmedAt: new Date().toISOString(),
        },
      ];
      return mocks.workouts[0];
    }
    if (name === "get_workout_recording_state")
      return {
        serverNow: new Date().toISOString(),
        today: localDate(),
        timezone: "UTC",
        minimumMinutes: 35,
        maximumMinutes: 240,
        session: null,
      };
    if (name === "sync_weight_entries") return { records: [], applied: [] };
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
  await user.click(
    screen.getByRole("button", { name: /Registrar manualmente/ }),
  );
  await user.type(screen.getByLabelText("Duração (minutos)"), "35");
  await user.click(screen.getByRole("button", { name: "3 Moderado" }));
  await user.click(screen.getByRole("button", { name: "Normal" }));
  await user.click(
    screen.getByRole("button", { name: "Sim, fiz tudo que pretendia" }),
  );
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
it("guarda o manual offline sem acender a chama e só oferece o aviso depois da confirmação online", async () => {
  const user = userEvent.setup();
  let view = render(<App />);
  await waitFor(() =>
    expect(mocks.rpc).toHaveBeenCalledWith("get_social_state"),
  );
  Object.defineProperty(navigator, "onLine", {
    value: false,
    configurable: true,
  });
  await user.click(screen.getByRole("button", { name: "Registrar treino" }));
  await user.click(
    screen.getByRole("button", { name: /Registrar manualmente/ }),
  );
  await user.type(screen.getByLabelText("Duração (minutos)"), "35");
  await user.click(screen.getByRole("button", { name: "3 Moderado" }));
  await user.click(screen.getByRole("button", { name: "Normal" }));
  await user.click(
    screen.getByRole("button", { name: "Sim, fiz tudo que pretendia" }),
  );
  await user.click(screen.getByRole("button", { name: "Confirmar treino" }));
  expect(
    await screen.findByText("Treino aguardando conexão"),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("0 dias de ofensiva")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(mocks.rpc).not.toHaveBeenCalledWith(
    "confirm_manual_workout",
    expect.anything(),
  );
  expect(
    JSON.parse(localStorage.getItem(`${STORAGE_KEY}:account:me`)!).workouts[0]
      .confirmedAt,
  ).toBeUndefined();
  view.unmount();
  view = render(<App />);
  expect(screen.getByText("Treino aguardando conexão")).toBeInTheDocument();
  Object.defineProperty(navigator, "onLine", {
    value: true,
    configurable: true,
  });
  fireEvent(window, new Event("online"));
  expect(
    await screen.findByRole("dialog", { name: "Avisar o time?" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /Chama acesa/ })).toBeInTheDocument();
  expect(mocks.send).not.toHaveBeenCalled();
  view.unmount();
});
