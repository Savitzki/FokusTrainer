import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { readChallenges, readGameState, type GameState } from "./gamification";
import {
  AchievementsPanel,
  CosmeticShop,
  MissionPanel,
  WeeklyGoals,
} from "./GamificationPanels";
import ChallengesPanel from "./ChallengesPanel";
import { useGameResource, type GameController } from "./useGamification";
import { clearAccountStorage } from "./accountStorage";
import { readCoinHistory } from "./economy";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("./backend", () => ({ accountConfigured: true, backendRpc: rpc }));
const fixture = (): GameState => ({
  weekly: {
    weekStart: "2026-10-12",
    endsAt: "2026-10-19T00:00:00Z",
    bonus: 50,
    missions: [
      { key: "workouts", target: 3, progress: 2, reward: 10, claimedAt: null },
    ],
  },
  achievements: {
    featured: [],
    visible: false,
    badges: Array.from({ length: 5 }, (_, i) => ({
      key: `medal-${i}`,
      name: `Medalha ${i}`,
      description: "Cumpra sua meta",
      category: "frequency",
      icon: "flame",
      goal: i + 1,
      earnedAt: i < 4 ? "2026-10-12T12:00:00Z" : null,
      historical: true,
    })),
  },
  cosmetics: [
    {
      id: "frame-ember",
      name: "Chama viva",
      category: "frame",
      price: 100,
      rarity: "common",
      badgeKey: null,
      owned: true,
      equipped: false,
      locked: false,
    },
    {
      id: "frame-gold",
      name: "Foco dourado",
      category: "frame",
      price: 250,
      rarity: "rare",
      badgeKey: null,
      owned: false,
      equipped: false,
      locked: false,
    },
    {
      id: "frame-champion",
      name: "Campeã",
      category: "frame",
      price: 250,
      rarity: "achievement",
      badgeKey: "medal-4",
      owned: false,
      equipped: false,
      locked: true,
    },
  ],
});
function controller(): GameController {
  return {
    state: fixture(),
    busy: false,
    error: "",
    refresh: vi.fn().mockResolvedValue(true),
    act: vi.fn().mockResolvedValue(true),
  };
}
beforeEach(() => rpc.mockReset());
it("aceita contratos antigos da etapa 1 e rejeita progresso ou preços inválidos", () => {
  expect(
    readGameState({ weekly: fixture().weekly }).weekly.missions[0].target,
  ).toBe(3);
  const invalid = fixture();
  invalid.weekly.missions[0].progress = 4;
  expect(() => readGameState(invalid)).toThrow();
  const bad = fixture();
  bad.cosmetics![0].price = -1;
  expect(() => readGameState(bad)).toThrow();
  expect(() => readChallenges([{ id: "fake" }])).toThrow();
});
it("mostra progresso e recompensa confirmados, sem botão para atribuir moedas", () => {
  const game = controller();
  render(<MissionPanel game={game} />);
  expect(screen.getByRole("progressbar")).toHaveAttribute("max", "3");
  expect(screen.getByText("2/3")).toBeInTheDocument();
  expect(game.act).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: /Receber/ }),
  ).not.toBeInTheDocument();
});
it("resume metas com anéis e só marca recompensas já confirmadas pelo servidor", async () => {
  const game = controller(), onOpen = vi.fn();
  game.state!.weekly.missions.push(
    { key: "weight", target: 1, progress: 1, reward: 10, claimedAt: "2026-10-17T12:00:00Z" },
    { key: "schedule", target: 5, progress: 5, reward: 20, claimedAt: null },
  );
  render(<WeeklyGoals game={game} onOpen={onOpen} />);
  expect(screen.getByRole("region", { name: "Metas da semana" })).toBeInTheDocument();
  expect(screen.getByText("1/3")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Peso em 1 dia: 1 de 1, recompensa recebida" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cumpra sua semana: 5 de 5" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Ver missões da semana" }));
  expect(onOpen).toHaveBeenCalledOnce();
  expect(game.act).not.toHaveBeenCalled();
});

it("mantém detalhes de regras recolhidos e diferencia apuração de recompensa recebida", () => {
  const game = controller();
  game.state!.weekly.missions.push(
    { key: "weight", target: 1, progress: 1, reward: 10, claimedAt: "2026-10-17T12:00:00Z" },
    { key: "consistency", target: 7, progress: 5, reward: 30, claimedAt: null },
  );
  render(<MissionPanel game={game} />);
  expect(screen.getByRole("progressbar", { name: "Peso em 1 dia" })).toHaveAttribute("max", "1");
  expect(screen.getByText("Recebida")).toBeInTheDocument();
  expect(screen.getByText("No encerramento")).toBeInTheDocument();
  expect(screen.getByText("Como funciona").closest("details")).not.toHaveAttribute("open");
  expect(game.act).not.toHaveBeenCalled();
});
it("limita três destaques, impede medalha bloqueada e salva a escolha de privacidade", async () => {
  const game = controller(),
    user = userEvent.setup();
  render(<AchievementsPanel game={game} />);
  for (let i = 0; i < 3; i++)
    await user.click(
      screen.getByRole("button", { name: new RegExp(`Medalha ${i}`) }),
    );
  expect(screen.getByRole("button", { name: /Medalha 3/ })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Medalha 4/ })).toBeDisabled();
  await user.click(screen.getByLabelText("Mostrar medalhas aos amigos"));
  await user.click(screen.getByRole("button", { name: "Salvar destaques" }));
  expect(game.act).toHaveBeenCalledWith("set_featured_medals", {
    p_keys: ["medal-0", "medal-1", "medal-2"],
    p_visible: true,
  });
});
it("usa preços do servidor, bloqueia saldo insuficiente e equipa sem comprar novamente", async () => {
  const game = controller(),
    user = userEvent.setup(),
    changed = vi.fn();
  const view = render(
    <CosmeticShop game={game} balance={249} onChanged={changed} />,
  );
  expect(screen.getByRole("button", { name: "Comprar 250" })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Bloqueado/ })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Equipar" }));
  expect(game.act).toHaveBeenCalledWith(
    "equip_cosmetic",
    expect.objectContaining({ p_item: "frame-ember", p_category: "frame" }),
  );
  view.rerender(<CosmeticShop game={game} balance={250} onChanged={changed} />);
  await user.click(screen.getByRole("button", { name: "Comprar 250" }));
  expect(game.act).toHaveBeenCalledWith(
    "buy_cosmetic",
    expect.objectContaining({ p_item: "frame-gold" }),
  );
  expect(changed).toHaveBeenCalledTimes(2);
});
it("mantém novos ganhos e gastos no extrato existente, com sinal correto", () => {
  const entry = {
    id: "1",
    kind: "mission",
    description: "Missão",
    amount: 10,
    balanceAfter: 10,
    day: "2026-10-12",
    createdAt: "2026-10-12T12:00:00Z",
  };
  expect(
    readCoinHistory({
      entries: [
        entry,
        {
          ...entry,
          id: "2",
          kind: "cosmetic-purchase",
          amount: -100,
          balanceAfter: 0,
        },
      ],
      hasMore: false,
    }).entries,
  ).toHaveLength(2);
  expect(() =>
    readCoinHistory({
      entries: [{ ...entry, kind: "cosmetic-purchase" }],
      hasMore: false,
    }),
  ).toThrow();
});
it("cria desafio apenas com amigos selecionados e sem enviar valores de recompensa", async () => {
  rpc.mockResolvedValue([]);
  const user = userEvent.setup();
  render(
    <ChallengesPanel
      userId="challenge-ui"
      friends={[{ id: "friend-id", nickname: "Dani" }]}
      onChanged={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Novo" }));
  await user.type(screen.getByLabelText("Nome do desafio"), "Compromisso");
  await user.click(screen.getByLabelText("@Dani"));
  await user.click(screen.getByRole("button", { name: "Enviar convites" }));
  expect(rpc).toHaveBeenCalledWith(
    "create_friend_challenge",
    expect.objectContaining({
      p_friends: ["friend-id"],
      p_duration: 7,
      p_kind: "consistency",
      p_target: null,
    }),
  );
  expect(
    rpc.mock.calls.find(([name]) => name === "create_friend_challenge")?.[1],
  ).not.toHaveProperty("reward");
});
it("ignora uma resposta atrasada após trocar a conta e após logout", async () => {
  let resolve!: (x: unknown) => void;
  rpc
    .mockImplementationOnce(() => new Promise((r) => (resolve = r)))
    .mockResolvedValue(fixture());
  const view = renderHook(
    ({ id }) =>
      useGameResource(id, "get_gamification_state", {}, readGameState),
    { initialProps: { id: "resource-a" } },
  );
  view.rerender({ id: "resource-b" });
  await waitFor(() => expect(view.result.current.state).not.toBeNull());
  await act(async () => resolve({ broken: true }));
  expect(view.result.current.error).toBe("");
  let finish!: (x: unknown) => void;
  rpc.mockImplementationOnce(() => new Promise((r) => (finish = r)));
  let pending!: Promise<boolean>;
  act(() => {
    pending = view.result.current.refresh();
  });
  clearAccountStorage("resource-b");
  await act(async () => {
    finish(fixture());
    expect(await pending).toBe(false);
  });
});
it("restaura o inventário no reload pela conta e preserva o estado confirmado em caso de falha", async () => {
  rpc.mockResolvedValue(fixture());
  const first = renderHook(() =>
    useGameResource(
      "persist-game",
      "get_gamification_state",
      {},
      readGameState,
    ),
  );
  await waitFor(() =>
    expect(first.result.current.state?.cosmetics?.[0].owned).toBe(true),
  );
  first.unmount();
  const second = renderHook(() =>
    useGameResource(
      "persist-game",
      "get_gamification_state",
      {},
      readGameState,
    ),
  );
  await waitFor(() =>
    expect(second.result.current.state?.cosmetics?.[0].owned).toBe(true),
  );
  rpc.mockRejectedValueOnce(new Error("Sem conexão"));
  await act(async () => {
    expect(
      await second.result.current.act("buy_cosmetic", { p_item: "frame-gold" }),
    ).toBe(false);
  });
  expect(second.result.current.state?.cosmetics?.[1].owned).toBe(false);
  expect(second.result.current.error).toBe("Sem conexão");
});
