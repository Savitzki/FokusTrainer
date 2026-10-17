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
import { AccountExistsError } from "./accountErrors";
import HomeStateSelect from "./HomeStateSelect";
import PhrasePreferencesFields from "./PhrasePreferencesFields";
import {
  defaultPhrasePreferences,
  validatePhrasePreferences,
} from "./phrasePreferences";
import { readHomeState } from "./homeState";
import type { Profile } from "./profile";

const signupSteps = ["E-mail", "Senha", "Seu nome", "Sexo", "Seu estado"];

export default function AccountForm({
  account,
  profile,
  onSignedIn,
}: {
  account: Account;
  profile: Profile | null;
  onSignedIn: () => void;
}) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [homeState, setHomeState] = useState("");
  const [phrasePreferences, setPhrasePreferences] = useState(
    defaultPhrasePreferences,
  );
  const [busy, setBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [googleError, setGoogleError] = useState("");
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const stepRoot = useRef<HTMLDivElement>(null);
  const errorElement = useRef<HTMLParagraphElement>(null);
  const googleErrorElement = useRef<HTMLParagraphElement>(null);
  const messageElement = useRef<HTMLParagraphElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
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
    input?.scrollIntoView?.({ block: "nearest" });
  }, [mode, step, awaitingConfirmation, account.user, account.configured]);
  useEffect(() => {
    const target = googleError
      ? googleErrorElement.current
      : error
        ? errorElement.current
        : messageElement.current;
    if (!target) return;
    if (googleError || error) target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [googleError, error, message]);

  function clearFeedback() {
    setError("");
    setGoogleError("");
    setMessage("");
  }
  function changeMode(next: "signup" | "signin") {
    setMode(next);
    setStep(0);
    setAwaitingConfirmation(false);
    setPassword("");
    clearFeedback();
  }
  async function resendConfirmation() {
    if (busy) return;
    if (emailInput.current && !emailInput.current.reportValidity()) return;
    if (!email.trim()) return;
    setBusy(true);
    clearFeedback();
    try {
      await account.resendConfirmation(email);
      setMessage(
        "Se houver um cadastro pendente, você receberá um novo link. Confira também o spam.",
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    clearFeedback();
    if (mode === "signup" && step < signupSteps.length - 1) {
      try {
        if (step === 2)
          setPhrasePreferences(validatePhrasePreferences(phrasePreferences));
        setStep(step + 1);
      } catch (error) {
        setError((error as Error).message);
      }
      return;
    }
    // Earlier fields are unmounted. Recheck before creating the account.
    if (mode === "signup") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setStep(0);
        setError("Confira seu e-mail");
        return;
      }
      if (password.length < 8) {
        setStep(1);
        setError("Use pelo menos 8 caracteres");
        return;
      }
      if (homeState !== "general" && !readHomeState(homeState)) {
        setError("Escolha seu estado ou prefira frases gerais");
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const signedIn = await account.signUp(
          email,
          password,
          readHomeState(homeState),
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
        setPassword("");
        setMessage(error.message);
      } else setError((error as Error).message);
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
        <p>
          Perfil, treinos e pesos podem sincronizar entre aparelhos. Seus pesos
          são privados; amigos veem somente as informações da ofensiva.
        </p>
        <p className="privacy-note">
          Ao sair, os dados locais desta conta e do modo sem login serão
          removidos deste aparelho. Os dados já sincronizados continuam na
          conta.
        </p>
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
      E-mail
      <input
        ref={emailInput}
        type="email"
        autoComplete="email"
        enterKeyHint={signingUp ? "next" : "go"}
        maxLength={254}
        required
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
          aria-describedby={signingUp ? "signup-password-hint" : undefined}
          minLength={signingUp ? 8 : undefined}
          maxLength={128}
          required
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
    <form onSubmit={submit} className="account-form">
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
            <span>ou use seu e-mail</span>
          </div>
        </>
      )}
      {signingUp ? (
        <>
          <div
            className="signup-progress"
            role="progressbar"
            aria-label="Etapas do cadastro"
            aria-valuemin={1}
            aria-valuemax={signupSteps.length}
            aria-valuenow={step + 1}
            aria-valuetext={`${step + 1} de ${signupSteps.length}: ${signupSteps[step]}`}
          >
            <span className="signup-step-count">
              {step + 1} / {signupSteps.length}
            </span>
            <div className="signup-progress-bars" aria-hidden="true">
              {signupSteps.map((label, i) => (
                <span key={label} className={i <= step ? "is-complete" : ""} />
              ))}
            </div>
          </div>
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
            {step === 4 && (
              <HomeStateSelect
                value={homeState}
                onChange={setHomeState}
                required
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
      {error && (
        <p ref={errorElement} tabIndex={-1} className="form-error" role="alert">
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
            <span>Voltar</span>
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
              : step === signupSteps.length - 1
                ? "Criar conta"
                : "Continuar"}
          {signingUp &&
            !busy &&
            (step === signupSteps.length - 1 ? (
              <Check size={19} />
            ) : (
              <ArrowRight size={19} />
            ))}
        </button>
      </div>
      {(!signingUp || step === 0) && (
        <button
          type="button"
          className="text-button auth-mode"
          disabled={busy}
          onClick={resendConfirmation}
        >
          Reenviar confirmação
        </button>
      )}
      <button
        type="button"
        className="text-button auth-mode"
        disabled={busy}
        onClick={() => changeMode(signingUp ? "signin" : "signup")}
      >
        {signingUp ? "Já tenho conta" : "Quero criar uma conta"}
      </button>
    </form>
  );
}
