import { selectCapiboraNotification } from "./capiboraVoice";
import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import type { Account } from "./account";
import {
  disablePush,
  enablePush,
  pushPublicKey,
  pushSupported,
  type PushPreferences,
} from "./push";

export function canConfigurePush(account: Account) {
  return Boolean(
    account.user &&
      account.profile &&
      !account.profileLoading &&
      !account.profileError &&
      pushPublicKey &&
      pushSupported(),
  );
}

export default function PushPanel({ account }: { account: Account }) {
  const storageKey = `fokus-push:${account.user?.id ?? "guest"}`;
  const [preferences, setPreferences] = useState<PushPreferences>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (
        saved?.hour >= 8 &&
        saved.hour <= 20 &&
        ["gentle", "dramatic"].includes(saved.tone)
      )
        return saved;
    } catch {
      /* Use defaults. */
    }
    return { hour: 18, tone: "gentle" };
  });
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!pushSupported() || !account.user) return;
    let cancelled = false;
    void navigator.serviceWorker
      .getRegistration()
      .then((r) => r?.pushManager.getSubscription())
      .then((s) => {
        if (!cancelled) setEnabled(Boolean(s));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [account.user?.id]);
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await enablePush(preferences);
      setEnabled(true);
      try {
        localStorage.setItem(storageKey, JSON.stringify(preferences));
      } catch {
        /* Server saved the preferences. */
      }
      setMessage("Avisos salvos");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const example = selectCapiboraNotification({
    category: "workout_reminder",
    day: new Date().toISOString().slice(0, 10),
    hour: preferences.hour,
    selectionKey: account.user?.id ?? "preview",
    tone: preferences.tone,
    facts: { pending: true },
  });
  if (!canConfigurePush(account)) return null;
  return (
    <div className="push-panel">
      <h3>
        <BellRing size={18} /> No celular
      </h3>
      <label htmlFor="push-hour">Horário dos avisos</label>
      <select
        id="push-hour"
        value={preferences.hour}
        onChange={(e) =>
          setPreferences((p) => ({ ...p, hour: Number(e.target.value) }))
        }
      >
        {Array.from({ length: 13 }, (_, i) => i + 8).map((hour) => (
          <option key={hour} value={hour}>
            {String(hour).padStart(2, "0")}:00
          </option>
        ))}
      </select>
      <label htmlFor="push-tone">Tom dos lembretes</label>
      <select
        id="push-tone"
        value={preferences.tone}
        onChange={(e) =>
          setPreferences((p) => ({
            ...p,
            tone: e.target.value as PushPreferences["tone"],
          }))
        }
      >
        <option value="gentle">De leve</option>
        <option value="dramatic">Com deboche</option>
      </select>
      <details className="context-details">
        <summary>Ver exemplo</summary>
        <blockquote>
          <strong>{example?.title}</strong>
          <br />
          {example?.body}
        </blockquote>
      </details>
      <button
        className="primary-button"
        disabled={busy}
        onClick={() => void save()}
      >
        {busy
          ? "Configurando…"
          : enabled
            ? "Salvar avisos"
            : "Ativar avisos neste aparelho"}
      </button>
      {enabled && (
        <button
          className="text-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await disablePush();
              setEnabled(false);
              setMessage("Avisos desativados neste aparelho.");
            } catch (error) {
              setMessage((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Desativar neste aparelho
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
