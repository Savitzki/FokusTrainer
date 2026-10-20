import { useRef, useState } from "react";
import CapiboraMessage from "./CapiboraMessage";
import { capiboraMessage } from "./capiboraVoice";

export default function NotificationOptIn({
  onEnable,
  onDecline,
  onDismiss,
}: {
  onEnable: () => Promise<void>;
  onDecline: () => Promise<void>;
  onDismiss: () => void;
}) {
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  const pending = useRef(false);
  const [error, setError] = useState("");
  async function choose(choice: "yes" | "no") {
    if (pending.current) return;
    pending.current = true;
    setBusy(choice);
    setError("");
    try {
      // Invoked in the click gesture, so the native permission can open on iOS.
      await (choice === "yes" ? onEnable() : onDecline());
      onDismiss();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar sua escolha. Tente novamente",
      );
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }
  return (
    <div className="notification-opt-in">
      <CapiboraMessage
        message={capiboraMessage("notification-invite")}
        variant="centered"
        heading="strong"
        size={144}
      />
      <p>Sem cobranças nos dias de descanso</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="notification-opt-in-actions">
        <button
          className="primary-button"
          disabled={Boolean(busy)}
          onClick={() => void choose("yes")}
        >
          {busy === "yes" ? "Ativando…" : "SIM"}
        </button>
        <button
          className="outline-button"
          disabled={Boolean(busy)}
          onClick={() => void choose("no")}
        >
          {busy === "no" ? "Salvando…" : "NÃO"}
        </button>
      </div>
    </div>
  );
}
