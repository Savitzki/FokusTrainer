import ArenaChallengeWizard from "./ArenaChallengeWizard";
import ArenaChallengePreview from "./ArenaChallengePreview";
import ChallengeResult from "./ChallengeResult";
import type { Challenge } from "./gamification";
import type { Profile } from "./profile";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, Trophy, ArrowRight, Flag, X } from "lucide-react";
import { readChallenges } from "./gamification";
import { useGameResource } from "./useGamification";
import { deviceTimezone } from "./social";
import { formatDay } from "./model";

export default function ChallengesPanel({
  userId,
  friends,
  onChanged,
  currentProfile,
  currentFrame,
  arenaVersion = 1,
  initialFriend,
  onQuickHandled,
  onInvitesChanged,
}: {
  userId: string;
  arenaVersion?: number;
  initialFriend?: string;
  onQuickHandled?: () => void;
  onInvitesChanged?: (count: number) => void;
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
    [filter, setFilter] = useState<"active" | "invites" | "history">("active"),
    [step, setStep] = useState(0),
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
  const history = filter === "history";
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
      setStep(0);
      setFilter("active");
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
    setStep(0);
    setFilter("active");
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
  const invitations = challenges.state?.filter(
    (c) => !c.closed && c.invited,
  ).length;
  useEffect(() => {
    if (invitations !== undefined) onInvitesChanged?.(invitations);
  }, [invitations, onInvitesChanged]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step < 2) {
      setStep((p) => p + 1);
      return;
    }
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
  }
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
            setStep(0);
            setCreating((p) => !p);
          }}
        >
          {creating ? <X size={17} /> : <Plus size={17} />}
          {creating ? "Fechar" : "Criar"}
        </button>
      </div>
      {creating && (
        <ArenaChallengeWizard
          draft={{ name, kind, duration, target, recordingPolicy, selected }}
          controls={{
            name: setName,
            kind: setKind,
            duration: setDuration,
            target: setTarget,
            recordingPolicy: setRecordingPolicy,
            selected: setSelected,
          }}
          step={step}
          setStep={setStep}
          formRef={formRef}
          onSubmit={submit}
          challenges={challenges}
          friends={friends}
          arenaVersion={arenaVersion}
          fixedOpponent={fixedOpponent}
          rematch={rematch}
        />
      )}
      {!creating && (
        <div
          className="challenge-filters"
          role="group"
          aria-label="Filtrar desafios"
        >
          <button
            aria-pressed={filter === "active"}
            onClick={() => setFilter("active")}
          >
            Ativos
          </button>
          <button
            aria-pressed={filter === "invites"}
            onClick={() => setFilter("invites")}
          >
            Convites{invitations ? ` · ${invitations}` : ""}
          </button>
          <button
            aria-pressed={filter === "history"}
            onClick={() => setFilter("history")}
          >
            Histórico
          </button>
        </div>
      )}
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
      {!creating &&
        challenges.state &&
        (history
          ? [
              {
                label: "Histórico",
                items: challenges.state.filter((c) => c.closed),
              },
            ]
          : filter === "invites"
            ? [
                {
                  label: "Convites",
                  items: challenges.state.filter((c) => !c.closed && c.invited),
                },
              ]
            : [
                {
                  label: "Em andamento",
                  items: challenges.state.filter(
                    (c) => !c.closed && !c.invited,
                  ),
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
                    className={`challenge-card arena-competition-card ${c.kind === "collective" ? "is-mission" : c.participants.length === 2 ? "is-duel" : "is-ranking"} ${!history && !c.invited && index === 0 ? "challenge-featured" : ""} ${history ? "challenge-archived" : ""}`}
                  >
                    <summary
                      className="challenge-summary"
                      aria-label={`Detalhes de ${c.name}`}
                      aria-describedby={`challenge-status-${c.id} challenge-progress-${c.id} challenge-meta-${c.id}`}
                    >
                      <ArenaChallengePreview
                        challenge={presented}
                        userId={userId}
                      />
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
                              {p.place === 1 && !c.cancelled ? (
                                <Trophy size={15} aria-label="Primeiro lugar" />
                              ) : c.cancelled ? (
                                "—"
                              ) : (
                                (p.place ?? "—")
                              )}{" "}
                              @{p.nickname}
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
      {!creating &&
        challenges.state &&
        !challenges.state.some((c) =>
          history
            ? c.closed
            : !c.closed && (filter === "invites" ? c.invited : !c.invited),
        ) && (
          <div className="arena-empty">
            <Flag size={24} />
            <div>
              <h3>
                {history
                  ? "Nenhum desafio encerrado"
                  : filter === "invites"
                    ? "Nenhum convite pendente"
                    : "Nenhum desafio ativo"}
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
