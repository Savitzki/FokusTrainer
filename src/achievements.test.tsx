import approvedReference from "../docs/conquistas_capibora_contextos_raridades.txt?raw";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ACHIEVEMENT_CATALOG, ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_MEDAL_ART, achievementProgress, type AchievementRarity } from "./achievements";
import AchievementMedal from "./AchievementMedal";
import { AchievementsPanel } from "./GamificationPanels";
import { readGameState, type Badge, type GameState } from "./gamification";
import type { GameController } from "./useGamification";

function controller(): GameController {
  return {
    busy: false, error: "", refresh: vi.fn(), act: vi.fn().mockResolvedValue(true),
    state: {
      weekly: { weekStart: "2026-10-19", endsAt: "2026-10-26T03:00:00Z", bonus: 50, missions: [], timezone: "America/Sao_Paulo" },
      achievements: { catalogVersion: 2, featured: ["workout-1"], visible: true,
        badges: ACHIEVEMENT_CATALOG.map((item): Badge => ({ ...item,
          icon: "trophy", rarity: item.rarity as AchievementRarity, historical: false, progress: item.metric === "record-improved" ? null : 0,
          earnedAt: item.key === "workout-1" ? "2026-10-20T01:00:00Z" : null, reward: 0,
        })) },
    },
  };
}

it("preserva exatamente os 28 títulos e descrições do arquivo aprovado e a divisão das categorias", () => {
  const reference = approvedReference;
  const approved = [...reference.matchAll(/^\d+\. (.+)\nDescrição: (.+)\nRaridade: (.+)/gm)];
  expect(approved).toHaveLength(28);
  expect(ACHIEVEMENT_CATALOG).toHaveLength(28);
  expect(new Set(ACHIEVEMENT_CATALOG.map((item) => item.key)).size).toBe(28);
  const rarity = { common: "Comum", rare: "Rara", epic: "Épica", legendary: "Lendária" };
  ACHIEVEMENT_CATALOG.forEach((item, index) => {
    expect([item.name, item.description, rarity[item.rarity as keyof typeof rarity]]).toEqual(approved[index].slice(1));
    expect(item.medalKey).toBe(item.key);
  });
  expect(Object.keys(ACHIEVEMENT_CATEGORIES).map((category) => ACHIEVEMENT_CATALOG.filter((item) => item.category === category).length)).toEqual([9, 6, 4, 1, 3, 4, 1]);
  for (const key of ["workout-1", "workout-10", "workout-30", "workout-100", "workout-365", "week-1", "week-4", "week-10", "record", "friend", "group", "collective"])
    expect(ACHIEVEMENT_CATALOG.some((item) => item.key === key)).toBe(true);
});

