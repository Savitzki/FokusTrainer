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
} from "lucide-react";
import ProteinToken from "./ProteinToken";
import { formatDay } from "./model";
import { MISSION_NAMES, type GameState } from "./gamification";
import type { GameController } from "./useGamification";
import { deviceTimezone } from "./social";
import { Avatar } from "./ProfilePanel";
import type { Profile } from "./profile";

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
export function MissionPanel({ game }: { game: GameController }) {
  const w = game.state?.weekly;
  if (!w) return <p role="status">{game.error || "Buscando suas missões…"}</p>;
  return (
    <div className="mission-list">
      <p className="field-hint">
        Semana de {formatDay(w.weekStart, { day: "numeric", month: "short" })} ·{" "}
        {Math.max(0, Math.ceil((Date.parse(w.endsAt) - Date.now()) / 3600000))}h
        restantes · encerra{" "}
        {new Date(w.endsAt).toLocaleString("pt-BR", {
          timeZone: w.timezone ?? deviceTimezone(),
          weekday: "long",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
      {!w.missions.length && <p>Sua próxima semana terá novas missões</p>}
      {w.missions.map((m) => (
        <article className="mission-item" key={m.key}>
          <div>
            <strong>
              {m.key === "weight"
                ? `Peso em ${m.target} ${m.target === 1 ? "dia" : "dias"}`
                : MISSION_NAMES[m.key] || m.key}
            </strong>
            <span>
              <ProteinToken size={17} /> +{m.reward}
            </span>
          </div>
          <progress
            aria-label={MISSION_NAMES[m.key] || m.key}
            value={m.progress}
            max={m.target}
          />
          <small>
            {m.progress}/{m.target}{" "}
            {m.claimedAt
              ? "· Recompensa recebida"
              : m.key === "schedule" || m.key === "consistency"
                ? "· Apuração ao encerrar a semana"
                : ""}
          </small>
        </article>
      ))}
      <p className="field-hint">
        <Trophy size={16} /> Todas concluídas: +{w.bonus} potes · Descansos
        válidos preservam sua consistência
      </p>
      {game.error && (
        <p role="alert" className="form-error">
          {game.error}
        </p>
      )}
    </div>
  );
}
export function AchievementsPanel({ game }: { game: GameController }) {
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
  return (
    <section
      className="achievement-panel"
      aria-labelledby="achievements-heading"
    >
      <h3 id="achievements-heading">
        <Award size={21} /> Conquistas
      </h3>
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
