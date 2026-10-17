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
import { deviceTimezone } from "./social";

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
      setMessage(
        "Avisos deste aparelho configurados. Eles param quando o treino sincroniza.",
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="push-panel">
      <h3>
        <BellRing size={18} /> Avisos com o app fechado
      </h3>
      {account.user && account.profileLoading ? (
        <p role="status">Carregando seu perfil…</p>
      ) : account.user && account.profileError ? (
        <p>{account.profileError}</p>
      ) : !account.user || !account.profile ? (
        <p>Entre na conta e salve seu perfil para ativar os avisos push.</p>
      ) : !pushPublicKey ? (
        <p>
          Em preparação: falta ativar o serviço de push. Os lembretes acima
          funcionam com o app aberto.
        </p>
      ) : !pushSupported() ? (
        <p>
          Seu navegador ainda não permite push aqui. No iPhone (iOS 16.4+),
          adicione à Tela de Início e abra o app pelo ícone.
        </p>
      ) : (
        <>
          <label htmlFor="push-hour">Primeiro toque do dia</label>
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
          <label htmlFor="push-tone">Como a chama te chama?</label>
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
            <option value="gentle">De leve 🙂</option>
            <option value="dramatic">Pode fazer drama 🎭</option>
          </select>
          <blockquote>
            {preferences.tone === "dramatic"
              ? "A chama ensaiou um discurso de despedida. Ainda dá tempo de evitar a cena. 🔥"
              : "Um passo de cada vez. Se hoje couber um treino, sua chama agradece. 🔥"}
          </blockquote>
          <small>
            Até 2 avisos por dia: no horário escolhido e às 21h se faltar treino
            online. Fuso: {deviceTimezone()}. O sistema pode atrasar a entrega.
          </small>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy
              ? "Configurando…"
              : enabled
                ? "Salvar avisos deste aparelho"
                : "Ativar push neste aparelho"}
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
                  setMessage("Push desativado neste aparelho.");
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
        </>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
