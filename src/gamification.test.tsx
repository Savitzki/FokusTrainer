import {
  act,
  fireEvent,
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
      id: "frame-sport-band",
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
      id: "frame-water-wave",
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
      id: "frame-classic",
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
it("aceita três metas novas e preserva ciclos legados sem esconder missões", () => {
  const game = fixture();
  game.weekly.policy = 2;
  game.weekly.startsOn = "2026-10-17";
  game.weekly.missions = Array.from({ length: 3 }, (_, i) => ({ key: `goal-${i}`, target: 1, progress: 0, reward: 10, claimedAt: null }));
  expect(readGameState(game).weekly.missions).toHaveLength(3);
  game.weekly.missions.push({ key: "fourth", target: 1, progress: 0, reward: 10, claimedAt: null });
  expect(() => readGameState(game)).toThrow();
  game.weekly.policy = 1;
  expect(readGameState(game).weekly.missions).toHaveLength(4);
  game.weekly.startsOn = "2026-10-19";
  expect(() => readGameState(game)).toThrow();
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
  expect(screen.getByRole("button", { name: "Ver missões da semana" })).toHaveTextContent("2/3");
  expect(screen.getByRole("button", { name: "Ver missões da semana" })).toHaveAccessibleDescription("2 de 3 metas atingidas");
  expect(screen.queryByText("1 meta restante")).not.toBeInTheDocument();
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
  screen.getAllByAltText(/^Prévia de /).forEach(img => fireEvent.load(img));
  expect(screen.getByRole("button", { name: "Comprar Foco dourado" })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Bloqueado/ })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Equipar Chama viva" }));
  expect(game.act).toHaveBeenCalledWith(
    "equip_cosmetic",
    expect.objectContaining({ p_item: "frame-sport-band", p_category: "frame" }),
  );
  view.rerender(<CosmeticShop game={game} balance={250} onChanged={changed} />);
  await user.click(screen.getByRole("button", { name: "Comprar Foco dourado" }));
  await user.click(screen.getByRole("button", {name: "Confirmar compra"}));
  expect(game.act).toHaveBeenCalledWith(
    "buy_cosmetic",
    expect.objectContaining({ p_item: "frame-water-wave" }),
  );
  expect(changed).toHaveBeenCalledTimes(2);
});
it("o perfil resume três medalhas e só altera a privacidade ao salvar explicitamente", async () => {
  const game = controller(), user = userEvent.setup();
  game.state!.achievements!.featured = ["medal-1"];
  render(<AchievementsPanel game={game} compact />);
  expect(screen.getByRole("list", { name: "Conquistas recentes" }).children).toHaveLength(3);
  expect(screen.getByRole("listitem", { name: "Medalha 1" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Medalha 0/ })).not.toBeVisible();
  expect(game.act).not.toHaveBeenCalled();
  await user.click(screen.getByLabelText("Gerenciar medalhas"));
  expect(screen.getByLabelText("Mostrar medalhas aos amigos")).not.toBeChecked();
  await user.click(screen.getByRole("button", { name: /Medalha 0/ }));
  await user.click(screen.getByRole("button", { name: "Salvar destaques" }));
  expect(game.act).toHaveBeenCalledWith("set_featured_medals", {
    p_keys: ["medal-1", "medal-0"], p_visible: false,
  });
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
  await user.click(screen.getByRole("button", { name: "Novo desafio" }));
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
it("permite restringir novos desafios a treinos cronometrados sem mudar o padrão anterior", async () => {
  const user = userEvent.setup();
  rpc.mockResolvedValue([]);
  render(
    <ChallengesPanel
      userId="me"
      friends={[{ id: "friend", nickname: "Bia" }]}
      onChanged={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Novo desafio" }));
  expect(screen.getByLabelText("Métodos aceitos")).toHaveValue("any");
  await user.type(screen.getByLabelText("Nome do desafio"), "Com tempo");
  await user.selectOptions(screen.getByLabelText("Métodos aceitos"), "timed");
  await user.click(screen.getByLabelText("@Bia"));
  await user.click(screen.getByRole("button", { name: "Enviar convites" }));
  expect(rpc).toHaveBeenCalledWith(
    "create_recording_challenge",
    expect.objectContaining({
      p_recording_policy: "timed",
      p_friends: ["friend"],
    }),
  );
  expect(rpc).not.toHaveBeenCalledWith(
    "create_friend_challenge",
    expect.anything(),
  );
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
      await second.result.current.act("buy_cosmetic", { p_item: "frame-water-wave" }),
    ).toBe(false);
  });
  expect(second.result.current.state?.cosmetics?.[1].owned).toBe(false);
  expect(second.result.current.error).toBe("Sem conexão");
});

it("compacta metas atingidas, mantém detalhes e não anuncia moedas ainda em apuração", async () => {
  const game = controller(), onOpen = vi.fn();
  game.state!.weekly.missions[0].progress = 3;
  const view = render(<WeeklyGoals game={game} onOpen={onOpen} />);
  expect(screen.getByText("Semana de metas cumprida!")).toBeInTheDocument();
  expect(screen.getByText("Recompensas em apuração")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Treine no seu ritmo/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Ver missões da semana" }));
  expect(onOpen).toHaveBeenCalledOnce();
  expect(game.act).not.toHaveBeenCalled();
  game.state!.weekly.missions[0].claimedAt = "2026-10-17T13:00:00Z";
  view.rerender(<WeeklyGoals game={game} onOpen={onOpen} />);
  expect(screen.queryByText("Recompensas em apuração")).not.toBeInTheDocument();
});

it("preserva o acesso às quatro metas de ciclos legados em um resumo compacto", () => {
  const game = controller();
  game.state!.weekly.missions.push(
    { key: "weight", target: 2, progress: 0, reward: 10, claimedAt: null },
    { key: "schedule", target: 5, progress: 0, reward: 20, claimedAt: null },
    { key: "consistency", target: 7, progress: 0, reward: 30, claimedAt: null },
  );
  render(<WeeklyGoals game={game} onOpen={vi.fn()} />);
  expect(screen.getAllByRole("button")).toHaveLength(5);
  expect(screen.getByRole("button", { name: "Ver missões da semana" })).toHaveAccessibleDescription("0 de 4 metas atingidas");
  expect(screen.queryByText("4 metas restantes")).not.toBeInTheDocument();
  expect(document.querySelector(".mission-deadline")).toBeNull();
  expect(game.act).not.toHaveBeenCalled();
});

it("mostra as três conquistas mais recentes sem mudar os destaques salvos",()=>{
  const game=controller();
  const achievements=game.state!.achievements!;
  achievements.featured=["medal-0"];
  ["2026-10-01","2026-10-12","2026-10-19","2026-10-15"].forEach((date,index)=>{achievements.badges[index].earnedAt=date+"T12:00:00Z";});
  render(<AchievementsPanel game={game} compact/>);
  const list=screen.getByRole("list",{name:"Conquistas recentes"});
  expect(Array.from(list.children).map(el=>el.getAttribute("aria-label"))).toEqual(["Medalha 2","Medalha 3","Medalha 1"]);
  expect(achievements.featured).toEqual(["medal-0"]);
  expect(screen.getByLabelText("Gerenciar medalhas")).toHaveTextContent("");
  expect(game.act).not.toHaveBeenCalled();
});
