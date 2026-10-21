import { useEffect, useRef, useState } from "react";
import { Check, MessageCircle } from "lucide-react";
import Modal from "./Modal";
import CapiboraMessage from "./CapiboraMessage";
import { capiboraMessage } from "./capiboraVoice";
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
  const trigger = useRef<HTMLButtonElement>(null);
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
        ref={trigger}
        className="outline-button arena-quick-taunt"
        title={label}
        aria-label={label}
        disabled={busy || spent || unavailable}
        onClick={() => {
          request.current = crypto.randomUUID();
          setOpen(true);
          setFeedback("");
        }}
      >
        {spent ? <Check size={15} aria-hidden="true" /> : <MessageCircle size={15} aria-hidden="true" />}
        {spent ? "Já provocou" : "Provocar"}
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
            <CapiboraMessage
              message={capiboraMessage("taunt-confirm")}
              variant="centered"
              size={120}
            />
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
                    // The original trigger is now disabled. Keep keyboard focus on this friend.
                    requestAnimationFrame(() =>
                      trigger.current
                        ?.closest(".friend-row")
                        ?.querySelector<HTMLButtonElement>(
                          ".friend-profile-link",
                        )
                        ?.focus({ preventScroll: true }),
                    );
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
