import { Check, Plus, UserPlus, Users, X } from "lucide-react";
import ArenaAvatar from "./ArenaAvatar";
import FriendOptions from "./FriendOptions";
import Mascot from "./Mascot";
import type { SocialState, useSocial } from "./social";
export default function ArenaFriends({
  state,
  userId,
  busy,
  act,
  error,
  onAdd,
  onOpen,
  onCreate,
  onChallenge,
}: {
  state: SocialState;
  userId: string;
  busy: boolean;
  act: ReturnType<typeof useSocial>["act"];
  error?: string;
  onAdd: () => void;
  onOpen: (id: string) => void;
  onCreate: (id: string) => void;
  onChallenge?: (id: string) => void;
}) {
  const incoming = state.requests.filter((r) => r.incoming),
    outgoing = state.requests.filter((r) => !r.incoming);
  return (
    <div className="arena-friends">
      <div className="arena-section-heading">
        <div>
          <span className="arena-kicker">ELENCO</span>
          <h2>Seus amigos</h2>
          <p className="arena-section-count">
            {state.friends.length}{" "}
            {state.friends.length === 1 ? "amigo" : "amigos"}
          </p>
        </div>
        <button
          className="outline-button"
          aria-label="Adicionar amigo"
          onClick={onAdd}
        >
          <Plus size={17} /> Adicionar
        </button>
      </div>
      {incoming.length > 0 && (
        <section className="friend-invites" aria-label="Solicitações recebidas">
          <h3>
            Convites <span>{incoming.length}</span>
          </h3>
          {incoming.map((r) => (
            <div className="friend-row" key={r.id}>
              <ArenaAvatar name={r.nickname} />
              <strong>{r.nickname}</strong>
              <button
                className="invite-accept"
                aria-label={`Aceitar amizade de ${r.nickname}`}
                disabled={busy}
                onClick={() =>
                  void act("reply_friend_request", {
                    p_id: r.id,
                    p_accept: true,
                  })
                }
              >
                <Check size={19} />
              </button>
              <button
                className="icon-button"
                aria-label={`Recusar amizade de ${r.nickname}`}
                disabled={busy}
                onClick={() =>
                  void act("reply_friend_request", {
                    p_id: r.id,
                    p_accept: false,
                  })
                }
              >
                <X size={18} />
              </button>
            </div>
          ))}
        </section>
      )}
      {state.friends.length > 0 && (
        <div className="friend-list">
          {state.friends.map((friend) => (
            <div className="friend-row" key={friend.id}>
              <ArenaAvatar
                name={friend.nickname}
                frame={friend.frame}
                avatar={friend.avatar}
              />
              <button
                className="friend-profile-link"
                id={`friend-open-${friend.id}`}
                aria-label={`Ver perfil de ${friend.nickname}`}
                onClick={() => onOpen(friend.id)}
              >
                <strong>{friend.nickname}</strong>
                <small>Ver ficha</small>
              </button>
              {state.arenaVersion ? (
                <FriendOptions
                  variant="list"
                  showPreferences={false}
                  friend={friend}
                  userId={userId}
                  busy={busy}
                  act={act}
                  error={error}
                  interactions={state.arenaVersion >= 2}
                  onCreateGroup={() => onCreate(friend.id)}
                  onChallenge={
                    state.arenaVersion >= 2 && onChallenge
                      ? () => onChallenge(friend.id)
                      : undefined
                  }
                />
              ) : (
                <button
                  className="icon-button"
                  aria-label={`Criar grupo com ${friend.nickname}`}
                  onClick={() => onCreate(friend.id)}
                >
                  <Users size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!state.friends.length && !incoming.length && (
        <div className="arena-empty arena-friends-empty">
          <Mascot pose="neutral" size={96} />
          <div>
            <h3>Quem treina com você?</h3>
            <p>Busque pelo @nick e envie um pedido</p>
          </div>
        </div>
      )}
      {outgoing.length > 0 && (
        <details className="sent-invites">
          <summary>
            <UserPlus size={15} /> Enviados · {outgoing.length}
          </summary>
          {outgoing.map((r) => (
            <div className="friend-row" key={r.id}>
              <ArenaAvatar name={r.nickname} />
              <strong>{r.nickname}</strong>
              <span className="request-waiting">Aguardando</span>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
