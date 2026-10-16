import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { localDate, shiftDate, type Workout } from "./model";
import { useSocial, type SocialState } from "./social";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("./backend", () => ({ backendRpc: rpc }));
const empty: SocialState = {
  code: "code",
  workouts: [],
  friends: [],
  requests: [],
  groups: [],
};
beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(async (name) =>
    name === "get_social_state" ? empty : null,
  );
});

it("mantém o modo sem conta completamente local", () => {
  renderHook(() => useSocial(false, [], vi.fn()));
  expect(rpc).not.toHaveBeenCalled();
});
it("só confirma um convite ao formulário quando o servidor aceita a ação", async () => {
  const { result } = renderHook(() => useSocial(true, [], vi.fn()));
  await waitFor(() => expect(result.current.state).not.toBeNull());
  rpc.mockRejectedValueOnce(new Error("Sem conexão"));
  let sent: boolean | undefined;
  await act(async () => {
    sent = await result.current.act("send_friend_request", { p_code: "code" });
  });
  expect(sent).toBe(false);
  expect(result.current.error).toBe("Sem conexão");
  await act(async () => {
    sent = await result.current.act("send_friend_request", { p_code: "code" });
  });
  expect(sent).toBe(true);
  expect(result.current.error).toBe("");
});
it("sincroniza somente o treino de hoje e recupera os registros online", async () => {
  const old: Workout = {
    id: "old",
    date: shiftDate(localDate(), -1),
    activity: "Bike",
    minutes: 20,
  };
  const today: Workout = {
    id: "today",
    date: localDate(),
    activity: "Corrida",
    minutes: 30,
  };
  const onRemote = vi.fn();
  const { result, rerender } = renderHook(
    ({ workouts }) => useSocial(true, workouts, onRemote),
    { initialProps: { workouts: [old] } },
  );
  await waitFor(() => expect(onRemote).toHaveBeenCalledWith([]));
  expect(rpc).not.toHaveBeenCalledWith(
    "confirm_daily_workout",
    expect.anything(),
  );
  rerender({ workouts: [old, today] });
  await waitFor(() =>
    expect(rpc).toHaveBeenCalledWith(
      "confirm_daily_workout",
      expect.objectContaining({ p_day: today.date, p_minutes: 30 }),
    ),
  );
  await waitFor(() => expect(result.current.busy).toBe(false));
});
it("preserva o treino local quando a sincronização falha e tenta novamente ao reconectar", async () => {
  const today: Workout = {
    id: "today",
    date: localDate(),
    activity: "Treino",
    minutes: 10,
  };
  rpc.mockRejectedValueOnce(new Error("Sem conexão"));
  const onRemote = vi.fn();
  const { result } = renderHook(() => useSocial(true, [today], onRemote));
  await waitFor(() => expect(result.current.error).toBe("Sem conexão"));
  expect(onRemote).not.toHaveBeenCalled();
  await act(async () => {
    window.dispatchEvent(new Event("online"));
  });
  await waitFor(() => expect(result.current.error).toBe(""));
  expect(onRemote).toHaveBeenCalledWith([]);
  expect(today.minutes).toBe(10);
});
