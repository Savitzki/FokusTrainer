import { readArenaInbox } from "./arenaTaunts";
import { useGameResource } from "./useGamification";
export default function ArenaTauntPreferences({ userId }: { userId: string }) {
  const inbox = useGameResource(userId, "get_arena_inbox", {}, readArenaInbox);
  return (
    <div className="arena-taunt-preferences">
      {inbox.sync?.initialLoading && <p role="status">Carregando…</p>}
      {inbox.error && (
        <p className="form-error" role="alert">
          {inbox.error}
        </p>
      )}
      {inbox.state && (
        <>
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
            Receber revides por notificação
          </label>
        </>
      )}
    </div>
  );
}
