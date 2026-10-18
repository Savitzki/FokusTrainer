import { useState } from "react";
import { BellRing, Check, Flame, RefreshCw } from "lucide-react";
import type { SocialState } from "./social";
import { sendGroupWorkoutNotice } from "./groupNotifications";
export default function GroupWorkoutPrompt({
  groups,
  workoutId,
  nickname,
  onSkip,
  onSent,
  onSync,
}: {
  groups: SocialState["groups"];
  workoutId?: string;
  nickname: string;
  onSkip: () => void;
  onSent: (message: string) => void;
  onSync: () => Promise<void>;
}) {
  const [selected, setSelected] = useState(() =>
    groups.slice(0, 20).map((g) => g.id),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const chosen = groups.filter((g) => selected.includes(g.id));
  return (
    <div className="group-workout-prompt">
      <div className="group-prompt-flame" aria-hidden="true">
        <Flame size={48} fill="currentColor" />
      </div>
      <p className="group-prompt-copy">
        Tá pago! Vai dar aquela cutucada no time?
      </p>
      <blockquote>
        <strong>{nickname} acendeu a chama 🔥</strong>
        <span>Treino registrado. Bora manter essa chama viva?</span>
      </blockquote>
      {groups.length === 1 ? (
        <p className="group-prompt-name">{groups[0].name}</p>
      ) : (
        <fieldset className="group-notify-choices">
          <legend>Quem vai receber?</legend>
          {groups.map((g) => (
            <label key={g.id}>
              <input
                type="checkbox"
                disabled={
                  busy || (!selected.includes(g.id) && chosen.length >= 20)
                }
                checked={selected.includes(g.id)}
                onChange={(e) =>
                  setSelected((prev) =>
                    e.target.checked
                      ? [...prev, g.id]
                      : prev.filter((id) => id !== g.id),
                  )
                }
              />
              <span>{g.name}</span>
            </label>
          ))}
        </fieldset>
      )}
      {!workoutId && (
        <div className="group-prompt-sync" role="status">
          <span>Seu treino está salvo. Falta confirmar online para avisar</span>
          <button className="text-button" onClick={() => void onSync()}>
            <RefreshCw size={15} /> Sincronizar
          </button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="primary-button"
        disabled={busy || !workoutId || !chosen.length}
        onClick={async () => {
          if (!workoutId || busy || !chosen.length) return;
          setBusy(true);
          setError("");
          try {
            const result = await sendGroupWorkoutNotice(
              workoutId,
              chosen.map((g) => g.id),
            );
            onSent(
              result.sent
                ? "Aviso enviado aos aparelhos com notificações ativas"
                : result.queued
                  ? "Aviso na fila para uma nova tentativa de envio"
                  : result.already_sent
                    ? "Esse aviso já foi enviado"
                    : "Ninguém desses grupos tem avisos ativos no aparelho ainda",
            );
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? (
          <>
            <RefreshCw size={18} className="syncing" /> Enviando…
          </>
        ) : (
          <>
            <BellRing size={18} /> Avisar{" "}
            {chosen.length > 1 ? "os grupos" : "o grupo"}
          </>
        )}
      </button>
      <button
        className="text-button group-prompt-skip"
        disabled={busy}
        onClick={onSkip}
      >
        <Check size={17} /> Agora não
      </button>
    </div>
  );
}
