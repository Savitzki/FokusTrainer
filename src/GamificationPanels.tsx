import {
  Flame,
  CalendarCheck,
  Check,
  Trophy,
  Clock3,
  ChevronRight,
  Dumbbell,
  Flag,
} from "lucide-react";
import CapiWheyAmount from "./CapiWheyAmount";
import { MISSION_NAMES, type Mission } from "./gamification";
import type { GameController } from "./useGamification";
import BodyScale from "./BodyScale";


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
export { default as CosmeticShop, equippedItem } from "./CosmeticShop";
