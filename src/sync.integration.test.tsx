import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useTrainingPlan } from "./useTrainingPlan";
import { useEconomy } from "./useEconomy";
import { useGamification } from "./useGamification";
import { useSocial, type SocialState } from "./social";
import { notifySyncWrite } from "./sync";
import { trainingStreak } from "./training";
import type { TrainingState } from "./training";
import type { EconomyState } from "./economy";
import type { GameState } from "./gamification";
import { STORAGE_KEY, type Workout } from "./model";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("./backend", () => ({ accountConfigured: true, backendRpc: rpc }));
let training: TrainingState,
  wallet: EconomyState,
  game: GameState,
  social: SocialState;
beforeEach(() => {
  rpc.mockReset();
  training = {
    revision: 1,
    today: "2026-10-16",
    timezone: "UTC",
    startedOn: "2026-10-12",
    weeklyExtraLimit: 2,
    plans: [
      {
        revision: 1,
        effectiveFrom: "2026-10-12",
        trainingDays: [1, 2, 3, 4, 5],
      },
    ],
    extraRests: [],
  };
  wallet = {
    revision: 1,
    today: training.today,
    timezone: "UTC",
    balance: 300,
    kits: 2,
    kitsUsedThisWeek: 0,
    protections: [],
    rules: {
      kitPrice: 250,
      workoutReward: 10,
      weightReward: 2,
      weeklyKitLimit: 0,
      kitUsageLimit: "inventory",
    },
    monthlyKits: {
      month: "2026-10-01",
      renewsOn: "2026-11-01",
      allowance: 2,
      freeAvailable: 2,
      purchasedAvailable: 0,
    },
    history: { entries: [], hasMore: false },
  };
  game = {
    weekly: {
      weekStart: "2026-10-12",
      endsAt: "2026-10-19T00:00:00Z",
      bonus: 50,
      missions: [
        {
          key: "workouts",
          target: 3,
          progress: 0,
          reward: 10,
          claimedAt: null,
        },
      ],
    },
    achievements: {
      featured: [],
      visible: false,
      badges: [
        {
          key: "first",
          name: "Primeiro treino",
          description: "Começou",
          category: "frequency",
          icon: "flame",
          goal: 1,
          earnedAt: null,
          historical: false,
        },
      ],
    },
    cosmetics: [
      {
        id: "frame-ember",
        name: "Chama",
        category: "frame",
        price: 100,
        rarity: "common",
        badgeKey: null,
        owned: false,
        equipped: false,
        locked: false,
      },
    ],
  };
  social = {
    code: "CODE1234",
    workouts: [],
    friends: [],
    requests: [],
    groups: [],
  };
  rpc.mockImplementation(async (name: string) => {
    const read = {
      get_training_state: training,
      get_economy_state: wallet,
      get_social_state: social,
      get_gamification_state: game,
    }[name];
    if (!read) throw new Error(`RPC inesperada: ${name}`);
    return structuredClone(read);
  });
});
function useControllers(id: string) {
  const plan = useTrainingPlan(id),
    economy = useEconomy(id),
    gamification = useGamification(id, "", true),
    arena = useSocial(true, [], () => {}, "UTC", training.today, id);
  return { plan, economy, gamification, arena };
}
function confirmed(): Workout {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    date: training.today,
    activity: "Corrida",
    minutes: 40,
    method: "manual",
    confirmedAt: `${training.today}T12:00:00Z`,
  };
}
async function ready(hook: {
  result: { current: ReturnType<typeof useControllers> };
}) {
  await waitFor(() =>
    expect(
      [
        hook.result.current.plan.state,
        hook.result.current.economy.state,
        hook.result.current.gamification.state,
        hook.result.current.arena.state,
      ].every(Boolean),
    ).toBe(true),
  );
}
it.each(["confirm_manual_workout", "finish_workout_session"])(
  "%s propaga treino, ofensiva, saldo, missão, medalha e Arena",
  async (name) => {
    const hook = renderHook(() => useControllers(name));
    await ready(hook);
    social.workouts = [confirmed()];
    wallet.revision++;
    wallet.balance += 10;
    game.weekly.missions[0].progress = 1;
    game.achievements!.badges[0].earnedAt = `${training.today}T12:00:00Z`;
    act(() => notifySyncWrite(name, name));
    await waitFor(() =>
      expect(hook.result.current.economy.state?.balance).toBe(310),
    );
    await waitFor(() =>
      expect(hook.result.current.arena.state?.workouts).toHaveLength(1),
    );
    expect(
      hook.result.current.gamification.state?.weekly.missions[0].progress,
    ).toBe(1);
    expect(
      hook.result.current.gamification.state?.achievements?.badges[0].earnedAt,
    ).not.toBeNull();
    expect(
      trainingStreak(
        social.workouts,
        hook.result.current.plan.state,
        training.today,
      ).current,
    ).toBe(1);
  },
);
it("compra confirmada sincroniza inventário cosmético e saldo sem repetir a compra", async () => {
  const hook = renderHook(() => useControllers("purchase-flow"));
  await ready(hook);
  rpc.mockImplementation(async (name: string) => {
    if (name === "buy_cosmetic") {
      wallet.balance -= 100;
      wallet.revision++;
      game.cosmetics![0].owned = true;
      return null;
    }
    return structuredClone(
      {
        get_training_state: training,
        get_economy_state: wallet,
        get_social_state: social,
        get_gamification_state: game,
      }[name],
    );
  });
  await act(async () =>
    expect(
      await hook.result.current.gamification.act("buy_cosmetic", {
        p_item: "frame-ember",
        p_request_id: crypto.randomUUID(),
      }),
    ).toBe(true),
  );
  await waitFor(() =>
    expect(hook.result.current.economy.state?.balance).toBe(200),
  );
  expect(hook.result.current.gamification.state?.cosmetics?.[0].owned).toBe(
    true,
  );
  expect(
    rpc.mock.calls.filter(([name]) => name === "buy_cosmetic"),
  ).toHaveLength(1);
});
it("descanso extra atualiza cronograma, Arena e missões sem consultar a carteira", async () => {
  const hook = renderHook(() => useControllers("rest-flow"));
  await ready(hook);
  rpc.mockClear();
  rpc.mockImplementation(async (name: string) => {
    if (name === "authorize_extra_rest") {
      training.revision++;
      training.extraRests.push(training.today);
      return structuredClone(training);
    }
    return structuredClone(
      {
        get_training_state: training,
        get_economy_state: wallet,
        get_social_state: social,
        get_gamification_state: game,
      }[name],
    );
  });
  await act(async () =>
    expect(await hook.result.current.plan.rest()).toBe(true),
  );
  expect(hook.result.current.plan.state?.extraRests).toContain(training.today);
  expect(rpc.mock.calls.map(([name]) => name)).toEqual(
    expect.arrayContaining(["get_social_state", "get_gamification_state"]),
  );
  expect(rpc.mock.calls.map(([name]) => name)).not.toContain(
    "get_economy_state",
  );
});
it("amizade aceita permanece concluída mesmo que a nova leitura da Arena falhe", async () => {
  const hook = renderHook(() => useControllers("friend-flow"));
  await ready(hook);
  rpc.mockImplementation(async (name: string) => {
    if (name === "reply_friend_request") {
      social.friends.push({ id: "friend", nickname: "amiga" });
      return null;
    }
    if (name === "get_social_state") throw new Error("Failed to fetch");
    return structuredClone(
      {
        get_training_state: training,
        get_economy_state: wallet,
        get_gamification_state: game,
      }[name],
    );
  });
  await act(async () =>
    expect(
      await hook.result.current.arena.act("reply_friend_request", {
        p_accept: true,
        p_id: "request",
      }),
    ).toBe(true),
  );
  expect(hook.result.current.arena.error).toBe("");
  expect(hook.result.current.arena.sync?.stale).toBe(true);
  expect(hook.result.current.arena.busy).toBe(false);
  expect(social.friends).toHaveLength(1);
});

it("ignora um cache de Arena com estrutura inválida e recupera o snapshot do servidor", async () => {
  const key = `${STORAGE_KEY}:account:bad-social:social`;
  localStorage.setItem(
    key,
    JSON.stringify({
      ...social,
      groups: [{ id: "bad", name: "Grupo", members: null }],
    }),
  );
  const hook = renderHook(() =>
    useSocial(true, [], vi.fn(), "UTC", training.today, "bad-social"),
  );
  expect(hook.result.current.state).toBeNull();
  await waitFor(() =>
    expect(hook.result.current.state).toEqual({ ...social, syncError: "" }),
  );
  expect(JSON.parse(localStorage.getItem(key)!).groups).toEqual([]);
});
