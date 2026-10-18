import { useEffect, useState } from "react";
import {
  Award,
  Check,
  Flame,
  Frame,
  Palette,
  Share2,
  LockKeyhole,
  Trophy,
  Users,
  CalendarCheck,
  Clock3,
  ChevronRight,
  Dumbbell,
  Flag,
} from "lucide-react";
import ProteinToken from "./ProteinToken";
import { formatDay } from "./model";
import { MISSION_NAMES, type GameState, type Mission } from "./gamification";
import type { GameController } from "./useGamification";
import { deviceTimezone } from "./social";
import { Avatar } from "./ProfilePanel";
import type { Profile } from "./profile";
import BodyScale from "./BodyScale";

export function MedalIcon({ icon }: { icon: string }) {
  const Icon =
    icon === "flame"
      ? Flame
      : icon === "calendar"
        ? CalendarCheck
        : icon === "users"
          ? Users
          : Trophy;
  return <Icon size={22} aria-hidden="true" />;
}
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
          cx="20" cy="20" r="17" strokeWidth="3"
        />
        <circle
          className="mission-ring-fill"
          cx="20" cy="20" r="17" strokeWidth="3"
          pathLength="100"
          strokeDasharray={`${percent} 100`}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
        />
      </svg>
      {mission.claimedAt ? <Check size={17} /> : <MissionIcon mission={mission} />}
    </span>
  );
}
function MissionDeadline({ weekly }: { weekly: GameState["weekly"] }) {
  const hours = Math.max(
    0,
    Math.ceil((Date.parse(weekly.endsAt) - Date.now()) / 3600000),
  );
  const deadline = new Date(weekly.endsAt).toLocaleString("pt-BR", {
    timeZone: weekly.timezone ?? deviceTimezone(),
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <time
      className="mission-deadline"
      dateTime={weekly.endsAt}
      title={deadline}
      aria-label={`Encerramento: ${deadline}`}
    >
      <Clock3 size={13} aria-hidden="true" /> {hours > 0 ? `${hours}h` : "Encerrada"}
    </time>
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
  const received = weekly.missions.filter((mission) => mission.claimedAt).length;
  return (
    <section className="weekly-goals" aria-label="Metas da semana">
      <div className="weekly-goals-heading">
        <h2>
          <Flag size={16} aria-hidden="true" /> Metas da semana
        </h2>
        <button
          type="button"
          className="weekly-goals-open"
          onClick={onOpen}
          aria-label="Ver missões da semana"
        >
          <span>{received}/{weekly.missions.length}</span>
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="weekly-goals-grid" style={{gridTemplateColumns: `repeat(${weekly.missions.length}, minmax(0, 1fr))`}}>
        {weekly.missions.map((mission) => (
          <button
            key={mission.key}
            type="button"
            className="weekly-goal"
            onClick={onOpen}
            aria-label={`${missionName(mission)}: ${mission.progress} de ${mission.target}${mission.claimedAt ? ", recompensa recebida" : ""}`}
          >
            <MissionRing mission={mission} />
            <span className="weekly-goal-label">
              {MISSION_LABELS[mission.key] || mission.key}
            </span>
            <span className="weekly-goal-count">{mission.progress}/{mission.target}</span>
          </button>
        ))}
      </div>
      <div className="weekly-goals-footer">
        <span>
          <Trophy size={13} aria-hidden="true" /> Bônus +{weekly.bonus}{" "}
          <ProteinToken size={13} />
        </span>
        <MissionDeadline weekly={weekly} />
      </div>
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
        <MissionDeadline weekly={w} />
      </div>
      {!w.missions.length && <p>Sua próxima semana terá novas missões</p>}
      <div className="mission-grid">
        {w.missions.map((m) => (
          <article className="mission-item" key={m.key} aria-label={missionName(m)}>
            <div className="mission-item-top">
              <MissionRing mission={m} />
              <span className="mission-reward">
                <ProteinToken size={14} /> +{m.reward}
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
                <><Check size={12} aria-hidden="true" /> Recebida</>
              ) : m.key === "schedule" || m.key === "consistency" ? (
                <><Clock3 size={12} aria-hidden="true" /> No encerramento</>
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
        <strong>+{w.bonus} <ProteinToken size={17} /></strong>
      </div>
      <details className="mission-rules">
        <summary>Como funciona</summary>
        {w.policy === 2 && w.startsOn && w.startsOn > w.weekStart && (
          <p>Suas metas começaram em {formatDay(w.startsOn)} e foram adaptadas aos dias restantes.</p>
        )}
        {w.missions.length > 3 && (
          <p>Este ciclo mantém as metas que você já recebeu. Os próximos terão até três missões por semana.</p>
        )}
        <p>
          Descansos válidos preservam sua consistência. Treinos reagendados
          contam na nova data; treinos voluntários em descansos não somam.
          Plano e Chama são apurados ao encerrar a semana.
        </p>
        <p>{w.missions.map(missionName).join(" · ")}</p>
      </details>
      {game.error && <p role="alert" className="form-error">{game.error}</p>}
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
  const [featured, setFeatured] = useState<string[]>([]),
    [visible, setVisible] = useState(false),
    [saved, setSaved] = useState(false);
  const current = JSON.stringify(a?.featured ?? []);
  useEffect(() => {
    setFeatured(JSON.parse(current));
    setVisible(a?.visible ?? false);
  }, [current, a?.visible]);
  if (!a) return null;
  const featuredBadges = featured
    .map((key) => a.badges.find((badge) => badge.key === key && badge.earnedAt))
    .filter((badge) => badge !== undefined);
  const editor = (
    <>
      <p className="field-hint">
        Destaque até três medalhas · {a.badges.filter((b) => b.earnedAt).length}
        /{a.badges.length}
      </p>
      <div className="badge-grid">
        {a.badges.map((b) => (
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
            <MedalIcon icon={b.icon} />
            <strong>{b.name}</strong>
            <small>
              {b.earnedAt
                ? `${b.historical ? "Reconhecida em " : ""}${formatDay(b.earnedAt.slice(0, 10))}`
                : b.description}
            </small>
            {featured.includes(b.key) && <Check size={15} />}
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
        <h3 id="achievements-heading"><Award size={21} /> Conquistas</h3>
        <span>{a.badges.filter((badge) => badge.earnedAt).length}/{a.badges.length}</span>
      </div>
      {compact ? (
        <>
          <div className="profile-featured-medals" role="list" aria-label="Medalhas em destaque">
            {Array.from({ length: 3 }, (_, index) => {
              const badge = featuredBadges[index];
              return (
                <div
                  role="listitem"
                  key={index}
                  className={badge ? "has-medal" : ""}
                  aria-label={badge?.name ?? `Espaço de medalha ${index + 1}`}
                  title={badge?.name ?? "Escolha uma medalha conquistada"}
                >
                  <span>{badge ? <MedalIcon icon={badge.icon} /> : <Award size={22} aria-hidden="true" />}</span>
                  <small>{badge?.name ?? "Livre"}</small>
                </div>
              );
            })}
          </div>
          <details className="profile-medal-editor">
            <summary>Gerenciar medalhas <ChevronRight size={16} aria-hidden="true" /></summary>
            {editor}
          </details>
        </>
      ) : editor}
    </section>
  );
}
export function CosmeticShop({
  game,
  balance,
  onChanged,
  profile = null,
}: {
  game: GameController;
  balance: number;
  onChanged: () => void;
  profile?: Profile | null;
}) {
  const [category, setCategory] = useState<"frame" | "share" | "theme">(
    "frame",
  );
  const [notice, setNotice] = useState("");
  const items = game.state?.cosmetics;
  if (!items) return null;
  return (
    <section className="cosmetic-shop" aria-labelledby="cosmetic-heading">
      <h3 id="cosmetic-heading">
        <Palette size={21} /> Do seu jeito
      </h3>
      <div className="segmented-control" aria-label="Categorias da loja">
        {(
          [
            ["frame", "Molduras", Frame],
            ["share", "Cards", Share2],
            ["theme", "Temas", Palette],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            type="button"
            key={id}
            aria-pressed={category === id}
            onClick={() => setCategory(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      <div className="cosmetic-grid">
        {items
          .filter((i) => i.category === category)
          .sort(
            (a, b) =>
              Number(b.equipped) - Number(a.equipped) ||
              Number(b.owned) - Number(a.owned) ||
              Number(a.locked) - Number(b.locked) ||
              a.price - b.price,
          )
          .map((i) => (
            <article key={i.id} className="cosmetic-item">
              <div className={`cosmetic-preview ${i.id}`} aria-hidden="true">
                {i.category === "frame" ? (
                  <Avatar profile={profile} frame={i.id} />
                ) : i.category === "share" ? (
                  <Share2 size={32} />
                ) : (
                  <Palette size={32} />
                )}
              </div>
              <strong>{i.name}</strong>
              <small>
                {i.equipped
                  ? "Equipado"
                  : i.owned
                    ? "Na sua coleção"
                    : i.locked
                      ? "Bloqueado · Requer " +
                        (game.state?.achievements?.badges.find(
                          (b) => b.key === i.badgeKey,
                        )?.name || "uma conquista")
                      : i.rarity === "rare"
                        ? "Disponível · Raro"
                        : "Disponível · Permanente"}
              </small>
              <button
                type="button"
                className={i.owned ? "outline-button" : "primary-button"}
                disabled={
                  game.busy || (!i.owned && (i.locked || balance < i.price))
                }
                onClick={async () => {
                  const ok = i.owned
                    ? await game.act("equip_cosmetic", {
                        p_category: i.category,
                        p_item: i.equipped ? null : i.id,
                        p_timezone: deviceTimezone(),
                      })
                    : await game.act("buy_cosmetic", {
                        p_item: i.id,
                        p_timezone: deviceTimezone(),
                      });
                  if (ok) {
                    setNotice(
                      i.owned
                        ? i.equipped
                          ? "Item desequipado"
                          : "Visual equipado"
                        : "Compra confirmada · item na sua coleção",
                    );
                    onChanged();
                  }
                }}
              >
                {i.owned ? (
                  i.equipped ? (
                    "Desequipar"
                  ) : (
                    "Equipar"
                  )
                ) : i.locked ? (
                  <>
                    <LockKeyhole size={15} /> Bloqueado
                  </>
                ) : (
                  <>
                    Comprar <ProteinToken size={16} /> {i.price}
                  </>
                )}
              </button>
            </article>
          ))}
      </div>
      {notice && (
        <p className="economy-feedback" role="status">
          {notice}
        </p>
      )}
      {game.error && (
        <p role="alert" className="form-error">
          {game.error}
        </p>
      )}
      <p className="field-hint">
        Itens virtuais permanentes · Sem valor monetário
      </p>
    </section>
  );
}
export function equippedItem(state: GameState | null, category: string) {
  return state?.cosmetics?.find((i) => i.category === category && i.equipped)
    ?.id;
}
