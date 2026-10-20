import { useEffect, useRef, useState } from "react";
import { Check, MessageCircle } from "lucide-react";
import Modal from "./Modal";
import Mascot from "./Mascot";
import type { SocialState, useSocial } from "./social";

export default function ArenaTauntButton({
  friend,
  allowance,
  busy,
  act,
  error,
}: {
  friend: SocialState["friends"][number];
  allowance?: SocialState["tauntAllowance"];
  busy: boolean;
  act: ReturnType<typeof useSocial>["act"];
  error?: string;
}) {
  const [open, setOpen] = useState(false),
    [sentDay, setSentDay] = useState<string>(),
    [feedback, setFeedback] = useState("");
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(""), 5000);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  const request = useRef(""),
    sending = useRef(false);
  const spent = Boolean(
    allowance &&
      (allowance.sentTo.includes(friend.id) || sentDay === allowance.day),
  );
  const unavailable = !allowance;
  const label = spent
    ? `Já provocou hoje: @${friend.nickname}`
    : unavailable
      ? "Provocações indisponíveis até atualizar a Arena"
      : `Provocar ${friend.nickname}`;
  return (
    <>
      <button
        className="icon-button arena-quick-taunt"
        title={label}
        aria-label={label}
        disabled={busy || spent || unavailable}
        onClick={() => {
          request.current = crypto.randomUUID();
          setOpen(true);
          setFeedback("");
        }}
      >
        {spent ? <Check size={18} /> : <MessageCircle size={18} />}
      </button>
      {feedback && (
        <span className="toast arena-taunt-feedback" role="status">
          {feedback}
        </span>
      )}
      {open && (
        <Modal
          title={`Provocar @${friend.nickname}`}
          compactHeader
          centered
          dismissible={false}
          closeDisabled={busy}
          onClose={() => setOpen(false)}
        >
          <div className="arena-taunt-confirmation">
            <Mascot pose="suspicious" size={120} />
            <p>
              Vou escolher uma provocação aleatória e entregar pra ele. Depois
              não reclama KKKKK
            </p>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button
              className="outline-button"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancelar
            </button>
            <button
              className="primary-button"
              disabled={busy || spent || unavailable}
              onClick={async () => {
                if (sending.current) return;
                sending.current = true;
                try {
                  if (
                    await act("send_arena_taunt", {
                      p_user: friend.id,
                      p_message: null,
                      p_request: request.current,
                    })
                  ) {
                    setSentDay(allowance?.day);
                    setOpen(false);
                    setFeedback("Provocação enviada");
                  }
                } finally {
                  sending.current = false;
                }
              }}
            >
              Confirmar provocação
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
