import { useState } from "react";
import { MessageCircle, Settings } from "lucide-react";
import { readArenaInbox } from "./arenaTaunts";
import { useGameResource } from "./useGamification";
import Mascot from "./Mascot";
export default function ArenaInbox({ userId }: { userId: string }) {
  const inbox = useGameResource(userId, "get_arena_inbox", {}, readArenaInbox),
    [preferences, setPreferences] = useState(false);
  const messages = inbox.state?.messages ?? [];
  return (
    <section className="arena-inbox" aria-label="Provocações recebidas">
      <div className="arena-section-heading">
        <h3>
          <MessageCircle size={16} /> Provocações
          {messages.some((m) => !m.seen)
            ? ` · ${messages.filter((m) => !m.seen).length}`
            : ""}
        </h3>
        <button
          className="icon-button"
          aria-label="Preferências de provocações"
          onClick={() => setPreferences(!preferences)}
        >
          <Settings size={16} />
        </button>
      </div>
      {inbox.error && (
        <p className="form-error" role="alert">
          {inbox.error}
          <button className="text-button" onClick={() => void inbox.refresh()}>
            Atualizar
          </button>
        </p>
      )}
      {preferences && inbox.state && (
        <div className="arena-taunt-preferences">
          <label>
            <input
              type="checkbox"
              checked={inbox.state.muted}
              disabled={inbox.busy}
              onChange={(e) =>
                void inbox.act("set_arena_social_preferences", {
                  p_muted: e.target.checked,
                  p_push: inbox.state!.push,
                })
              }
            />{" "}
            Silenciar provocações
          </label>
          <label>
            <input
              type="checkbox"
              checked={inbox.state.push}
              disabled={inbox.busy || inbox.state.muted}
              onChange={(e) =>
                void inbox.act("set_arena_social_preferences", {
                  p_muted: inbox.state!.muted,
                  p_push: e.target.checked,
                })
              }
            />{" "}
            Receber também por notificação
          </label>
          <small>
            Quando o serviço estiver disponível e a permissão estiver ativa
          </small>
        </div>
      )}
      {messages.length > 0 && (
        <details>
          <summary>{messages.length} recebidas</summary>
          {messages.map((m) => (
            <div className="arena-taunt-message" key={m.id}>
              <Mascot pose={m.pose} size={54} />
              <div>
                <strong>@{m.nickname}</strong>
                <p>{m.text}</p>
              </div>
              {!m.seen && (
                <button
                  className="text-button"
                  disabled={inbox.busy}
                  onClick={() =>
                    void inbox.act("acknowledge_arena_taunt", { p_id: m.id })
                  }
                >
                  Visto
                </button>
              )}
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
