import { useState } from "react";
import { readArenaInbox } from "./arenaTaunts";
import { useGameResource } from "./useGamification";
export default function ArenaTauntPreferences({ userId }: { userId: string }) {
  const [saved, setSaved] = useState(false);
  const inbox = useGameResource(
    userId,
    "get_arena_inbox",
    { p_version: 3 },
    readArenaInbox,
  );
  async function save(muted: boolean, push: boolean) {
    setSaved(false);
    setSaved(
      await inbox.act("set_arena_social_preferences", {
        p_muted: muted,
        p_push: push,
      }),
    );
  }
  return (
    <div className="arena-taunt-preferences">
      {inbox.sync?.initialLoading && <p role="status">Carregando…</p>}
      {inbox.error && (
        <p className="form-error" role="alert">
          {inbox.error}
        </p>
      )}
      {saved && <p role="status">Preferências salvas</p>}
      {inbox.state && (
        <>
          <label>
            <input
              type="checkbox"
              checked={!inbox.state.muted}
              disabled={inbox.busy}
              onChange={(e) => void save(!e.target.checked, e.target.checked)}
            />{" "}
            Permitir provocações
          </label>
        </>
      )}
    </div>
  );
}
