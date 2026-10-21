import { useState } from "react";
import { ArrowLeft, Award, ChevronRight } from "lucide-react";
import type { Badge } from "./gamification";
import type { GameController } from "./useGamification";
import { ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_CATALOG } from "./achievements";
import AchievementMedal from "./AchievementMedal";
import Modal from "./Modal";
import PageHeading from "./PageHeading";
import "./achievements.css";

export function AchievementsLink({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="profile-shop-link" onClick={onOpen}>
      <Award size={22} aria-hidden="true" />
      <span>
        Conquistas<small>Sua coleção de medalhas</small>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}

/** Privacy remains independent of the visual collection; keep existing featured IDs unchanged. */
export function AchievementPrivacy({ game }: { game: GameController }) {
  const [saved, setSaved] = useState(false);
  const data = game.state?.achievements;
  if (!data) return null;
  return (
    <section
      className="settings-section"
      aria-labelledby="medal-privacy-heading"
    >
      <h2 id="medal-privacy-heading">Privacidade das medalhas</h2>
      <label>
        <input
          type="checkbox"
          checked={data.visible}
          disabled={game.busy}
          onChange={async (event) => {
            setSaved(false);
            setSaved(
              await game.act("set_featured_medals", {
                p_keys: data.featured,
                p_visible: event.target.checked,
              }),
            );
          }}
        />{" "}
        Mostrar medalhas aos amigos
      </label>
      {saved && <p role="status">Preferência salva</p>}
      {game.error && (
        <p role="alert" className="form-error">
          {game.error}
        </p>
      )}
    </section>
  );
}

export default function AchievementsPage({
  game,
  onBack,
}: {
  game: GameController;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<string>();
  const data = game.state?.achievements;
  const badge = data?.badges.find((item) => item.key === selected);
  return (
    <section className="achievements-page" aria-labelledby="page-title">
      <PageHeading
        title="Conquistas"
        icon={Award}
        before={
          <button
            className="icon-button"
            aria-label="Voltar de conquistas"
            onClick={onBack}
          >
            <ArrowLeft size={20} />
          </button>
        }
      />
      {game.error && (
        <p className="form-error" role="alert">
          {game.error}
          <button className="text-button" onClick={() => void game.refresh()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!data && !game.error && <p role="status">Carregando conquistas…</p>}
      {data &&
        Object.entries(ACHIEVEMENT_CATEGORIES).map(([category, name]) => (
          <section
            className="achievement-category-section"
            key={category}
            aria-labelledby={`category-${category}`}
          >
            <h2 id={`category-${category}`}>{name}</h2>
            <div className="achievement-collection">
              {ACHIEVEMENT_CATALOG.filter((item) => item.category === category)
                .map((item) => data.badges.find((b) => b.key === item.key))
                .filter((b): b is Badge => Boolean(b))
                .map((item) => (
                  <button
                    className={`achievement-tile ${item.earnedAt ? "is-earned" : "is-locked"}`}
                    key={item.key}
                    onClick={() => setSelected(item.key)}
                    aria-label={`${item.name}${item.earnedAt ? ", conquistada" : ", bloqueada"}`}
                  >
                    <AchievementMedal
                      icon={item.icon}
                      medalKey={item.medalKey}
                      rarity={item.rarity}
                    />
                    <span>{item.name}</span>
                  </button>
                ))}
            </div>
          </section>
        ))}
      {badge && (
        <Modal
          title={badge.name}
          minimal
          centered
          dismissible={false}
          onClose={() => setSelected(undefined)}
        >
          <div
            className={`achievement-detail ${badge.earnedAt ? "is-earned" : "is-locked"}`}
          >
            <AchievementMedal
              icon={badge.icon}
              medalKey={badge.medalKey}
              rarity={badge.rarity}
            />
            <h2>{badge.name}</h2>
            <p>{badge.description}</p>
            {badge.earnedAt && (
              <time dateTime={badge.earnedAt}>
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "long",
                  timeZone: game.state?.weekly.timezone,
                }).format(new Date(badge.earnedAt))}
              </time>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}
