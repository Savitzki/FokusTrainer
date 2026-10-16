import { useState } from "react";
import { Copy, Flame, RefreshCw, Users } from "lucide-react";
import type { Account } from "./account";
import { deviceTimezone, type useSocial } from "./social";

export default function SocialPanel({
  account,
  social,
  onProfile,
}: {
  account: Account;
  social: ReturnType<typeof useSocial>;
  onProfile: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const { state, busy, error, act, refresh } = social;
  return (
    <section id="social" className="panel social-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">NINGUÉM SOLTA A CHAMA</span>
          <h2>
            <Users size={22} /> Juntos
          </h2>
        </div>
        {state && (
          <button
            className="icon-button"
            aria-label="Sincronizar amigos e grupos"
            disabled={busy}
            onClick={() => void refresh()}
          >
            <RefreshCw size={19} />
          </button>
        )}
      </div>
      {!account.user || !account.profile ? (
        <div className="social-empty">
          <p>Sua chama + a de quem treina com você. 🔥</p>
          <p>
            Entre na conta e salve seu nick para adicionar amigos e criar
            grupos.
          </p>
          <button className="primary-button" onClick={onProfile}>
            Abrir meu perfil
          </button>
        </div>
      ) : (
        <>
          <p className="social-rule">
            Todos treinam, a ofensiva continua. Um dia sem completar e a
            contagem zera.
          </p>
          {social.pending && (
            <p role="status">
              Seu treino está salvo neste aparelho. Aguardando sincronização
              para contar no grupo…
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}{" "}
              <button
                className="text-button"
                disabled={busy}
                onClick={() => void refresh()}
              >
                Tentar novamente
              </button>
            </p>
          )}
          {!state ? (
            <p role="status">
              {busy
                ? "Conectando o time…"
                : "Seus grupos aparecerão aqui depois da conexão."}
            </p>
          ) : (
            <>
              <div className="friend-code">
                <label htmlFor="my-friend-code">Seu código de amigo</label>
                <div>
                  <input id="my-friend-code" readOnly value={state.code} />
                  <button
                    aria-label="Copiar código de amigo"
                    className="outline-button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(state.code);
                        setCopied(true);
                      } catch {
                        setCopied(false);
                      }
                    }}
                  >
                    <Copy size={18} />
                  </button>
                </div>
                {copied && <small role="status">Código copiado.</small>}
              </div>
              <form
                className="social-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void act("send_friend_request", { p_code: code.trim() });
                }}
              >
                <label htmlFor="friend-code">Adicionar amigo</label>
                <input
                  id="friend-code"
                  required
                  placeholder="Cole o código do seu amigo"
                  value={code}
                  pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
                  onChange={(e) => setCode(e.target.value)}
                />
                <button className="outline-button" disabled={busy}>
                  Enviar convite
                </button>
              </form>
              {state.requests.map((request) => (
                <div className="social-request" key={request.id}>
                  <span>
                    <strong>{request.nickname}</strong>
                    <small>
                      {request.incoming
                        ? "quer treinar com você"
                        : "convite enviado"}
                    </small>
                  </span>
                  {request.incoming && (
                    <div>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          void act("reply_friend_request", {
                            p_id: request.id,
                            p_accept: true,
                          })
                        }
                      >
                        Aceitar
                      </button>
                      <button
                        className="text-button muted"
                        disabled={busy}
                        onClick={() =>
                          void act("reply_friend_request", {
                            p_id: request.id,
                            p_accept: false,
                          })
                        }
                      >
                        Recusar
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <details className="group-create">
                <summary>
                  Criar grupo · {state.friends.length}{" "}
                  {state.friends.length === 1 ? "amigo" : "amigos"}
                </summary>
                {!state.friends.length ? (
                  <p>Adicione um amigo e espere ele aceitar o convite.</p>
                ) : (
                  <form
                    className="social-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void act("create_streak_group", {
                        p_name: name.trim(),
                        p_friends: selected,
                        p_timezone: deviceTimezone(),
                      });
                    }}
                  >
                    <label htmlFor="group-name">Nome do grupo</label>
                    <input
                      id="group-name"
                      required
                      maxLength={40}
                      value={name}
                      placeholder="Clube do só mais um treino"
                      onChange={(e) => setName(e.target.value)}
                    />
                    <fieldset>
                      <legend>Convide de 1 a 7 amigos</legend>
                      {state.friends.map((friend) => (
                        <label className="friend-option" key={friend.id}>
                          <input
                            type="checkbox"
                            checked={selected.includes(friend.id)}
                            disabled={
                              !selected.includes(friend.id) &&
                              selected.length >= 7
                            }
                            onChange={(e) =>
                              setSelected((prev) =>
                                e.target.checked
                                  ? [...prev, friend.id]
                                  : prev.filter((id) => id !== friend.id),
                              )
                            }
                          />
                          {friend.nickname}
                        </label>
                      ))}
                    </fieldset>
                    <small>
                      O grupo começa quando todos aceitarem. Fuso:{" "}
                      {deviceTimezone()}. Os participantes ficam fixos.
                    </small>
                    <button
                      className="primary-button"
                      disabled={busy || !selected.length}
                    >
                      Convidar para o grupo
                    </button>
                  </form>
                )}
              </details>
              <div className="group-list">
                {state.groups.map((group) => (
                  <article
                    className={`group-card ${group.completed ? "group-complete" : ""}`}
                    key={group.id}
                  >
                    <div className="group-heading">
                      <h3>{group.name}</h3>
                      <span>
                        <Flame
                          size={22}
                          fill={group.completed ? "currentColor" : "none"}
                        />
                        {group.streak}
                      </span>
                    </div>
                    <p>
                      {group.status === "pending"
                        ? "Esperando todos aceitarem"
                        : group.completed
                          ? "Todo mundo veio. Chama salva! 🔥"
                          : "A chama de hoje precisa de vocês."}
                    </p>
                    <ul>
                      {group.members.map((member) => (
                        <li key={member.id}>
                          <span>{member.nickname}</span>
                          <span
                            className={
                              member.accepted && member.trained
                                ? "member-lit"
                                : ""
                            }
                          >
                            {!member.accepted
                              ? "Convite pendente"
                              : member.trained
                                ? "🔥 Treinou"
                                : "○ Falta treinar"}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <small>
                      {group.timezone} · Recorde: {group.best} dias
                    </small>
                    {group.invited && (
                      <div className="form-actions">
                        <button
                          className="primary-button"
                          disabled={busy}
                          onClick={() =>
                            void act("reply_group_invite", {
                              p_id: group.id,
                              p_accept: true,
                            })
                          }
                        >
                          Entrar no grupo
                        </button>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() =>
                            void act("reply_group_invite", {
                              p_id: group.id,
                              p_accept: false,
                            })
                          }
                        >
                          Recusar
                        </button>
                      </div>
                    )}
                    {!group.invited && (
                      <details className="group-exit">
                        <summary>Opções do grupo</summary>
                        <p>
                          Sair encerra este grupo para todos. Para mudar
                          participantes, criem outro grupo.
                        </p>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() =>
                            void act("close_streak_group", { p_id: group.id })
                          }
                        >
                          Sair e encerrar grupo
                        </button>
                      </details>
                    )}
                  </article>
                ))}
              </div>
              <p className="privacy-note">
                Treinou offline? Abra o app com internet antes da meia-noite no
                fuso do grupo. Seu peso nunca aparece para os amigos.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
