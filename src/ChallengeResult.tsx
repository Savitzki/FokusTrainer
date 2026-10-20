import { useState } from "react";
import { Equal, Flag, RotateCcw, Share2, Trophy } from "lucide-react";
import type { Challenge } from "./gamification";
import Mascot from "./Mascot";
import ArenaAvatar from "./ArenaAvatar";
import { formatDay } from "./model";
export function challengeResultTitle(c: Challenge) {
  if (c.cancelReason === "participation-ended") return "Participação encerrada";
  if (c.cancelled) return "Desafio cancelado";
  if (c.kind === "collective")
    return c.board.reduce((sum, p) => sum + p.completed, 0) >= c.target
      ? "Meta cumprida"
      : "Meta não alcançada";
  const winners = c.board.filter((p) => p.place === 1);
  return winners.length > 1
    ? "Empate"
    : winners.length === 1
      ? `Vitória de @${winners[0].nickname}`
      : "Sem pontuação final";
}
export default function ChallengeResult({
  challenge: c,
  onRematch,
}: {
  challenge: Challenge;
  onRematch?: () => void;
}) {
  const [feedback, setFeedback] = useState("");
  if (!c.closed) return null;
  const title = challengeResultTitle(c);
  const hasResult =
    !c.cancelled &&
    (c.kind === "collective"
      ? c.board.reduce((sum, p) => sum + p.completed, 0) >= c.target
      : c.board.some((p) => p.place === 1));
  const tied =
    !c.cancelled &&
    c.kind !== "collective" &&
    c.board.filter((p) => p.place === 1).length > 1;
  return (
    <section
      className={`arena-challenge-result ${c.cancelled ? "is-cancelled" : tied ? "is-tied" : hasResult ? "has-victory" : ""}`}
      aria-label="Resultado final"
    >
      <div className="arena-result-title">
        {c.cancelled ? (
          <Flag size={32} />
        ) : tied ? (
          <Equal size={32} />
        ) : hasResult ? (
          <Trophy size={32} />
        ) : (
          <Flag size={32} />
        )}
        <h3>{tied ? "EMPATE" : title}</h3>
        {hasResult && !tied && <Mascot pose="celebrating" size={72} />}
      </div>
      <p className="field-hint">
        {c.kind === "collective"
          ? "Cooperativo"
          : c.kind === "frequency"
            ? "Quantidade de treinos"
            : "Consistência"}{" "}
        · {formatDay(c.start)} → {formatDay(c.end)}
      </p>
      {c.closedAt && (
        <small>
          Encerrado em {new Date(c.closedAt).toLocaleDateString("pt-BR")}
        </small>
      )}
      {c.cancelReason === "participation-ended" && (
        <p className="field-hint">
          Sua participação foi encerrada com a amizade
        </p>
      )}
      {c.cancelReason === "friendship-ended" && (
        <p className="field-hint">Amizade encerrada · sem vencedor</p>
      )}
      <div className="arena-result-people">
        {c.participants.map((p) => {
          const score = c.board.find((value) => value.id === p.id);
          const label = !score
            ? "—"
            : c.kind === "consistency"
              ? score.percent == null
                ? "—"
                : `${score.percent.toLocaleString("pt-BR")}%`
              : `${score.completed} treinos`;
          return (
            <div key={p.id ?? p.nickname}>
              <ArenaAvatar
                name={p.nickname}
                avatar={p.avatar}
                frame={p.frame}
              />
              <span>@{p.nickname}</span>
              <strong>{label}</strong>
            </div>
          );
        })}
      </div>
      <div className="form-actions">
        {onRematch && (
          <button className="outline-button" onClick={onRematch}>
            <RotateCcw size={16} /> Pedir revanche
          </button>
        )}
        {!c.cancelled && (
          <button
            className="text-button"
            onClick={async () => {
              const text = [
                title,
                `${c.name} · ${c.start} → ${c.end}`,
                ...c.board.map(
                  (p) =>
                    `@${p.nickname}: ${c.kind === "consistency" ? (p.percent == null ? "sem referência" : `${p.percent}%`) : `${p.completed} treinos`}`,
                ),
              ].join("\n");
              try {
                if (navigator.share)
                  await navigator.share({
                    title: "Capibora · Resultado",
                    text,
                  });
                else if (navigator.clipboard) {
                  await navigator.clipboard.writeText(text);
                  setFeedback("Resultado copiado");
                } else
                  setFeedback("Compartilhamento indisponível neste navegador");
              } catch {
                setFeedback("Compartilhamento não concluído");
              }
            }}
          >
            <Share2 size={16} /> Compartilhar
          </button>
        )}
      </div>
      {feedback && <p role="status">{feedback}</p>}
    </section>
  );
}
