import { useState } from "react";
import { BellRing } from "lucide-react";

export default function NotificationOptIn({
  onEnable,
  onDismiss,
}: {
  onEnable: () => Promise<void>;
  onDismiss: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="notification-opt-in">
      <BellRing size={42} aria-hidden="true" />
      <p>Ative os lembretes para não deixar sua ofensiva apagar 🔥</p>
      <button
        className="primary-button"
        autoFocus
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onEnable();
            onDismiss();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Ativando…" : "Ativar notificações"}
      </button>
      <button className="text-button" disabled={busy} onClick={onDismiss}>
        Agora não
      </button>
    </div>
  );
}
