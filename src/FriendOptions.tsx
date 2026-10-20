import { useRef, useState } from "react";
import { Swords, Users, UserMinus } from "lucide-react";
import type { SocialState, useSocial } from "./social";

/** Actions live inside the existing profile dialog; destructive confirmation never stacks dialogs. */
export default function FriendOptions({
  friend,
  canRemove = true,
  busy,
  act,
  onChallenge,
  onCreateGroup,
  onRemoved,
  onConfirmChange,
  error,
}: {
  friend: SocialState["friends"][number];
  busy: boolean;
  canRemove?: boolean;
  act: ReturnType<typeof useSocial>["act"];
  onChallenge?: () => void;
  onCreateGroup?: () => void;
  onRemoved?: () => void;
  onConfirmChange?: (confirming: boolean) => void;
  error?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const removeButton = useRef<HTMLButtonElement>(null);
  const request = useRef(""),
    sending = useRef(false);
  function confirm(value: boolean) {
    setConfirming(value);
    onConfirmChange?.(value);
    if (!value) requestAnimationFrame(() => removeButton.current?.focus());
  }
  return confirming ? (
    <section aria-label="Confirmar remoção da amizade">
      <h3>Remover amizade com @{friend.nickname}?</h3>
      <p className="field-hint">
        Desafios 1 contra 1 em aberto serão cancelados, sem vencedor. Grupos e
        resultados anteriores permanecem.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button
          autoFocus
          className="outline-button"
          disabled={busy}
          onClick={() => confirm(false)}
        >
          Cancelar
        </button>
        <button
          className="primary-button danger-action"
          disabled={busy}
          onClick={async () => {
            if (sending.current) return;
            sending.current = true;
            try {
              if (
                await act("remove_friend", {
                  p_user: friend.id,
                  p_request: request.current,
                })
              )
                onRemoved?.();
            } finally {
              sending.current = false;
            }
          }}
        >
          Remover amizade
        </button>
      </div>
    </section>
  ) : (
    <div className="arena-rival-actions">
      {onChallenge && (
        <button
          className="primary-button"
          disabled={busy}
          onClick={onChallenge}
        >
          <Swords size={19} /> Desafiar
        </button>
      )}
      {canRemove && (
        <button
          ref={removeButton}
          className="outline-button danger-action"
          disabled={busy}
          onClick={() => {
            request.current = crypto.randomUUID();
            confirm(true);
          }}
        >
          <UserMinus size={18} /> Remover amizade
        </button>
      )}
      {onCreateGroup && (
        <button className="text-button" disabled={busy} onClick={onCreateGroup}>
          <Users size={18} /> Criar grupo
        </button>
      )}
    </div>
  );
}
