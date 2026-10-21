import { useEffect, useRef, useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import type { Account } from "./account";
import Mascot from "./Mascot";
import { capiboraMessage } from "./capiboraVoice";

/** This is session identity state, not a claim based on local profile/cache. */
export const emailConfirmationPending = (user: Account["user"]) =>
  Boolean(user?.email && !user.email_confirmed_at);

export function EmailConfirmationNotice({ account }: { account: Account }) {
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const sending = useRef(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(false), 60000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  if (!emailConfirmationPending(account.user)) return null;
  return (
    <section
      className="entry-notice email-confirmation-notice"
      aria-label="Confirmação de e-mail pendente"
    >
      <Mail size={23} aria-hidden="true" />
      <div>
        <h2>Confirme seu e-mail</h2>
        <p>
          Enviamos um link de confirmação para seu e-mail. Confirme para
          finalizar seu cadastro.
        </p>
        <button
          className="text-button"
          disabled={busy || cooldown}
          onClick={async () => {
            if (sending.current || cooldown || !account.user?.email) return;
            sending.current = true;
            setBusy(true);
            setFeedback("");
            setError("");
            try {
              await account.resendConfirmation(account.user.email);
              setFeedback("Link enviado. Confira também o spam.");
              setCooldown(true);
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message
                  : "Não foi possível reenviar. Tente novamente",
              );
            } finally {
              sending.current = false;
              setBusy(false);
            }
          }}
        >
          {busy
            ? "Enviando…"
            : cooldown
              ? "Aguarde para reenviar"
              : "Reenviar confirmação"}
        </button>
        {feedback && <p role="status">{feedback}</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
export function ProfileCompletionNotice({ onOpen }: { onOpen: () => void }) {
  const message = capiboraMessage("profile-complete");
  return (
    <button className="entry-notice profile-completion-notice" onClick={onOpen}>
      <Mascot pose={message.expression} size={58} />
      <span>
        <strong>{message.title}</strong>
        <span>{message.body}</span>
      </span>
      <ArrowRight size={19} aria-hidden="true" />
    </button>
  );
}
