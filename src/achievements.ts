import catalog from "./achievementCatalog.json";
import approvedArt from "./achievementArt.json";
import type { Badge } from "./gamification";

export const ACHIEVEMENT_CATALOG = catalog;
export const ACHIEVEMENT_CATEGORIES = {
  frequency: "Treinos",
  consistency: "Consistência",
  streak: "Ofensiva",
  overcoming: "Superação",
  weight: "Peso e acompanhamento",
  social: "Social",
  special: "Especial",
} as const;
export const ACHIEVEMENT_RARITIES = {
  common: "Comum",
  rare: "Rara",
  epic: "Épica",
  legendary: "Lendária",
} as const;
export type AchievementRarity = keyof typeof ACHIEVEMENT_RARITIES;

/** Only register approved, existing files. Null uses the flat vector fallback. */
export const ACHIEVEMENT_MEDAL_ART: Record<string, string | null> =
  Object.fromEntries(
    catalog.map((badge) => [
      badge.medalKey,
      Object.hasOwn(approvedArt, badge.medalKey)
        ? `images/achievements/web/${badge.medalKey}.webp`
        : null,
    ]),
  );

export function achievementProgress(badge: Badge) {
  if (badge.progress == null) return null;
  const unit =
    badge.metric === "fulfilled-weeks"
      ? badge.goal === 1
        ? " semana"
        : " semanas"
      : badge.metric === "best-streak" ||
          badge.metric === "group-streak-participation"
        ? " pontos"
        : badge.metric === "weight-dates"
          ? badge.goal === 1
            ? " data"
            : " datas"
          : "";
  return `${badge.progress}/${badge.goal}${unit}`;
}
