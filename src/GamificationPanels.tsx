import { useEffect, useId, useState } from "react";
import {
  Award,
  Flame,
  CalendarCheck,
  Pencil,
  Check,
  Trophy,
  Clock3,
  ChevronRight,
  Dumbbell,
  Flag,
} from "lucide-react";
import CapiWheyAmount from "./CapiWheyAmount";
import { MISSION_NAMES, type GameState, type Mission } from "./gamification";
import type { GameController } from "./useGamification";
import BodyScale from "./BodyScale";

import MedalIcon from "./AchievementMedal";
import { ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_RARITIES, achievementProgress } from "./achievements";

export { default as MedalIcon } from "./AchievementMedal";
const MISSION_LABELS: Record<string, string> = {
  workouts: "Treinos",
  weight: "Peso",
  schedule: "Plano",
  consistency: "Chama",
};
function missionName(mission: Mission) {
  return mission.key === "weight"
    ? `Peso em ${mission.target} ${mission.target === 1 ? "dia" : "dias"}`
    : MISSION_NAMES[mission.key] || mission.key;
}
function MissionIcon({ mission }: { mission: Mission }) {
  const Icon =
    mission.key === "workouts"
      ? Dumbbell
      : mission.key === "weight"
        ? BodyScale
        : mission.key === "schedule"
          ? CalendarCheck
          : mission.key === "consistency"
            ? Flame
            : Flag;
  return <Icon size={17} aria-hidden="true" />;
}
function MissionRing({ mission }: { mission: Mission }) {
  const percent = Math.min(100, (mission.progress / mission.target) * 100);
  return (
    <span
      className={`mission-ring ${mission.claimedAt ? "is-received" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 40" fill="none">
        <circle
          className="mission-ring-track"
          cx="20"
          cy="20"
          r="17"
          strokeWidth="3"
        />
        <circle
          className="mission-ring-fill"
          cx="20"
          cy="20"
          r="17"
          strokeWidth="3"
          pathLength="100"
          strokeDasharray={`${percent} 100`}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
        />
      </svg>
      {mission.claimedAt ? (
        <Check size={17} />
      ) : (
        <MissionIcon mission={mission} />
      )}
    </span>
  );
}
export function WeeklyGoals({
  game,
  onOpen,
}: {
  game: GameController;
  onOpen: () => void;
}) {
  const weekly = game.state?.weekly;
  if (!weekly?.missions.length) return null;
  const completed = weekly.missions.filter(
    (mission) => mission.progress >= mission.target,
  ).length;
  const allCompleted = completed === weekly.missions.length;
  const allReceived = weekly.missions.every((mission) => mission.claimedAt);
  return (
    <section
      className={`weekly-goals ${allCompleted ? "weekly-goals-complete" : ""}`}
      aria-label="Metas da semana"
    >
      <div className="weekly-goals-heading">
        <h2>
          {allCompleted ? (
            <Trophy size={16} aria-hidden="true" />
          ) : (
            <Flag size={16} aria-hidden="true" />
          )}{" "}
          Metas da semana
        </h2>
        <button
          type="button"
          className="weekly-goals-open"
          onClick={onOpen}
          aria-label="Ver missões da semana"
          aria-describedby="weekly-goals-summary"
        >
          <span aria-hidden="true">
            {completed}/{weekly.missions.length}
          </span>
          <span className="sr-only" id="weekly-goals-summary">
            {completed} de {weekly.missions.length} metas atingidas
          </span>
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
      {allCompleted ? (
        <p className="weekly-goals-result">
          Semana de metas cumprida!
          {!allReceived && <span>Recompensas em apuração</span>}
        </p>
      ) : (
        <div
          className={`weekly-goals-grid ${weekly.missions.length > 3 ? "weekly-goals-legacy" : ""}`}
          style={{
            gridTemplateColumns: `repeat(${weekly.missions.length}, minmax(0, 1fr))`,
          }}
        >
          {weekly.missions.map((mission) => (
            <button
              key={mission.key}
              type="button"
              className={`weekly-goal ${mission.progress >= mission.target ? "is-complete" : "is-pending"}`}
              onClick={onOpen}
              aria-label={`${missionName(mission)}: ${mission.progress} de ${mission.target}${mission.claimedAt ? ", recompensa recebida" : ""}`}
            >
              <MissionRing mission={mission} />
              <span className="weekly-goal-label">
                {MISSION_LABELS[mission.key] || mission.key}
              </span>
              <span className="weekly-goal-count">
                {mission.progress}/{mission.target}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
export function MissionPanel({ game }: { game: GameController }) {
  const w = game.state?.weekly;
  if (!w) return <p role="status">{game.error || "Buscando suas missões…"}</p>;
  return (
    <div className="mission-list">
      <div className="mission-period">
        <span>Suas metas</span>
      </div>
      {!w.missions.length && <p>Sua próxima semana terá novas missões</p>}
      <div className="mission-grid">
        {w.missions.map((m) => (
          <article
            className="mission-item"
            key={m.key}
            aria-label={missionName(m)}
          >
            <div className="mission-item-top">
              <MissionRing mission={m} />
              <span className="mission-reward">
                <CapiWheyAmount amount={m.reward} signed />
              </span>
            </div>
            <h3>{MISSION_LABELS[m.key] || m.key}</h3>
            <strong className="mission-count">
              {m.progress}/{m.target}
              <small>{m.key === "workouts" ? "treinos" : "dias"}</small>
            </strong>
            <progress
              aria-label={missionName(m)}
              value={m.progress}
              max={m.target}
            />
            <span className="mission-state">
              {m.claimedAt ? (
                <>
                  <Check size={12} aria-hidden="true" /> Recebida
                </>
              ) : m.key === "schedule" || m.key === "consistency" ? (
                <>
                  <Clock3 size={12} aria-hidden="true" /> No encerramento
                </>
              ) : (
                <span className="sr-only">Em andamento</span>
              )}
            </span>
          </article>
        ))}
      </div>
      <div className="mission-bonus">
        <Trophy size={22} aria-hidden="true" />
        <span>
          Bônus final<small>Todas as metas</small>
        </span>
        <strong>
          <CapiWheyAmount amount={w.bonus} signed />
        </strong>
      </div>
      {game.error && (
        <p role="alert" className="form-error">
          {game.error}
        </p>
      )}
    </div>
  );
}
export function AchievementsPanel({
  game,
  compact = false,
}: {
  game: GameController;
  compact?: boolean;
}) {
  const a = game.state?.achievements;
  const categoryId = useId();
  const [category, setCategory] = useState("all");
  const [featured, setFeatured] = useState<string[]>([]),
    [visible, setVisible] = useState(false),
    [saved, setSaved] = useState(false);
  const current = JSON.stringify(a?.featured ?? []);
  useEffect(() => {
    setFeatured(JSON.parse(current));
    setVisible(a?.visible ?? false);
  }, [current, a?.visible]);
  if (!a) return null;
  const recentBadges = a.badges
    .filter((badge) => badge.earnedAt)
    .sort(
      (a, b) =>
        Date.parse(b.earnedAt!) - Date.parse(a.earnedAt!) ||
        a.key.localeCompare(b.key),
    )
    .slice(0, 3);
  const categories = Object.entries(ACHIEVEMENT_CATEGORIES).filter(([key]) => a.badges.some((badge) => badge.category === key));
  const shownBadges = a.badges.filter((badge) => category === "all" || badge.category === category);
  const editor = (
    <>
      <p className="field-hint">
        Destaque até três medalhas · {a.badges.filter((b) => b.earnedAt).length}
        /{a.badges.length}
      </p>
      <div className="achievement-category">
        <label htmlFor={categoryId}>Categoria</label>
        <select id={categoryId} value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">Todas as categorias</option>
          {categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      <div className="badge-grid">
        {shownBadges.map((b) => (
          <button
            type="button"
            key={b.key}
            className={`medal ${b.earnedAt ? "earned" : ""}`}
            aria-pressed={featured.includes(b.key)}
            disabled={
              game.busy ||
              !b.earnedAt ||
              (!featured.includes(b.key) && featured.length >= 3)
            }
            onClick={() => {
              setSaved(false);
              setFeatured((prev) =>
                prev.includes(b.key)
                  ? prev.filter((k) => k !== b.key)
                  : [...prev, b.key],
              );
            }}
          >
            <MedalIcon icon={b.icon} medalKey={b.medalKey} rarity={b.rarity} />
            {b.rarity && <span className={`achievement-rarity rarity-${b.rarity}`}>{ACHIEVEMENT_RARITIES[b.rarity]}</span>}
            <strong>{b.name}</strong>
            <small>{b.description}</small>
            <span className="achievement-state">{b.earnedAt ? "Conquistada" : "Bloqueada"}</span>
            {achievementProgress(b) !== null && <>
              <span className="achievement-progress">{achievementProgress(b)}</span>
              <progress aria-label={`Progresso: ${b.name}`} max={b.goal} value={b.progress!} />
            </>}
            {b.earnedAt && <small className="achievement-date">
              {b.historical ? "Reconhecida em " : "Conquistada em "}
              {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: game.state?.weekly.timezone }).format(new Date(b.earnedAt))}
            </small>}
            {featured.includes(b.key) && <Check size={15} aria-label="Em destaque" />}
          </button>
        ))}
      </div>
      <label className="medal-privacy">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => {
            setVisible(e.target.checked);
            setSaved(false);
          }}
        />{" "}
        Mostrar medalhas aos amigos
      </label>
      <button
        type="button"
        className="outline-button"
        disabled={game.busy}
        onClick={async () =>
          setSaved(
            await game.act("set_featured_medals", {
              p_keys: featured,
              p_visible: visible,
            }),
          )
        }
      >
        Salvar destaques
      </button>
      {saved && <p role="status">Medalhas atualizadas</p>}
      {game.error && (
        <p role="alert" className="form-error">
          {game.error}
        </p>
      )}
    </>
  );
  return (
    <section
      className={`achievement-panel ${compact ? "achievement-panel-compact" : ""}`}
      aria-labelledby="achievements-heading"
    >
      <div className="achievement-heading">
        <h3 id="achievements-heading">
          <Award size={21} /> Conquistas
        </h3>
        <span>
          {a.badges.filter((badge) => badge.earnedAt).length}/{a.badges.length}
        </span>
      </div>
      {compact ? (
        <>
          {recentBadges.length ? (
            <div
              className="profile-featured-medals"
              role="list"
              aria-label="Conquistas recentes"
            >
              {recentBadges.map((badge) => (
                <div
                  role="listitem"
                  key={badge.key}
                  className="has-medal"
                  aria-label={badge.name}
                  title={badge.name}
                >
                  <span>
                    <MedalIcon icon={badge.icon} medalKey={badge.medalKey} rarity={badge.rarity} />
                  </span>
                  <small>{badge.name}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="achievement-empty">Sem conquistas ainda</p>
          )}
          <details className="profile-medal-editor">
            <summary
              className="icon-button"
              aria-label="Gerenciar medalhas"
              title="Gerenciar medalhas"
            >
              <Pencil size={18} aria-hidden="true" />
            </summary>
            {editor}
          </details>
        </>
      ) : (
        editor
      )}
    </section>
  );
}
export { default as CosmeticShop, equippedItem } from "./CosmeticShop";
