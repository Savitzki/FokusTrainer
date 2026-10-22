import { useRef, useState } from "react";
import SettingsSwitch from "./SettingsSwitch";
import { readArenaInbox } from "./arenaTaunts";
import { useGameResource } from "./useGamification";
export default function ArenaTauntPreferences({ userId }: { userId: string }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const inbox = useGameResource(
    userId,
    "get_arena_inbox",
    { p_version: 3 },
    readArenaInbox,
  );
  async function save(muted: boolean, push: boolean) {
    if (pending.current || inbox.busy) return;
    pending.current = true;
    setSaving(true);
    setSaved(false);
    try {
      setSaved(
        await inbox.act("set_arena_social_preferences", {
          p_muted: muted,
          p_push: push,
        }),
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
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
        <SettingsSwitch
          label="Permitir provocações"
          checked={!inbox.state.muted}
          disabled={inbox.busy || saving}
          onChange={(checked) => void save(!checked, checked)}
        />
      )}
    </div>
  );
}
