import ChallengeResult from "./ChallengeResult";
import type { Challenge } from "./gamification";
import { formatDay } from "./model";
import { deviceTimezone } from "./social";

export default function ArenaChallengeDetails({
  challenge: c,
  busy,
  act,
  onChanged,
  onRematch,
}: {
  challenge: Challenge;
  busy: boolean;
  act: (name: string, args: Record<string, unknown>) => Promise<boolean>;
  onChanged: () => void;
  onRematch?: () => void;
}) {
  const total = c.board.reduce((sum, p) => sum + p.completed, 0);
  return (
    <div className="challenge-detail-body">
      {(c.closed || c.invited) && (
        <dl className="arena-challenge-dates">
          <div>
            <dt>Início</dt>
            <dd>{formatDay(c.start)}</dd>
          </div>
          <div>
            <dt>Encerramento previsto</dt>
            <dd>{formatDay(c.end)}</dd>
          </div>
          {c.closedAt && (
            <div>
              <dt>Encerramento efetivo</dt>
              <dd>{new Date(c.closedAt).toLocaleString("pt-BR")}</dd>
            </div>
          )}
        </dl>
      )}
      {c.closed && <ChallengeResult challenge={c} onRematch={onRematch} />}
      {c.recordingPolicy === "timed" && (
        <p className="field-hint">Somente treinos cronometrados</p>
      )}
      {(c.closed || c.invited || c.state === "scheduled") && (
        <p className="field-hint">
          {formatDay(c.start, { day: "numeric", month: "short" })} →{" "}
          {formatDay(c.end, { day: "numeric", month: "short" })} ·{" "}
          {c.kind === "consistency"
            ? "Cumprimento do próprio cronograma"
            : c.kind === "frequency"
              ? c.ruleVersion === 2
                ? "Uma confirmação válida por dia"
                : "Treinos obrigatórios, sem extras"
              : "Meta conjunta de treinos obrigatórios"}
        </p>
      )}
      {c.kind === "collective" &&
        c.closed &&
        !c.cancelled &&
        total >= c.target && <p className="field-hint">Concluído ✓</p>}
      {!c.closed && (c.invited || c.participants.length > 2) && (
        <h3 className="challenge-detail-heading">
          {c.kind === "collective"
            ? "Progresso dos participantes"
            : "Classificação"}
        </h3>
      )}
      {c.invited && !c.closed && (
        <div className="challenge-actions">
          <button
            className="primary-button"
            disabled={
              busy ||
              (c.ruleVersion === 2 && c.state
                ? c.state !== "scheduled"
                : Date.now() >= Date.parse(c.inviteUntil))
            }
            onClick={async () => {
              if (
                await act("reply_challenge_invite", {
                  p_id: c.id,
                  p_accept: true,
                  p_timezone: deviceTimezone(),
                })
              )
                onChanged();
            }}
          >
            Aceitar
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              void act("reply_challenge_invite", {
                p_id: c.id,
                p_accept: false,
                p_timezone: deviceTimezone(),
              })
            }
          >
            Recusar
          </button>
        </div>
      )}
      {!c.closed && (c.invited || c.participants.length > 2) && (
        <ol className="challenge-board">
          {c.board.map((p, i) => (
            <li key={p.id ?? i}>
              <span>
                {c.cancelled ? "—" : (p.place ?? "—")} @{p.nickname}
              </span>
              <strong>
                {c.kind === "consistency"
                  ? p.percent === null
                    ? "—"
                    : `${p.percent.toLocaleString("pt-BR")}%`
                  : `${p.completed} treinos`}
              </strong>
            </li>
          ))}
        </ol>
      )}
      {c.participants.some((p) => !p.accepted) && !c.closed && (
        <small className="field-hint">
          Aguardando aceite:{" "}
          {c.participants
            .filter((p) => !p.accepted)
            .map((p) => p.nickname)
            .join(", ")}
        </small>
      )}
      {c.cancelled &&
        c.cancelReason !== "friendship-ended" &&
        c.cancelReason !== "participation-ended" && (
          <p className="field-hint">
            Participação ou cronograma insuficiente · sem recompensas
          </p>
        )}
    </div>
  );
}
