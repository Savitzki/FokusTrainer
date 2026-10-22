import approvedReference from "../docs/conquistas_capibora_contextos_raridades.txt?raw";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ACHIEVEMENT_CATALOG, ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_MEDAL_ART, achievementProgress, type AchievementRarity } from "./achievements";
import AchievementMedal from "./AchievementMedal";
import AchievementsPage from "./AchievementsPage";
const deliveryFiles = import.meta.glob("/public/images/achievements/web/*.webp");
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

it("mostra todas as categorias e 28 medalhas sem filtros, descrições ou progresso na grade", () => {
 const game=controller(); render(<AchievementsPage game={game} onBack={vi.fn()} />);
 for(const name of Object.values(ACHIEVEMENT_CATEGORIES)) expect(screen.getByRole("heading", {name})).toBeVisible();
 expect(document.querySelectorAll(".achievement-tile")).toHaveLength(28);
 expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
 expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
 expect(screen.queryByText("Conclua 25 treinos obrigatórios")).not.toBeInTheDocument();
 expect(game.act).not.toHaveBeenCalled();
});
it("permite consultar bloqueadas em cinza, com requisito e sem data inventada", async () => {
 render(<AchievementsPage game={controller()} onBack={vi.fn()} />);
 const card=screen.getByRole("button", {name:/Já virou rotina/});
 expect(card).toBeEnabled(); expect(card).toHaveClass("is-locked");
 await userEvent.click(card);
 const dialog=screen.getByRole("dialog", {name:"Já virou rotina"});
 expect(within(dialog).getByText("Conclua 25 treinos obrigatórios")).toBeVisible();
 expect(dialog.querySelector("time")).toBeNull();
 expect(within(dialog).getAllByRole("button")).toHaveLength(1);
 await userEvent.click(within(dialog).getByRole("button", {name:"Fechar janela"}));
 expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
 expect(screen.getByRole("heading",{name:"Conquistas"})).toBeVisible();
});
it("a medalha desbloqueada mantém nome, requisito e data real no fuso da conta", async () => {
 render(<AchievementsPage game={controller()} onBack={vi.fn()} />);
 await userEvent.click(screen.getByRole("button",{name:/Primeira chama/}));
 const dialog=screen.getByRole("dialog",{name:"Primeira chama"});
 expect(dialog.querySelector("time")).toHaveAttribute("dateTime","2026-10-20T01:00:00Z");
 expect(dialog.querySelector("time")).toHaveTextContent("19 de outubro de 2026");
 expect(dialog.querySelector(".achievement-detail")).toHaveClass("is-earned");
 expect(within(dialog).queryByRole("progressbar")).not.toBeInTheDocument();
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

it("mapeia apenas artes existentes e recupera falhas sem imagens quebradas", () => {
 expect(Object.keys(ACHIEVEMENT_MEDAL_ART)).toHaveLength(28);
 expect(Object.values(ACHIEVEMENT_MEDAL_ART).filter(Boolean)).toHaveLength(19);
 for(const path of Object.values(ACHIEVEMENT_MEDAL_ART)) if(path) expect(Object.hasOwn(deliveryFiles, `/public/${path}`)).toBe(true);
 const view=render(<AchievementMedal icon="flame" medalKey="workout-1" rarity="common" />);
 const image=view.container.querySelector("img")!;
 expect(image).toHaveAttribute("alt", "");
 fireEvent.error(image);
 expect(view.container.querySelector("img")).toBeNull();
 expect(view.container.querySelector("svg")).not.toBeNull();
 view.rerender(<AchievementMedal icon="calendar" medalKey="week-1" />);
 expect(view.container.querySelector("img")).toBeNull();
});
it.each([{ rarity: "mythic" }, { progress: -1 }, { progress: 999 }, { reward: 10 }])("rejeita metadados inválidos ou uma economia de conquistas ativada indevidamente: %j", (invalid) => {
  const state = structuredClone(controller().state) as GameState;
  Object.assign(state.achievements!.badges[0], invalid);
  expect(() => readGameState(state)).toThrow();
});
