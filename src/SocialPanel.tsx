import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  Clock3,
  ClipboardPaste,
  Copy,
  Flame,
  Moon,
  Plus,
  RefreshCw,
  Share2,
  Trophy,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { Account } from "./account";
import {
  deviceTimezone,
  rankGroupMembers,
  type SocialState,
  type useSocial,
} from "./social";

type View = "groups" | "friends" | "add" | "code" | "create";
type Group = SocialState["groups"][number];

function friendCodeFromText(text: string) {
  return (
    text.match(
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/,
    )?.[0] ?? text.trim()
  );
}

function Initials({ name, lit = false }: { name: string; lit?: boolean }) {
  return (
    <span className={`team-avatar ${lit ? "is-lit" : ""}`} aria-hidden="true">
      {[...name].slice(0, 2).join("").toUpperCase()}
    </span>
  );
}

export default function SocialPanel({
  account,
  social,
  onProfile,
}: {
  account: Account;
  social: ReturnType<typeof useSocial>;
  onProfile: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const [view, setView] = useState<View>("groups");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  const { state, busy, error, act, refresh } = social;
  const friends = state?.friends ?? [];
  const chosen = friends.filter((friend) => selected.includes(friend.id));
  const filtered = friends.filter((friend) =>
    friend.nickname
      .toLocaleLowerCase("pt-BR")
      .includes(search.trim().toLocaleLowerCase("pt-BR")),
  );
  const incoming = state?.requests.filter((request) => request.incoming) ?? [];
  const outgoing = state?.requests.filter((request) => !request.incoming) ?? [];
  const isForm = ["add", "code", "create"].includes(view);

  function open(next: View) {
    setView(next);
    setNotice("");
    requestAnimationFrame(() =>
      panel.current?.scrollIntoView?.({
        block: "start",
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
          .matches
          ? "instant"
          : "smooth",
      }),
    );
  }
  function create(friendId?: string) {
    setSelected(friendId ? [friendId] : []);
    setSearch("");
    open("create");
  }
  async function copyCode() {
    if (!state) return;
    try {
      await navigator.clipboard.writeText(state.code);
      setNotice("Código copiado.");
    } catch {
      setNotice("Selecione o código abaixo para copiar.");
    }
  }

  return (
    <section ref={panel} id="social" className="panel social-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">CHAMA EM JOGO</span>
          <h1 id="page-title" className="page-title" tabIndex={-1}>
            <Trophy size={22} /> Arena
          </h1>
        </div>
        <div className="social-header-actions">
          {state && (
            <button
              className="icon-button"
              aria-label="Sincronizar amigos e grupos"
              disabled={busy}
              onClick={() => void refresh()}
            >
              <RefreshCw size={18} className={busy ? "syncing" : ""} />
            </button>
          )}
          <details className="social-help">
            <summary aria-label="Como funciona a ofensiva em grupo">
              <CircleHelp size={19} />
            </summary>
            <p>
              Treinos programados precisam ser confirmados no dia do grupo.
              Descansos válidos protegem a chama sem somar pontos. Treinou
              offline? Sincronize antes da meia-noite no fuso do grupo. A
              corrida diária usa a confirmação online.
            </p>
          </details>
        </div>
      </div>
      {account.user && account.profileLoading ? (
        <p role="status">Carregando seu perfil…</p>
      ) : account.user && account.profileError ? (
        <div className="form-error" role="alert">
          {account.profileError}
          <button className="text-button" onClick={account.retry}>
            Tentar novamente
          </button>
        </div>
      ) : !account.user || !account.profile ? (
        <div className="team-empty">
          <Users size={34} />
          <h3>Entre na disputa</h3>
          <p>Desafie seus amigos e mantenha a chama</p>
          <button className="primary-button" onClick={onProfile}>
            {account.user ? "Completar perfil" : "Entrar na Arena"}{" "}
            <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        <>
          {social.pending && (
            <p className="social-sync-note" role="status">
              <RefreshCw size={14} /> Treino salvo. Sincronizando…
            </p>
          )}
          {error && (
            <div className="form-error social-error" role="alert">
              <span>{error}</span>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => void refresh()}
              >
                Tentar novamente
              </button>
            </div>
          )}
          {notice && (
            <p className="social-feedback" role="status">
              {notice}
            </p>
          )}
          {!state ? (
            <p role="status">
              {busy ? "Conectando seu time…" : "Conecte para ver seu time."}
            </p>
          ) : (
            <>
              {isForm ? (
                <div className="social-flow-heading">
                  <button
                    className="icon-button"
                    aria-label="Voltar para amigos e grupos"
                    onClick={() =>
                      open(view === "create" ? "groups" : "friends")
                    }
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <h3>
                    {view === "add"
                      ? "Adicionar amigo"
                      : view === "code"
                        ? "Seu código"
                        : "Novo grupo"}
                  </h3>
                </div>
              ) : (
                <div className="social-tabs" aria-label="Grupos e amigos">
                  <button
                    aria-pressed={view === "groups"}
                    onClick={() => open("groups")}
                  >
                    Grupos <span>{state.groups.length}</span>
                  </button>
                  <button
                    aria-pressed={view === "friends"}
                    onClick={() => open("friends")}
                  >
                    Amigos{" "}
                    <span className={incoming.length ? "has-invites" : ""}>
                      {incoming.length || friends.length}
                    </span>
                  </button>
                </div>
              )}

              {view === "groups" && (
                <>
                  <div className="social-toolbar">
                    <button className="primary-button" onClick={() => create()}>
                      <Plus size={18} /> Novo grupo
                    </button>
                    <button
                      className="outline-button"
                      onClick={() => open("add")}
                    >
                      <UserPlus size={18} /> Adicionar
                    </button>
                  </div>
                  {!state.groups.length ? (
                    <div className="team-empty">
                      <Flame size={36} />
                      <h3>Seu primeiro time começa aqui.</h3>
                    </div>
                  ) : (
                    <div className="group-list">
                      {[...state.groups]
                        .sort((a, b) => Number(b.invited) - Number(a.invited))
                        .map((group) => (
                          <GroupCard
                            key={group.id}
                            group={group}
                            busy={busy}
                            act={act}
                          />
                        ))}
                    </div>
                  )}
                </>
              )}

              {view === "friends" && (
                <>
                  <div className="social-toolbar">
                    <button
                      className="primary-button"
                      onClick={() => open("add")}
                    >
                      <UserPlus size={18} /> Adicionar amigo
                    </button>
                    <button
                      className="outline-button"
                      onClick={() => open("code")}
                    >
                      <Share2 size={17} /> Meu código
                    </button>
                  </div>
                  {incoming.length > 0 && (
                    <div className="friend-invites">
                      <h3>
                        Convites <span>{incoming.length}</span>
                      </h3>
                      {incoming.map((request) => (
                        <div className="friend-row" key={request.id}>
                          <Initials name={request.nickname} />
                          <strong>{request.nickname}</strong>
                          <button
                            className="invite-accept"
                            aria-label={`Aceitar amizade de ${request.nickname}`}
                            disabled={busy}
                            onClick={() =>
                              void act("reply_friend_request", {
                                p_id: request.id,
                                p_accept: true,
                              })
                            }
                          >
                            <Check size={19} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Recusar amizade de ${request.nickname}`}
                            disabled={busy}
                            onClick={() =>
                              void act("reply_friend_request", {
                                p_id: request.id,
                                p_accept: false,
                              })
                            }
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {friends.length > 0 && (
                    <div className="friend-list">
                      <h3>
                        Seu time <span>{friends.length}</span>
                      </h3>
                      {friends.map((friend) => (
                        <div className="friend-row" key={friend.id}>
                          <Initials name={friend.nickname} />
                          <strong>{friend.nickname}</strong>
                          <button
                            className="friend-group-button"
                            aria-label={`Criar grupo com ${friend.nickname}`}
                            onClick={() => create(friend.id)}
                          >
                            <Plus size={16} /> Grupo
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {!friends.length && !incoming.length && (
                    <div className="team-empty">
                      <UserPlus size={34} />
                      <h3>Quem treina com você?</h3>
                      <p>Adicione pelo código ou envie o seu.</p>
                    </div>
                  )}
                  {outgoing.length > 0 && (
                    <details className="sent-invites">
                      <summary>Enviados · {outgoing.length}</summary>
                      {outgoing.map((request) => (
                        <div className="friend-row" key={request.id}>
                          <Initials name={request.nickname} />
                          <strong>{request.nickname}</strong>
                          <span className="request-waiting">Aguardando</span>
                        </div>
                      ))}
                    </details>
                  )}
                </>
              )}

              {view === "add" && (
                <form
                  className="social-form add-friend-form"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (
                      await act("send_friend_request", { p_code: code.trim() })
                    ) {
                      setCode("");
                      setView("friends");
                      setNotice("Convite enviado.");
                    }
                  }}
                >
                  <div className="flow-icon">
                    <UserPlus size={30} />
                  </div>
                  <label htmlFor="friend-code">Código do amigo</label>
                  <div className="friend-code-entry">
                    <input
                      id="friend-code"
                      disabled={busy}
                      required
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="Cole o código aqui"
                      value={code}
                      pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
                      onChange={(event) =>
                        setCode(friendCodeFromText(event.target.value))
                      }
                    />
                    {navigator.clipboard?.readText && (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Colar código do amigo"
                        onClick={async () => {
                          try {
                            setCode(
                              friendCodeFromText(
                                await navigator.clipboard.readText(),
                              ),
                            );
                          } catch {
                            setNotice("Cole o código no campo.");
                          }
                        }}
                      >
                        <ClipboardPaste size={20} />
                      </button>
                    )}
                  </div>
                  <button
                    className="primary-button social-submit"
                    disabled={busy || !code}
                  >
                    {busy ? "Enviando…" : "Enviar convite"}
                    <ArrowRight size={17} />
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => open("code")}
                  >
                    <Share2 size={16} /> Prefiro enviar meu código
                  </button>
                </form>
              )}

              {view === "code" && (
                <div className="my-friend-code">
                  <div className="flow-icon">
                    <Users size={32} />
                  </div>
                  <p>Compartilhe com quem treina com você.</p>
                  <input
                    aria-label="Seu código de amigo"
                    id="my-friend-code"
                    value={state.code}
                    readOnly
                    onFocus={(event) => event.target.select()}
                  />
                  <div className="social-toolbar">
                    <button
                      className="primary-button"
                      onClick={async () => {
                        if (!navigator.share) {
                          await copyCode();
                          return;
                        }
                        try {
                          await navigator.share({
                            title: "Treine comigo no FokusTrainer",
                            text: `Vamos manter a chama juntos? 🔥 Meu código no FokusTrainer: ${state.code}`,
                          });
                        } catch (error) {
                          if ((error as Error).name !== "AbortError")
                            await copyCode();
                        }
                      }}
                    >
                      <Share2 size={17} /> Compartilhar
                    </button>
                    <button
                      className="outline-button"
                      onClick={() => void copyCode()}
                    >
                      <Copy size={17} /> Copiar
                    </button>
                  </div>
                </div>
              )}

              {view === "create" &&
                (!friends.length ? (
                  <div className="team-empty">
                    <UserPlus size={34} />
                    <h3>Primeiro, um parceiro.</h3>
                    <button
                      className="primary-button"
                      onClick={() => open("add")}
                    >
                      Adicionar amigo <Plus size={17} />
                    </button>
                  </div>
                ) : (
                  <form
                    className="social-form create-group-form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!chosen.length) return;
                      if (
                        await act("create_streak_group", {
                          p_name: name.trim(),
                          p_friends: chosen.map((friend) => friend.id),
                          p_timezone: deviceTimezone(),
                        })
                      ) {
                        setName("");
                        setSelected([]);
                        setSearch("");
                        setView("groups");
                        setNotice("Convites enviados.");
                      }
                    }}
                  >
                    <label htmlFor="group-name">Nome do grupo</label>
                    <input
                      id="group-name"
                      disabled={busy}
                      required
                      maxLength={40}
                      value={name}
                      placeholder="Ex.: Treino das 7"
                      onChange={(event) => setName(event.target.value)}
                    />
                    <fieldset>
                      <legend>
                        Escolha seu time{" "}
                        <span aria-live="polite">{chosen.length}/7</span>
                      </legend>
                      {friends.length > 5 && (
                        <input
                          type="search"
                          disabled={busy}
                          className="friend-search"
                          aria-label="Buscar amigo para o grupo"
                          placeholder="Buscar amigo"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                        />
                      )}
                      <div className="friend-picker-list">
                        {filtered.map((friend) => {
                          const checked = chosen.some(
                            (person) => person.id === friend.id,
                          );
                          const disabled =
                            busy || (!checked && chosen.length >= 7);
                          return (
                            <label
                              className={`friend-picker ${checked ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`}
                              key={friend.id}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={disabled}
                                onChange={(event) =>
                                  setSelected((prev) =>
                                    event.target.checked
                                      ? [...prev, friend.id]
                                      : prev.filter((id) => id !== friend.id),
                                  )
                                }
                              />
                              <Initials name={friend.nickname} />
                              <strong>{friend.nickname}</strong>
                              <span
                                className="friend-pick-check"
                                aria-hidden="true"
                              >
                                {checked && <Check size={17} />}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      {!filtered.length && (
                        <p className="friend-search-empty">
                          Nenhum amigo encontrado.
                        </p>
                      )}
                    </fieldset>
                    <div className="group-selection-summary">
                      <Users size={17} />
                      <span>
                        Você
                        {chosen.length
                          ? ` + ${chosen.length} ${chosen.length === 1 ? "amigo" : "amigos"}`
                          : " + seu time"}
                      </span>
                    </div>
                    <button
                      className="primary-button social-submit"
                      disabled={busy || !chosen.length || !name.trim()}
                    >
                      {busy
                        ? "Enviando…"
                        : chosen.length
                          ? `Convidar ${chosen.length} ${chosen.length === 1 ? "amigo" : "amigos"}`
                          : "Escolha seus amigos"}
                      <ArrowRight size={17} />
                    </button>
                    <small className="group-start-note">
                      Começa quando todos aceitarem.
                    </small>
                  </form>
                ))}
            </>
          )}
        </>
      )}
    </section>
  );
}

function GroupCard({
  group,
  busy,
  act,
}: {
  group: Group;
  busy: boolean;
  act: ReturnType<typeof useSocial>["act"];
}) {
  const pending = group.status === "pending";
  const count = group.members.filter(
    (member) =>
      member.accepted && (pending || member.trained || member.resting),
  ).length;
  const total = group.members.length;
  const members = pending
    ? group.members.map((m) => ({ ...m, place: null }))
    : rankGroupMembers(group.members);
  return (
    <article
      className={`group-card ${group.completed ? "group-complete" : ""}`}
      aria-label={`Grupo ${group.name}`}
    >
      <div className="group-heading">
        <div>
          <h3>{group.name}</h3>
          <span
            className={`group-status ${group.completed ? "is-complete" : ""}`}
          >
            {group.resting ? (
              <>
                <Moon size={13} /> Descanso do time
              </>
            ) : group.completed ? (
              <>
                <Check size={13} /> Dia salvo
              </>
            ) : pending ? (
              "Formando o time"
            ) : (
              `${count}/${total} em dia`
            )}
          </span>
        </div>
        <div className={`group-streak ${group.completed ? "is-lit" : ""}`}>
          <Flame size={28} fill={group.completed ? "currentColor" : "none"} />
          <strong>{group.streak}</strong>
          <small>{group.streak === 1 ? "dia" : "dias"}</small>
        </div>
      </div>
      <div
        className="group-progress"
        role="progressbar"
        aria-label={
          pending
            ? `Convites aceitos em ${group.name}`
            : `Treinos de hoje em ${group.name}`
        }
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={count}
        aria-valuetext={`${count} de ${total} ${pending ? "aceitaram" : "em dia"}`}
      >
        {group.members.map((member) => (
          <span
            key={member.id}
            className={
              member.accepted && (pending || member.trained || member.resting)
                ? "is-filled"
                : ""
            }
          />
        ))}
      </div>
      {!pending && (
        <p className="group-race-heading">
          <Clock3 size={14} />
          Corrida de hoje
        </p>
      )}
      <ul
        className="group-members"
        style={{
          gridTemplateColumns: `repeat(${Math.min(total, 4)}, minmax(0, 1fr))`,
        }}
      >
        {members.map((member) => (
          <li key={member.id}>
            {!pending && (
              <span
                className={`member-place ${member.place === 1 ? "is-first" : member.place === null ? "is-pending" : ""}`}
                aria-label={
                  member.place !== null
                    ? `${member.place}º a confirmar o treino`
                    : undefined
                }
                aria-hidden={member.place === null}
              >
                {member.place === 1 && <Trophy size={11} />}
                {member.place !== null && `#${member.place}`}
              </span>
            )}
            <div className="member-avatar">
              <Initials
                name={member.nickname}
                lit={member.accepted && member.trained}
              />
              <span
                className={`member-badge ${member.accepted && member.trained ? "is-lit" : ""}`}
                aria-hidden="true"
              >
                {!member.accepted ? (
                  <Plus size={12} />
                ) : member.resting ? (
                  <Moon size={12} />
                ) : (
                  <Flame
                    size={12}
                    fill={member.trained ? "currentColor" : "none"}
                  />
                )}
              </span>
            </div>
            <strong title={member.nickname}>{member.nickname}</strong>
            <small>
              {!member.accepted
                ? "Convidado"
                : member.resting
                  ? "Descanso"
                  : member.trained
                    ? "Treinou"
                    : "Falta treinar"}
            </small>
            {member.accepted && member.trained && member.confirmedAt && (
              <time
                dateTime={member.confirmedAt}
                title={`Confirmado online no fuso ${group.timezone}`}
              >
                {new Date(member.confirmedAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  timeZone: group.timezone,
                })}
              </time>
            )}
          </li>
        ))}
      </ul>
      {group.invited && (
        <div className="group-invite-actions">
          <button
            className="primary-button"
            disabled={busy}
            onClick={() =>
              void act("reply_group_invite", { p_id: group.id, p_accept: true })
            }
          >
            <Check size={17} /> Entrar no grupo
          </button>
          <button
            className="icon-button"
            aria-label={`Recusar convite para ${group.name}`}
            disabled={busy}
            onClick={() =>
              void act("reply_group_invite", {
                p_id: group.id,
                p_accept: false,
              })
            }
          >
            <X size={18} />
          </button>
        </div>
      )}
      <div className="group-footer">
        <span>
          <Trophy size={14} /> Recorde {group.best}
        </span>
        <details className="group-details">
          <summary>Detalhes</summary>
          <div>
            <p>Fuso: {group.timezone}</p>
            {group.completedAt && !group.resting && (
              <p>
                Chama salva às{" "}
                {new Date(group.completedAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: group.timezone,
                })}
              </p>
            )}
            <p>
              Quem tem treino programado precisa confirmar no dia do grupo.
              Descansos válidos protegem a chama. Se todos descansarem, a
              sequência se mantém sem somar. Sincronize antes da meia-noite.
            </p>
            {!group.invited && (
              <>
                <p>Sair encerra o grupo para todos.</p>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    void act("close_streak_group", { p_id: group.id })
                  }
                >
                  Sair e encerrar grupo
                </button>
              </>
            )}
          </div>
        </details>
      </div>
    </article>
  );
}
