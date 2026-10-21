import { BRAND_ASSETS } from "./brandAssets";
import { useState, useSyncExternalStore } from "react";
import { RefreshCw } from "lucide-react";
import { subscribeSync, syncStates, syncVersion } from "./sync";

export function InitialLoading({
  message = "Preparando seu espaço…",
  error = "",
  onRetry,
  onSignOut,
  leaving = false,
  onExited,
}: {
  message?: string;
  error?: string;
  onRetry?: () => void;
  onSignOut?: () => Promise<void>;
  leaving?: boolean;
  onExited?: () => void;
}) {
  const [exitError, setExitError] = useState("");
  const [exiting, setExiting] = useState(false);
  async function signOut() {
    if (!onSignOut || exiting) return;
    setExiting(true);
    setExitError("");
    try {
      await onSignOut();
    } catch (error) {
      setExitError((error as Error).message);
    } finally {
      setExiting(false);
    }
  }
  return (
    <div
      className={`fokus-loading${error ? " loading-failed" : ""}${leaving ? " loading-leaving" : ""}`}
      aria-hidden={leaving || undefined}
      inert={leaving || undefined}
      onAnimationEnd={(event) => {
        if (
          leaving &&
          event.target === event.currentTarget &&
          event.animationName === "capibora-loading-exit"
        ) onExited?.();
      }}
    >
      <div className="loading-identity" aria-hidden="true">
        <img
          className="capibora-mascot"
          src={`${import.meta.env.BASE_URL}${BRAND_ASSETS.loadingLogo}`}
          alt=""
          aria-hidden="true"
          width="180"
          height="179"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {error ? "Não foi possível carregar sua conta" : message}
      </span>
      {error && (
        <div className="loading-recovery">
          <p role="alert">{exitError || error}</p>
          <div>
            {onRetry && (
              <button className="primary-button" onClick={onRetry}>
                Tentar novamente
              </button>
            )}
            {onSignOut && (
              <button
                className="outline-button"
                disabled={exiting}
                onClick={() => void signOut()}
              >
                Sair da conta
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export function OperationSpinner({ active }: { active: boolean }) {
  return active ? (
    <RefreshCw size={17} className="operation-spinner" aria-hidden="true" />
  ) : null;
}
export default function SyncFeedback({
  userId,
  onLogin,
}: {
  userId: string;
  onLogin: () => void;
}) {
  useSyncExternalStore(subscribeSync, syncVersion, syncVersion);
  const states = syncStates(userId);
  const auth = states.some((s) => s.error && s.errorKind === "auth");
  const actionable = states.find((s) => s.error && s.errorKind === "validation");
  const message = auth
    ? "Entre novamente para atualizar sua conta"
    : actionable?.error ?? "";
  if (!message) return null;
  return (
    <div className="sync-feedback">
      {message && (
        <div className="sync-banner" role="status" aria-live="polite">
          <span>{message}</span>
          {auth && (
            <button
              type="button"
              className="text-button"
              onClick={onLogin}
            >
              Entrar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
