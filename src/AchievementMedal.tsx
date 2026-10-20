import { useState } from "react";
import { CalendarCheck, Flame, Trophy, Users } from "lucide-react";
import BodyScale from "./BodyScale";
import { ACHIEVEMENT_MEDAL_ART, type AchievementRarity } from "./achievements";

export default function AchievementMedal({ icon, medalKey, rarity }: {
  icon: string;
  medalKey?: string;
  rarity?: AchievementRarity;
}) {
  const source = medalKey && Object.hasOwn(ACHIEVEMENT_MEDAL_ART, medalKey)
    ? ACHIEVEMENT_MEDAL_ART[medalKey] : null;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const Icon = icon === "flame" ? Flame : icon === "calendar" ? CalendarCheck
    : icon === "users" ? Users : icon === "scale" ? BodyScale : Trophy;
  return (
    <span className={`achievement-medal ${rarity ? `rarity-${rarity}` : ""}`} aria-hidden="true">
      {source && source !== failedSource ? (
        <img src={`${import.meta.env.BASE_URL}${source}`} alt="" loading="lazy"
          onError={() => setFailedSource(source)} />
      ) : <Icon size={26} aria-hidden="true" />}
    </span>
  );
}
