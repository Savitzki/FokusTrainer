import { ACHIEVEMENT_RARITIES, type AchievementRarity } from "./achievements";
import { validateProfile, type Profile } from "./profile";

export type FriendProfileData = {
  nickname: string;
  displayName?: string;
  avatar?: Profile;
  frame?: string;
  banner?: string;
  streak?: { current: number; best: number };
  badges: {
    key: string;
    name: string;
    icon: string;
    medalKey?: string;
    rarity?: AchievementRarity;
    earnedAt?: string;
  }[];
};

/** Accept the previous medal-only RPC too, without inventing unavailable stats. */
export function readFriendProfile(value: unknown): FriendProfileData {
  const data = value as FriendProfileData | null;
  if (!data || typeof data.nickname !== "string" || !Array.isArray(data.badges))
    throw new Error("Não foi possível carregar este perfil");
  const count = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0;
  return {
    nickname: data.nickname,
    displayName:
      typeof data.displayName === "string" ? data.displayName : undefined,
    avatar: data.avatar ? validateProfile(data.avatar) : undefined,
    frame: typeof data.frame === "string" ? data.frame : undefined,
    banner: typeof data.banner === "string" ? data.banner : undefined,
    streak:
      data.streak && count(data.streak.current) && count(data.streak.best)
        ? { current: data.streak.current, best: data.streak.best }
        : undefined,
    badges: data.badges.slice(0, 3).map((badge, index) => {
      if (
        !badge ||
        typeof badge.name !== "string" ||
        typeof badge.icon !== "string"
      )
        throw new Error("Não foi possível carregar as medalhas");
      return {
        key: typeof badge.key === "string" ? badge.key : `featured-${index}`,
        name: badge.name,
        icon: badge.icon,
        medalKey:
          typeof badge.medalKey === "string" ? badge.medalKey : undefined,
        rarity:
          badge.rarity && Object.hasOwn(ACHIEVEMENT_RARITIES, badge.rarity)
            ? badge.rarity
            : undefined,
        earnedAt:
          typeof badge.earnedAt === "string" &&
          Number.isFinite(Date.parse(badge.earnedAt))
            ? badge.earnedAt
            : undefined,
      };
    }),
  };
}
