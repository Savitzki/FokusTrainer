import Mascot from "./Mascot";
import { CAPIBORA_PHRASES } from "./capiboraVoice";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Cloud,
  LogOut,
  Mail,
} from "lucide-react";
import type { Account } from "./account";
import {
  AccountAuthError,
  AccountExistsError,
  type AccountField,
} from "./accountErrors";
import PhrasePreferencesFields from "./PhrasePreferencesFields";
import {
  defaultPhrasePreferences,
  validatePhrasePreferences,
} from "./phrasePreferences";
import type { Profile } from "./profile";
import { isEmailAddress, isNickname } from "./nickname";

const signupLines = CAPIBORA_PHRASES.filter((p) => p.context === "signup");
const signupMessages = signupLines.map((p) => p.text);

export default function AccountForm({
  account,
  profile,
  onSignedIn,
}: {
  account: Account;
  profile: Profile | null;
  onSignedIn: () => void;
}) {
  const [mode, setMode] = useState<"signup" | "signin">("signin");
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phrasePreferences, setPhrasePreferences] = useState(
    defaultPhrasePreferences,
  );
  const [busy, setBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<AccountField>();
  const [googleError, setGoogleError] = useState("");
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const stepRoot = useRef<HTMLDivElement>(null);
  const errorElement = useRef<HTMLParagraphElement>(null);
  const googleErrorElement = useRef<HTMLParagraphElement>(null);
  const messageElement = useRef<HTMLParagraphElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (awaitingConfirmation) {
      confirmationHeading.current?.focus({ preventScroll: true });
      confirmationHeading.current?.scrollIntoView?.({ block: "nearest" });
      return;
    }
    if (account.user || !account.configured) return;
    const input =
      mode === "signup"
        ? stepRoot.current?.querySelector<HTMLElement>("input, select")
        : email
          ? passwordInput.current
          : emailInput.current;
    input?.focus({ preventScroll: true });
  }, [mode, step, awaitingConfirmation, account.user, account.configured]);
  useEffect(() => {
    const target = googleError
      ? googleErrorElement.current
      : error
        ? errorElement.current
        : messageElement.current;
    if (!target) return;
    if (googleError || error) target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: "nearest", behavior: "instant" });
  }, [googleError, error, message]);

  const [checkingEmail, setCheckingEmail] = useState(false);
  const emailChecks = useRef(new Map<string, Promise<boolean>>());
  function checkEmail(address: string) {
    const normalized = address.trim().toLowerCase();
    let pending = emailChecks.current.get(normalized);
    if (!pending) {
      pending = account.checkEmail(normalized);
      emailChecks.current.set(normalized, pending);
      void pending.catch(() => emailChecks.current.delete(normalized));
    }
    return pending;
  }
  function routeForEmail(exists: boolean) {
    if (exists && mode === "signup") {
      changeMode("signin");
      setMessage("Este e-mail já tem uma conta. Entre para continuar");
      return true;
    }
    if (!exists && mode === "signin") {
      changeMode("signup");
      // The e-mail was just verified; continue with the password step.
      setStep(1);
      setMessage("Este e-mail ainda não tem conta. Vamos criar a sua");
      return true;
    }
    return false;
  }
  useEffect(() => {
    setCheckingEmail(false);
    if (
      (mode === "signup" && step !== 0) ||
      awaitingConfirmation ||
      !account.configured ||
      account.user ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      email.trim().length > 254
    )
      return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setCheckingEmail(true);
      void checkEmail(email)
        .then((exists) => {
          if (!cancelled) routeForEmail(exists);
        })
        .catch(() => {
          if (!cancelled)
            showError(
              new AccountAuthError(
                "Não foi possível verificar o e-mail. Tente novamente",
                "email",
              ),
            );
        })
        .finally(() => {
          if (!cancelled) setCheckingEmail(false);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    email,
    mode,
    step,
    awaitingConfirmation,
    account.configured,
    account.user,
  ]);

  function clearFeedback() {
    setError("");
    setErrorField(undefined);
    setGoogleError("");
    setMessage("");
  }
  function showError(error: unknown) {
    setError(
      error instanceof Error
        ? error.message
        : "Não foi possível concluir agora. Tente novamente",
    );
    const field = error instanceof AccountAuthError ? error.field : undefined;
    setErrorField(field);
    if (mode === "signup" && field) setStep(field === "email" ? 0 : 1);
  }
  function validEmail() {
    if (
      email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      showError(
        new AccountAuthError("Confira se o e-mail está correto", "email"),
      );
      return false;
    }
    return true;
  }
  function changeMode(next: "signup" | "signin") {
    setMode(next);
    setStep(0);
    setAwaitingConfirmation(false);
    setPassword("");
    if (next === "signup" && !isEmailAddress(email)) setEmail("");
    clearFeedback();
  }
  async function resendConfirmation() {
    if (busy) return;
    clearFeedback();
    if (!isEmailAddress(email)) {
      showError(
        new AccountAuthError(
          "Informe seu e-mail para reenviar a confirmação",
          "email",
        ),
      );
      return;
    }
    setBusy(true);
    try {
      await account.resendConfirmation(email);
      setMessage(
        "Se houver um cadastro pendente, você receberá um novo link. Confira também o spam.",
      );
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    clearFeedback();
    // Previous fields are unmounted; validate them again before the final request.
    const finalStep = step === signupMessages.length - 1;
    const nicknameLogin =
      mode === "signin" && !isEmailAddress(email) && isNickname(email);
    if (mode === "signin" && !nicknameLogin && !isEmailAddress(email)) {
      showError(
        new AccountAuthError("Informe um e-mail ou nick válido", "email"),
      );
      return;
    }
    if (mode === "signup" && (step === 0 || finalStep) && !validEmail()) return;
    if (
      (mode === "signin" && !nicknameLogin) ||
      (mode === "signup" && step === 0)
    ) {
      setBusy(true);
      try {
        if (routeForEmail(await checkEmail(email))) return;
        if (mode === "signup") {
          setStep(1);
          return;
        }
      } catch {
        showError(
          new AccountAuthError(
            "Não foi possível verificar o e-mail. Tente novamente",
            "email",
          ),
        );
        return;
      } finally {
        setBusy(false);
      }
    }
    if (
      (mode === "signin" || step === 1 || finalStep) &&
      (!password || (mode === "signup" && password.length < 8))
    ) {
      showError(
        new AccountAuthError(
          mode === "signup"
            ? "Use pelo menos 8 caracteres"
            : "Preencha sua senha",
          "password",
        ),
      );
      return;
    }
    if (mode === "signup" && step < signupMessages.length - 1) {
      try {
        if (step === 2)
          setPhrasePreferences(validatePhrasePreferences(phrasePreferences));
        setStep(step + 1);
      } catch (error) {
        showError(error);
      }
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const signedIn = await account.signUp(
          email,
          password,
          validatePhrasePreferences(phrasePreferences),
        );
        if (signedIn) onSignedIn();
        else setAwaitingConfirmation(true);
      } else {
        await account.signIn(email, password);
        onSignedIn();
      }
      setPassword("");
    } catch (error) {
      if (error instanceof AccountExistsError) {
        setMode("signin");
        setStep(0);
        setPassword("");
        setMessage(error.message);
      } else showError(error);
    } finally {
      setBusy(false);
    }
  }

  if (!account.configured)
    return (
      <div className="account-info">
        <Cloud size={30} />
        <h3>Cadastro online em preparação</h3>
        <p>
          O cadastro com e-mail e senha ainda não está disponível nesta versão
          publicada.
        </p>
        <p>
          Enquanto isso, personalize seu perfil na aba Meu perfil e continue
          usando o app neste dispositivo.
        </p>
      </div>
    );
  if (account.user)
    return (
      <div className="account-info">
        <Cloud size={30} />
        <h3>Conta conectada</h3>
        {profile && <p>@{profile.nickname}</p>}
        <p className="account-email">{account.user.email}</p>
        <details className="context-details">
          <summary>Sobre seus dados</summary>
          <p>
            Seus pesos são privados. Ao sair, os dados locais são removidos
            deste aparelho. Os registros sincronizados permanecem na conta.
          </p>
        </details>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="outline-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await account.signOut();
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <LogOut size={17} /> Sair da conta
        </button>
      </div>
    );
  if (awaitingConfirmation)
    return (
      <div className="signup-confirmation">
        <Mail size={38} aria-hidden="true" />
        <h3 ref={confirmationHeading} tabIndex={-1}>
          Confira seu e-mail
        </h3>
        <p className="modal-description">
          Enviamos um link para <strong>{email}</strong>. Confirme o cadastro e
          volte para entrar.
        </p>
        {error && (
          <p
            ref={errorElement}
            tabIndex={-1}
            className="form-error"
            role="alert"
          >
            {error}
          </p>
        )}
        {message && (
          <p ref={messageElement} className="field-hint" role="status">
            {message}
          </p>
        )}
        <button
          type="button"
          className="primary-button form-submit"
          onClick={() => changeMode("signin")}
          disabled={busy}
        >
          Entrar
        </button>
        <button
          type="button"
          className="text-button auth-mode"
          onClick={resendConfirmation}
          disabled={busy}
        >
          Reenviar confirmação
        </button>
        <button
          type="button"
          className="text-button auth-mode"
          disabled={busy}
          onClick={() => changeMode("signup")}
        >
          Usar outro e-mail
        </button>
      </div>
    );

  const signingUp = mode === "signup";
  const showGoogle = !signingUp || step === 0;
  const emailField = (
    <label className="form-label">
      {signingUp ? "E-mail" : "E-mail ou @nick"}
      <input
        ref={emailInput}
        type={signingUp ? "email" : "text"}
        autoComplete={signingUp ? "email" : "username"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint={signingUp ? "next" : "go"}
        maxLength={254}
        required
        disabled={busy}
        aria-invalid={errorField === "email" || undefined}
        aria-describedby={errorField === "email" ? "account-error" : undefined}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
    </label>
  );
  const passwordField = (
    <>
      <label className="form-label">
        Senha
        <input
          ref={passwordInput}
          type="password"
          autoComplete={signingUp ? "new-password" : "current-password"}
          enterKeyHint={signingUp ? "next" : "go"}
          aria-describedby={
            [
              signingUp && "signup-password-hint",
              errorField === "password" && "account-error",
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
          aria-invalid={errorField === "password" || undefined}
          minLength={signingUp ? 8 : undefined}
          maxLength={128}
          required
          disabled={busy}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {signingUp && (
        <p id="signup-password-hint" className="password-hint">
          Use pelo menos 8 caracteres
        </p>
      )}
    </>
  );
  return (
    <form onSubmit={submit} className="account-form" noValidate>
      {showGoogle && (
        <>
          <button
            type="button"
            className="google-signin"
            disabled={busy}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              clearFeedback();
              try {
                await account.signInWithGoogle();
              } catch (error) {
                setGoogleError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 48 48"
              aria-hidden="true"
              focusable="false"
            >
              <path
                fill="#4285F4"
                d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.8-3.5 6.1-8.6 6.1-14.9Z"
              />
              <path
                fill="#34A853"
                d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20.4 20.4 0 0 0 24 44Z"
              />
              <path
                fill="#FBBC05"
                d="M12.6 27.6a12.2 12.2 0 0 1 0-7.2v-5.2H5.8a20 20 0 0 0 0 17.6l6.8-5.2Z"
              />
              <path
                fill="#EA4335"
                d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8A19.6 19.6 0 0 0 24 4 20.4 20.4 0 0 0 5.8 15.2l6.8 5.2C14.2 15.6 18.7 12 24 12Z"
              />
            </svg>
            Continuar com Google
          </button>
          {googleError && (
            <p
              ref={googleErrorElement}
              tabIndex={-1}
              className="form-error google-error"
              role="alert"
            >
              {googleError}
            </p>
          )}
          <div className="auth-divider">
            <span>ou</span>
          </div>
        </>
      )}
      {signingUp ? (
        <>
          <Mascot pose={signupLines[step]?.expression ?? "neutral"} size={48} />
          <p className="signup-motivation">{signupMessages[step]}</p>
          <div className="signup-step" ref={stepRoot} key={step}>
            {step === 0 && emailField}
            {step === 1 && passwordField}
            {step === 2 && (
              <PhrasePreferencesFields
                field="name"
                value={phrasePreferences}
                onChange={setPhrasePreferences}
              />
            )}
            {step === 3 && (
              <PhrasePreferencesFields
                field="sex"
                value={phrasePreferences}
                onChange={setPhrasePreferences}
              />
            )}
          </div>
        </>
      ) : (
        <>
          {emailField}
          {passwordField}
        </>
      )}
      {checkingEmail && (
        <p className="field-hint" role="status">
          Conferindo e-mail…
        </p>
      )}
      {error && (
        <p
          id="account-error"
          ref={errorElement}
          tabIndex={-1}
          className="form-error"
          role="alert"
        >
          {error}
        </p>
      )}
      {message && (
        <p ref={messageElement} className="field-hint" role="status">
          {message}
        </p>
      )}
      <div className="signup-actions">
        {signingUp && step > 0 && (
          <button
            type="button"
            className="outline-button signup-back"
            aria-label="Voltar à etapa anterior"
            disabled={busy}
            onClick={() => {
              clearFeedback();
              setStep(step - 1);
            }}
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <button
          type="submit"
          className="primary-button form-submit"
          disabled={busy}
        >
          {busy
            ? "Aguarde…"
            : !signingUp
              ? "Entrar"
              : step === signupMessages.length - 1
                ? "Criar conta"
                : "Continuar"}
          {signingUp &&
            !busy &&
            (step === signupMessages.length - 1 ? (
              <Check size={19} />
            ) : (
              <ArrowRight size={19} />
            ))}
        </button>
      </div>
      {!signingUp && (
        <button
          type="button"
          className="text-button auth-mode"
          disabled={busy}
          onClick={resendConfirmation}
        >
          Reenviar confirmação
        </button>
      )}
      {(!signingUp || step === 0) && (
        <button
          type="button"
          className="text-button auth-mode"
          disabled={busy}
          onClick={() => changeMode(signingUp ? "signin" : "signup")}
        >
          {signingUp ? "Já tenho conta" : "Quero criar uma conta"}
        </button>
      )}
    </form>
  );
}
