import ArenaAvatar from "./ArenaAvatar";
import ChallengeResult from "./ChallengeResult";
import type { Challenge } from "./gamification";
import type { Profile } from "./profile";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Trophy,
  Users,
  ArrowRight,
  Flag,
  X,
  CalendarCheck,
  Dumbbell,
} from "lucide-react";
import { backendRpc } from "./backend";
import { readChallenges } from "./gamification";
import { useGameResource } from "./useGamification";
import { deviceTimezone } from "./social";
import { formatDay } from "./model";
import { MedalIcon } from "./GamificationPanels";
import type { AchievementRarity } from "./achievements";

export default function ChallengesPanel({
  userId,
  friends,
  onChanged,
  currentProfile,
  currentFrame,
  arenaVersion = 1,
  initialFriend,
  onQuickHandled,
}: {
  userId: string;
  arenaVersion?: number;
  initialFriend?: string;
  onQuickHandled?: () => void;
  friends: { id: string; nickname: string; avatar?: Profile; frame?: string }[];
  currentProfile?: Profile | null;
  currentFrame?: string;
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
  const request = useRef(crypto.randomUUID()),
    submitting = useRef(false);
  const [rematch, setRematch] = useState<Challenge | null>(null);
  const [fixedOpponent, setFixedOpponent] = useState<string>();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (creating) {
      formRef.current?.focus({ preventScroll: true });
      formRef.current?.scrollIntoView?.({ block: "start" });
    }
  }, [creating, fixedOpponent, rematch?.id]);
  useEffect(() => {
    if (initialFriend && friends.some((f) => f.id === initialFriend)) {
      setSelected([initialFriend]);
      setFixedOpponent(initialFriend);
      setCreating(true);
      setHistory(false);
      setRematch(null);
      setName("Desafio em dupla");
      request.current = crypto.randomUUID();
      onQuickHandled?.();
    }
  }, [initialFriend, friends, onQuickHandled]);
  function prepareRematch(c: Challenge) {
    const opponent = c.participants.find((p) => p.id !== userId && p.accepted);
    if (!opponent?.id) return;
    setRematch(c);
    setSelected([opponent.id]);
    setFixedOpponent(opponent.id);
    setKind(c.kind);
    setTarget(c.target);
    const days =
      Math.round((Date.parse(c.end) - Date.parse(c.start)) / 86400000) + 1;
    setDuration([7, 14, 28].includes(days) ? days : 28);
    setRecordingPolicy(c.recordingPolicy ?? "any");
    setName(`Revanche · ${c.name}`.slice(0, 40));
    request.current = crypto.randomUUID();
    setCreating(true);
    setHistory(false);
  }
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
  const activeCount = challenges.state?.filter(
    (c) => !c.closed && !c.invited,
  ).length;
  return (
    <section className="challenge-panel" aria-labelledby="challenge-heading">
      <div className="arena-section-heading">
        <div>
          <h2 id="challenge-heading">Seus desafios</h2>
          {activeCount !== undefined && (
            <p className="arena-section-count">
              {activeCount} {activeCount === 1 ? "ativo" : "ativos"}
            </p>
          )}
        </div>
        <button
          className="outline-button"
          disabled={challenges.busy}
          aria-label={creating ? "Fechar criação de desafio" : "Novo desafio"}
          aria-expanded={creating}
          aria-controls="new-challenge-form"
          onClick={() => {
            request.current = crypto.randomUUID();
            setRematch(null);
            setFixedOpponent(undefined);
            setCreating((p) => !p);
          }}
        >
          {creating ? <X size={17} /> : <Plus size={17} />}
          {creating ? "Fechar" : "Criar"}
        </button>
      </div>
      {creating && (
        <form
          className="challenge-form"
          ref={formRef}
          tabIndex={-1}
          aria-label="Configurar desafio"
          id="new-challenge-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (submitting.current) return;
            submitting.current = true;
            try {
              const rpc =
                arenaVersion >= 2
                  ? "create_arena_challenge"
                  : recordingPolicy === "timed"
                    ? "create_recording_challenge"
                    : "create_friend_challenge";
              const args = {
                p_name: name,
                p_kind: kind,
                p_duration: duration,
                p_friends: selected,
                p_target: kind === "collective" ? target : null,
                p_timezone: deviceTimezone(),
                ...(arenaVersion >= 2
                  ? {
                      p_request: request.current,
                      p_recording_policy: recordingPolicy,
                      p_rematch: rematch?.id ?? null,
                    }
                  : recordingPolicy === "timed"
                    ? { p_recording_policy: recordingPolicy }
                    : {}),
              };
              if (await challenges.act(rpc, args)) {
                setCreating(false);
                setName("");
                setSelected([]);
                setRematch(null);
                onChanged();
              }
            } finally {
              submitting.current = false;
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
            <select
              aria-label="Objetivo"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="consistency">
                Consistência · cumpra seu cronograma
              </option>
              <option value="collective">Coletivo · somem treinos</option>
              <option value="frequency">
                {arenaVersion >= 2
                  ? "Quantidade de treinos válidos"
                  : "Frequência · só treinos obrigatórios"}
              </option>
            </select>
          </label>
          <label className="form-label">
            Duração
            <select
              aria-label="Duração"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              <option value={7}>7 dias</option>
              {arenaVersion >= 2 ? (
                <>
                  <option value={14}>14 dias</option>
                  <option value={28}>28 dias</option>
                </>
              ) : (
                <option value={30}>30 dias</option>
              )}
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
              aria-label="Métodos aceitos"
              value={recordingPolicy}
              onChange={(e) => setRecordingPolicy(e.target.value)}
            >
              <option value="any">Qualquer treino válido</option>
              <option value="timed">Somente treinos cronometrados</option>
            </select>
          </label>
          <fieldset className="challenge-friends">
            <legend>
              {fixedOpponent ? "Participantes" : "Convide até 7 amigos"}
            </legend>
            {friends
              .filter((f) => !fixedOpponent || f.id === fixedOpponent)
              .map((f) => (
                <label key={f.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(f.id)}
                    disabled={
                      Boolean(fixedOpponent) ||
                      (!selected.includes(f.id) && selected.length >= 7)
                    }
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
              início · uma confirmação por dia · empates compartilham a posição
              {arenaVersion >= 2
                ? " · sem recompensa financeira"
                : " · só treinos obrigatórios contam"}
            </p>
          </details>
          {rematch && (
            <p className="field-hint">
              Novo convite, sem transferir pontos
              {Math.round(
                (Date.parse(rematch.end) - Date.parse(rematch.start)) /
                  86400000,
              ) +
                1 ===
              30
                ? " · duração anterior de 30 dias adaptada para 28; revise antes de enviar"
                : ""}
            </p>
          )}
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
      {challenges.state &&
        (history
          ? [
              {
                label: "Histórico",
                items: challenges.state.filter((c) => c.closed),
              },
            ]
          : [
              {
                label: "Em andamento",
                items: challenges.state.filter((c) => !c.closed && !c.invited),
              },
              {
                label: "Convites",
                items: challenges.state.filter((c) => !c.closed && c.invited),
              },
            ]
        )
          .filter((section) => section.items.length > 0)
          .map((section) => (
            <section
              className="challenge-section"
              key={section.label}
              aria-label={section.label}
            >
              {section.label === "Convites" && (
                <h3 className="challenge-invite-heading">
                  Convites <span>{section.items.length}</span>
                </h3>
              )}
              {section.items.map((c, index) => {
                const total = c.board.reduce((sum, p) => sum + p.completed, 0);
                const ownResult = c.board.find((p) => p.id === userId);
                const presented = {
                  ...c,
                  participants: c.participants.map((p) => {
                    const person =
                      p.id === userId
                        ? {
                            avatar: currentProfile ?? undefined,
                            frame: currentFrame,
                          }
                        : friends.find((f) => f.id === p.id);
                    return {
                      ...p,
                      avatar: p.avatar ?? person?.avatar,
                      frame: p.frame ?? person?.frame,
                    };
                  }),
                };
                return (
                  <details
                    key={c.id}
                    className={`challenge-card ${!history && !c.invited && index === 0 ? "challenge-featured" : ""} ${history ? "challenge-archived" : ""}`}
                  >
                    <summary
                      className="challenge-summary"
                      aria-label={`Detalhes de ${c.name}`}
                      aria-describedby={`challenge-status-${c.id} challenge-progress-${c.id} challenge-meta-${c.id} challenge-people-${c.id}`}
                    >
                      <span className="challenge-summary-top">
                        <strong>{c.name}</strong>
                        <span
                          className="challenge-status"
                          id={`challenge-status-${c.id}`}
                        >
                          {c.cancelled
                            ? c.cancelReason === "participation-ended"
                              ? "Participação encerrada"
                              : "Cancelado"
                            : c.closed
                              ? "Encerrado"
                              : c.invited
                                ? "Convite"
                                : c.state === "scheduled"
                                  ? "Programado"
                                  : "Em disputa"}
                        </span>
                      </span>
                      <span className="challenge-kind">
                        {c.kind === "collective" ? (
                          <Users size={14} />
                        ) : c.kind === "consistency" ? (
                          <CalendarCheck size={14} />
                        ) : (
                          <Dumbbell size={14} />
                        )}
                        {c.kind === "collective"
                          ? "Coletivo"
                          : c.kind === "consistency"
                            ? "Consistência"
                            : "Frequência"}
                      </span>
                      <span
                        className="challenge-summary-progress"
                        id={`challenge-progress-${c.id}`}
                      >
                        {c.kind === "collective" ? (
                          <>
                            <Users size={16} aria-hidden="true" />
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
                                <strong>{ownResult.completed}</strong> treinos
                                válidos
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
                      {c.kind === "consistency" &&
                        ownResult?.percent != null && (
                          <progress
                            aria-label={`Cumprimento do plano em ${c.name}`}
                            value={Math.min(100, ownResult.percent)}
                            max={100}
                          />
                        )}
                      <span
                        className="challenge-participants"
                        id={`challenge-people-${c.id}`}
                        aria-label={`${c.participants.length} participantes`}
                      >
                        <span className="group-avatar-stack" aria-hidden="true">
                          {c.participants.slice(0, 4).map((participant, i) => {
                            const person =
                              participant.id === userId
                                ? {
                                    avatar: currentProfile ?? undefined,
                                    frame: currentFrame,
                                  }
                                : friends.find(
                                    (friend) => friend.id === participant.id,
                                  );
                            return (
                              <ArenaAvatar
                                key={participant.id ?? i}
                                name={participant.nickname}
                                avatar={person?.avatar}
                                frame={person?.frame}
                              />
                            );
                          })}
                        </span>
                        <small title={`${c.participants.length} participantes`}>
                          {c.participants.length}
                        </small>
                      </span>
                      <span
                        className="challenge-summary-meta"
                        id={`challenge-meta-${c.id}`}
                      >
                        <span>
                          Até{" "}
                          {formatDay(c.end, { day: "numeric", month: "short" })}
                        </span>
                        <span className="group-summary-link">
                          Detalhes <ArrowRight size={15} />
                        </span>
                      </span>
                    </summary>
                    <div className="challenge-detail-body">
                      {c.closed && (
                        <ChallengeResult
                          challenge={presented}
                          onRematch={
                            arenaVersion >= 2 &&
                            !c.cancelled &&
                            c.participants.filter((p) => p.accepted).length ===
                              2 &&
                            c.participants.some(
                              (p) => p.id === userId && p.accepted,
                            ) &&
                            c.participants.some(
                              (p) =>
                                p.id !== userId &&
                                friends.some((f) => f.id === p.id),
                            )
                              ? () => prepareRematch(c)
                              : undefined
                          }
                        />
                      )}
                      {c.recordingPolicy === "timed" && (
                        <p className="field-hint">
                          Somente treinos cronometrados
                        </p>
                      )}
                      <p className="field-hint">
                        {formatDay(c.start, { day: "numeric", month: "short" })}{" "}
                        → {formatDay(c.end, { day: "numeric", month: "short" })}{" "}
                        ·{" "}
                        {c.kind === "consistency"
                          ? "Cumprimento do próprio cronograma"
                          : c.kind === "frequency"
                            ? c.ruleVersion === 2
                              ? "Uma confirmação válida por dia"
                              : "Treinos obrigatórios, sem extras"
                            : "Meta conjunta de treinos obrigatórios"}
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
                              (c.ruleVersion === 2 && c.state
                                ? c.state !== "scheduled"
                                : Date.now() >= Date.parse(c.inviteUntil))
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
                              {p.place === 1 ? "🏅" : (p.place ?? "—")} @
                              {p.nickname}
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
                      {c.cancelled &&
                        c.cancelReason !== "friendship-ended" &&
                        c.cancelReason !== "participation-ended" && (
                          <p className="field-hint">
                            Participação ou cronograma insuficiente · sem
                            recompensas
                          </p>
                        )}
                    </div>
                  </details>
                );
              })}
            </section>
          ))}
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
  badges: {
    name: string;
    icon: string;
    earnedAt: string;
    medalKey?: string;
    rarity?: AchievementRarity;
  }[];
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
        <ArrowRight size={18} aria-hidden="true" />
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
                <MedalIcon
                  icon={b.icon}
                  medalKey={b.medalKey}
                  rarity={b.rarity}
                />
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
