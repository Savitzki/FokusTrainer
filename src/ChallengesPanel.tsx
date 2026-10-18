import { useEffect, useRef, useState } from "react";
import { Plus, Trophy, Users, Award, ArrowRight, Flag, X } from "lucide-react";
import { backendRpc } from "./backend";
import { readChallenges } from "./gamification";
import { useGameResource } from "./useGamification";
import { deviceTimezone } from "./social";
import { formatDay } from "./model";
import { MedalIcon } from "./GamificationPanels";

export default function ChallengesPanel({
  userId,
  friends,
  onChanged,
}: {
  userId: string;
  friends: { id: string; nickname: string }[];
  onChanged: () => void;
}) {
  const challenges = useGameResource(
    userId,
    "get_friend_challenges",
    {},
    readChallenges,
  );
  const [creating, setCreating] = useState(false),
    [history, setHistory] = useState(false),
    [name, setName] = useState(""),
    [kind, setKind] = useState("consistency"),
    [duration, setDuration] = useState(7),
    [target, setTarget] = useState(10),
    [recordingPolicy, setRecordingPolicy] = useState("any"),
    [selected, setSelected] = useState<string[]>([]);
  const latest = useRef(onChanged);
  latest.current = onChanged;
  const closedIds =
    challenges.state
      ?.filter((c) => c.closed)
      .map((c) => c.id)
      .sort()
      .join(",") ?? "";
  useEffect(() => {
    if (closedIds) latest.current();
  }, [closedIds]);
  return (
    <section className="challenge-panel" aria-labelledby="challenge-heading">
      <div className="arena-section-heading">
        <h2 id="challenge-heading">Seus desafios</h2>
        <button
          className="outline-button"
          disabled={challenges.busy}
          aria-label={creating ? "Fechar criação de desafio" : "Novo desafio"}
          aria-expanded={creating}
          aria-controls="new-challenge-form"
          onClick={() => setCreating((p) => !p)}
        >
          {creating ? <X size={17} /> : <Plus size={17} />}
          {creating ? "Fechar" : "Novo"}
        </button>
      </div>
      {creating && (
        <form
          className="challenge-form"
          id="new-challenge-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await challenges.act(
                recordingPolicy === "timed"
                  ? "create_recording_challenge"
                  : "create_friend_challenge",
                {
                  p_name: name,
                  p_kind: kind,
                  p_duration: duration,
                  p_friends: selected,
                  p_target: kind === "collective" ? target : null,
                  p_timezone: deviceTimezone(),
                  ...(recordingPolicy === "timed"
                    ? { p_recording_policy: recordingPolicy }
                    : {}),
                },
              )
            ) {
              setCreating(false);
              setName("");
              setSelected([]);
              onChanged();
            }
          }}
        >
          <label className="form-label">
            Nome do desafio
            <input
              required
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="form-label">
            Objetivo
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="consistency">
                Consistência · cumpra seu cronograma
              </option>
              <option value="collective">Coletivo · somem treinos</option>
              <option value="frequency">
                Frequência · só treinos obrigatórios
              </option>
            </select>
          </label>
          <label className="form-label">
            Duração
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              <option value={7}>7 dias</option>
              <option value={30}>30 dias</option>
            </select>
          </label>
          {kind === "collective" && (
            <label className="form-label">
              Meta conjunta
              <input
                type="number"
                required
                min={1}
                max={210}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
              />
            </label>
          )}
          <label className="form-label">
            Métodos aceitos
            <select
              value={recordingPolicy}
              onChange={(e) => setRecordingPolicy(e.target.value)}
            >
              <option value="any">Qualquer treino válido</option>
              <option value="timed">Somente treinos cronometrados</option>
            </select>
          </label>
          <fieldset className="challenge-friends">
            <legend>Convide até 7 amigos</legend>
            {friends.map((f) => (
              <label key={f.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(f.id)}
                  disabled={!selected.includes(f.id) && selected.length >= 7}
                  onChange={() =>
                    setSelected((p) =>
                      p.includes(f.id)
                        ? p.filter((id) => id !== f.id)
                        : [...p, f.id],
                    )
                  }
                />
                @{f.nickname}
              </label>
            ))}
          </fieldset>
          {!friends.length && (
            <p className="field-hint">Adicione um amigo para começar</p>
          )}
          <details className="context-details">
            <summary>Regras do desafio</summary>
            <p>
              Começa em data futura · convites precisam de aceite antes do
              início · só treinos obrigatórios contam, uma vez por dia · empates
              compartilham a posição
            </p>
          </details>
          <button
            className="primary-button"
            disabled={challenges.busy || !selected.length}
          >
            Enviar convites
          </button>
        </form>
      )}
      <div
        className="challenge-filters"
        role="group"
        aria-label="Filtrar desafios"
      >
        <button aria-pressed={!history} onClick={() => setHistory(false)}>
          Ativos
        </button>
        <button aria-pressed={history} onClick={() => setHistory(true)}>
          Encerrados
        </button>
      </div>
      {challenges.error && (
        <p className="form-error" role="alert">
          {challenges.error}
          <button
            className="text-button"
            onClick={() => void challenges.refresh()}
          >
            Atualizar
          </button>
        </p>
      )}
      {!challenges.state && challenges.busy && (
        <p role="status">Buscando desafios…</p>
      )}
      {challenges.state
        ?.filter((c) => c.closed === history)
        .map((c) => {
          const total = c.board.reduce((sum, p) => sum + p.completed, 0);
          const ownResult = c.board.find((p) => p.id === userId);
          return (
            <details key={c.id} className="challenge-card">
              <summary
                className="challenge-summary"
                aria-label={`Detalhes de ${c.name}`}
                aria-describedby={`challenge-status-${c.id} challenge-progress-${c.id} challenge-meta-${c.id}`}
              >
                <span className="challenge-summary-top">
                  <strong>{c.name}</strong>
                  <span
                    className="challenge-status"
                    id={`challenge-status-${c.id}`}
                  >
                    {c.cancelled
                      ? "Cancelado"
                      : c.closed
                        ? "Encerrado"
                        : c.invited
                          ? "Convite"
                          : "Em disputa"}
                  </span>
                </span>
                <span
                  className="challenge-summary-progress"
                  id={`challenge-progress-${c.id}`}
                >
                  {c.kind === "collective" ? (
                    <>
                      <Users size={16} />
                      <strong>
                        {total}/{c.target}
                      </strong>{" "}
                      treinos
                    </>
                  ) : (
                    <>
                      <Trophy size={16} />
                      {c.kind === "consistency" ? (
                        ownResult?.percent != null ? (
                          <>
                            <strong>
                              {ownResult.percent.toLocaleString("pt-BR")}%
                            </strong>{" "}
                            do seu plano
                          </>
                        ) : (
                          "Sem resultado ainda"
                        )
                      ) : ownResult ? (
                        <>
                          <strong>{ownResult.completed}</strong> treinos válidos
                        </>
                      ) : (
                        "Sem resultado ainda"
                      )}
                    </>
                  )}
                </span>
                {c.kind === "collective" && (
                  <progress
                    aria-label={`Meta de ${c.name}`}
                    value={Math.min(total, c.target)}
                    max={c.target}
                  />
                )}
                <span
                  className="challenge-summary-meta"
                  id={`challenge-meta-${c.id}`}
                >
                  <span>
                    Até {formatDay(c.end, { day: "numeric", month: "short" })} ·{" "}
                    {c.participants.length} participantes
                  </span>
                  <span className="group-summary-link">
                    Detalhes <ArrowRight size={15} />
                  </span>
                </span>
              </summary>
              <div className="challenge-detail-body">
                {c.recordingPolicy === "timed" && (
                  <p className="field-hint">Somente treinos cronometrados</p>
                )}
                <p className="field-hint">
                  {formatDay(c.start, { day: "numeric", month: "short" })} →{" "}
                  {formatDay(c.end, { day: "numeric", month: "short" })} ·{" "}
                  {c.kind === "consistency"
                    ? "Cumprimento do próprio cronograma"
                    : c.kind === "frequency"
                      ? "Treinos obrigatórios, sem extras"
                      : "Objetivo compartilhado"}
                </p>
                {c.kind === "collective" &&
                  c.closed &&
                  !c.cancelled &&
                  total >= c.target && (
                    <p className="field-hint">Concluído ✓</p>
                  )}
                <h3 className="challenge-detail-heading">
                  {c.kind === "collective"
                    ? "Progresso dos participantes"
                    : "Classificação"}
                </h3>
                {c.invited && !c.closed && (
                  <div className="challenge-actions">
                    <button
                      className="primary-button"
                      disabled={
                        challenges.busy ||
                        Date.now() >= Date.parse(c.inviteUntil)
                      }
                      onClick={async () => {
                        if (
                          await challenges.act("reply_challenge_invite", {
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
                      disabled={challenges.busy}
                      onClick={() =>
                        void challenges.act("reply_challenge_invite", {
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
                <ol className="challenge-board">
                  {c.board.map((p, i) => (
                    <li key={p.id ?? i}>
                      <span>
                        {p.place === 1 ? "🏅" : (p.place ?? "—")} @{p.nickname}
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
                {c.participants.some((p) => !p.accepted) && !c.closed && (
                  <small className="field-hint">
                    Aguardando aceite:{" "}
                    {c.participants
                      .filter((p) => !p.accepted)
                      .map((p) => p.nickname)
                      .join(", ")}
                  </small>
                )}
                {c.cancelled && (
                  <p className="field-hint">
                    Participação ou cronograma insuficiente · sem recompensas
                  </p>
                )}
              </div>
            </details>
          );
        })}
      {challenges.state &&
        !challenges.state.some((c) => c.closed === history) && (
          <div className="arena-empty">
            <Flag size={24} />
            <div>
              <h3>
                {history ? "Nenhum desafio encerrado" : "Nenhum desafio ativo"}
              </h3>
              <p>
                {history
                  ? "Seus resultados ficam salvos aqui"
                  : "Convide um amigo para cumprir uma meta juntos"}
              </p>
            </div>
          </div>
        )}
    </section>
  );
}
type Showcase = {
  nickname: string;
  badges: { name: string; icon: string; earnedAt: string }[];
};
export function FriendMedals({
  id,
  nickname,
}: {
  id: string;
  nickname: string;
}) {
  const [open, setOpen] = useState(false),
    [value, setValue] = useState<Showcase | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="friend-medals">
      <button
        className="icon-button"
        aria-label={`Ver medalhas de ${nickname}`}
        aria-expanded={open}
        disabled={busy}
        onClick={async () => {
          if (open) {
            setOpen(false);
            return;
          }
          setBusy(true);
          setError("");
          try {
            const result = await backendRpc<Showcase>("get_friend_showcase", {
              p_user: id,
            });
            setValue(result);
            setOpen(true);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Award size={19} />
      </button>
      {open && (
        <div
          className="friend-medal-list"
          role="region"
          aria-label={`Medalhas de ${nickname}`}
        >
          {value?.badges.length ? (
            value.badges.map((b, i) => (
              <span key={i} title={b.name}>
                <MedalIcon icon={b.icon} />
                {b.name}
              </span>
            ))
          ) : (
            <small>Nenhuma medalha compartilhada</small>
          )}
        </div>
      )}
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
