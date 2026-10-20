import { ArrowRight, CalendarCheck, Dumbbell, Flag, Users } from "lucide-react";
import ArenaAvatar from "./ArenaAvatar";
import type { Challenge } from "./gamification";
import { formatDay } from "./model";
export function challengeStateLabel(c: Challenge) {
  return c.cancelled
    ? c.cancelReason === "participation-ended"
      ? "Participação encerrada"
      : "Cancelado"
    : c.closed
      ? "Encerrado"
      : c.invited
        ? "Convite"
        : c.state === "scheduled"
          ? "Programado"
          : "Em disputa";
}
export function challengeKindLabel(c: Challenge) {
  return c.kind === "collective"
    ? "Coletivo"
    : c.kind === "consistency"
      ? "Consistência"
      : "Frequência";
}
export function scoreLabel(c: Challenge, id: string | null) {
  const score = c.board.find((p) => p.id === id);
  return !score
    ? "—"
    : c.kind === "consistency"
      ? score.percent == null
        ? "—"
        : `${score.percent.toLocaleString("pt-BR")}%`
      : `${score.completed}`;
}
export default function ArenaChallengePreview({
  challenge: c,
  userId,
}: {
  challenge: Challenge;
  userId: string;
}) {
  const total = c.board.reduce((sum, p) => sum + p.completed, 0),
    own = c.board.find((p) => p.id === userId);
  const duel = c.kind !== "collective" && c.participants.length === 2;
  const Icon =
    c.kind === "collective"
      ? Users
      : c.kind === "consistency"
        ? CalendarCheck
        : Dumbbell;
  return (
    <>
      <span className="arena-challenge-top">
        <span className="challenge-kind">
          <Icon size={14} />
          {challengeKindLabel(c)}
        </span>
        <span className="challenge-status" id={`challenge-status-${c.id}`}>
          {challengeStateLabel(c)}
        </span>
      </span>
      <strong className="arena-challenge-name">{c.name}</strong>
      {duel ? (
        <span
          className="arena-versus"
          aria-label="Confronto entre participantes"
        >
          {c.participants.map((p, i) => (
            <span className="arena-versus-side" key={p.id ?? i}>
              {i === 1 && (
                <span className="arena-vs-mark" aria-hidden="true">
                  VS
                </span>
              )}
              <ArenaAvatar
                name={p.nickname}
                avatar={p.avatar}
                frame={p.frame}
              />
              <span className="arena-versus-nick">@{p.nickname}</span>
              <strong>{scoreLabel(c, p.id)}</strong>
              <small>{c.kind === "consistency" ? "do plano" : "treinos"}</small>
            </span>
          ))}
        </span>
      ) : (
        <span
          className="arena-mission-people challenge-participants"
          id={`challenge-people-${c.id}`}
          aria-label={`${c.participants.length} participantes`}
        >
          <span className="group-avatar-stack" aria-hidden="true">
            {c.participants.slice(0, 4).map((p, i) => (
              <ArenaAvatar
                key={p.id ?? i}
                name={p.nickname}
                avatar={p.avatar}
                frame={p.frame}
              />
            ))}
          </span>
          <small title={`${c.participants.length} participantes`}>
            {c.participants.length} participantes
          </small>
        </span>
      )}
      <span
        className="arena-challenge-progress"
        id={`challenge-progress-${c.id}`}
      >
        {c.kind === "collective" ? (
          <>
            <span>
              <Flag size={15} /> Meta compartilhada
            </span>
            <strong>
              {total}/{c.target} treinos
            </strong>
          </>
        ) : c.kind === "consistency" ? (
          own?.percent != null ? (
            <>
              <span>Seu cronograma</span>
              <strong>{own.percent.toLocaleString("pt-BR")}%</strong>
            </>
          ) : (
            "Sem resultado ainda"
          )
        ) : own ? (
          <>
            <span>Seus treinos válidos</span>
            <strong>{own.completed}</strong>
          </>
        ) : (
          "Sem resultado ainda"
        )}
      </span>
      {c.kind === "collective" && (
        <>
          <progress
            aria-label={`Meta de ${c.name}`}
            value={Math.min(total, c.target)}
            max={c.target}
          />
          <span className="arena-mission-remaining">
            {Math.max(0, c.target - total)} treinos restantes
          </span>
        </>
      )}
      {c.kind === "consistency" && own?.percent != null && (
        <progress
          aria-label={`Cumprimento do plano em ${c.name}`}
          value={Math.min(100, own.percent)}
          max={100}
        />
      )}
      <span className="arena-challenge-footer" id={`challenge-meta-${c.id}`}>
        <span>Até {formatDay(c.end, { day: "numeric", month: "short" })}</span>
        <span>
          Detalhes <ArrowRight size={15} />
        </span>
      </span>
    </>
  );
}