it("filtra as sete categorias sem alterar a seleção das medalhas em destaque", async () => {
  const game = controller(), user = userEvent.setup();
  render(<AchievementsPanel game={game} />);
  const select = screen.getByLabelText("Categoria");
  for (const [key, name] of Object.entries(ACHIEVEMENT_CATEGORIES)) {
    await user.selectOptions(select, key);
    const rows = ACHIEVEMENT_CATALOG.filter((item) => item.category === key);
    for (const row of rows) expect(screen.getByRole("button", { name: new RegExp(row.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })).toBeInTheDocument();
    expect(screen.getByRole("option", { name })).toBeInTheDocument();
  }
  await user.click(screen.getByRole("button", { name: "Salvar destaques" }));
  expect(game.act).toHaveBeenCalledWith("set_featured_medals", { p_keys: ["workout-1"], p_visible: true });
});

it("mostra raridade, descrição aprovada, progresso real e a data no fuso da conta", async () => {
  const game = controller();
  game.state!.achievements!.badges.find((item) => item.key === "workout-25")!.progress = 24;
  render(<AchievementsPanel game={game} />);
  const card = screen.getByRole("button", { name: /Já virou rotina/ });
  expect(card).toBeDisabled();
  expect(card).toHaveTextContent("24/25");
  expect(card).toHaveTextContent("Rara");
  expect(card).toHaveTextContent("Conclua 25 treinos obrigatórios");
  expect(within(card).getByRole("progressbar")).toHaveAttribute("value", "24");
  expect(screen.getByRole("button", { name: /Primeira chama/ })).toHaveTextContent("19/10/2026");
  const record = screen.getByRole("button", { name: /Meu novo máximo/ });
  expect(within(record).queryByRole("progressbar")).not.toBeInTheDocument();
  expect(game.act).not.toHaveBeenCalled();
});

it("formata semanas, pontos e datas sem transformar um evento sem métrica em progresso", () => {
  const badge = controller().state!.achievements!.badges[0];
  expect(achievementProgress({ ...badge, progress: 3, goal: 4, metric: "fulfilled-weeks" })).toBe("3/4 semanas");
  expect(achievementProgress({ ...badge, progress: 12, goal: 14, metric: "best-streak" })).toBe("12/14 pontos");
  expect(achievementProgress({ ...badge, progress: 6, goal: 7, metric: "weight-dates" })).toBe("6/7 datas");
  expect(achievementProgress({ ...badge, progress: 0, goal: 1, metric: "weight-dates" })).toBe("0/1 data");
  expect(achievementProgress({ ...badge, progress: null })).toBeNull();
});

it("preserva o contrato antigo e valida o catálogo completo sem misturar versões", () => {
  const state = controller().state!;
  expect(readGameState(state).achievements!.badges).toHaveLength(28);
  const legacy = structuredClone(state);
  delete legacy.achievements!.catalogVersion;
  legacy.achievements!.badges = [legacy.achievements!.badges[0]];
  expect(readGameState(legacy).achievements!.badges).toHaveLength(1);
  const mixed = structuredClone(state);
  mixed.achievements!.badges.pop();
  expect(() => readGameState(mixed)).toThrow("catálogo");
  const rewritten = structuredClone(state);
  rewritten.achievements!.badges[6].name = "Texto reescrito";
  expect(() => readGameState(rewritten)).toThrow("catálogo");
});

it("seleciona medalhas antigas e novas em categorias diferentes sem exceder três destaques", async () => {
  const game = controller(), user = userEvent.setup();
  for (const key of ["streak-3", "weight-7", "week-2"])
    game.state!.achievements!.badges.find((badge) => badge.key === key)!.earnedAt = "2026-10-19T12:00:00Z";
  render(<AchievementsPanel game={game} />);
  await user.selectOptions(screen.getByLabelText("Categoria"), "streak");
  await user.click(screen.getByRole("button", { name: /Acendeu a chama/ }));
  await user.selectOptions(screen.getByLabelText("Categoria"), "weight");
  await user.click(screen.getByRole("button", { name: /De olho na evolução/ }));
  await user.selectOptions(screen.getByLabelText("Categoria"), "consistency");
  expect(screen.getByRole("button", { name: /Não foi sorte/ })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Salvar destaques" }));
  expect(game.act).toHaveBeenCalledWith("set_featured_medals", { p_keys: ["workout-1", "streak-3", "weight-7"], p_visible: true });
});

it("prepara 28 chaves visuais sem solicitar arquivos inexistentes e recupera falha de uma arte", () => {
  expect(Object.keys(ACHIEVEMENT_MEDAL_ART)).toHaveLength(28);
  const view = render(<AchievementMedal icon="flame" medalKey="workout-1" rarity="common" />);
  expect(view.container.querySelector("img")).toBeNull();
  expect(view.container.querySelector("svg")).not.toBeNull();
  ACHIEVEMENT_MEDAL_ART["workout-1"] = "images/achievements/approved-test.webp";
  try {
    view.rerender(<AchievementMedal icon="flame" medalKey="workout-1" rarity="common" />);
    const image = view.container.querySelector("img")!;
    expect(image).toHaveAttribute("alt", "");
    fireEvent.error(image);
    expect(view.container.querySelector("img")).toBeNull();
    expect(view.container.querySelector("svg")).not.toBeNull();
  } finally { ACHIEVEMENT_MEDAL_ART["workout-1"] = null; }
});

it.each([{ rarity: "mythic" }, { progress: -1 }, { progress: 999 }, { reward: 10 }])("rejeita metadados inválidos ou uma economia de conquistas ativada indevidamente: %j", (invalid) => {
  const state = structuredClone(controller().state) as GameState;
  Object.assign(state.achievements!.badges[0], invalid);
  expect(() => readGameState(state)).toThrow();
});
