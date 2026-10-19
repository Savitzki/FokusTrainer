import Mascot from "./Mascot";
import { useState, useSyncExternalStore } from "react";
import { RefreshCw } from "lucide-react";
import { retrySync, subscribeSync, syncStates, syncVersion } from "./sync";

export function InitialLoading({
  message = "Preparando seu espaço…",
  error = "",
  onRetry,
  onSignOut,
}: {
  message?: string;
  error?: string;
  onRetry?: () => void;
  onSignOut?: () => Promise<void>;
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
      className={`fokus-loading${error ? " loading-failed" : ""}`}
    >
      <div className="loading-identity" aria-hidden="true">
        <Mascot pose="neutral" size={180} loading="eager" />
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
  const states = syncStates(userId),
    offline = !navigator.onLine;
  const errors = states.filter((s) => s.error && s.errorKind !== "validation");
  const auth = errors.some((s) => s.errorKind === "auth");
  const saved = errors.some((s) => s.error.startsWith("Operação salva"));
  const reading = states.some((s) => s.refreshing);
  const message = offline
    ? "Sem conexão"
    : auth
      ? "Entre novamente para atualizar sua conta"
      : saved
        ? "Operação concluída · atualização pendente"
        : errors.some((s) => s.errorKind === "network")
          ? "Não foi possível conectar para atualizar"
          : errors.length
            ? "O servidor não respondeu à atualização"
            : "";
  if (!reading && !message) return null;
  return (
    <div className="sync-feedback">
      {reading && !message && (
        <span
          className="background-sync"
          role="img"
          aria-label="Atualizando informações em segundo plano"
        >
          <span aria-hidden="true" />
        </span>
      )}
      {message && (
        <div className="sync-banner" role="status" aria-live="polite">
          <span>{message}</span>
          {!offline && (
            <button
              type="button"
              className="text-button"
              onClick={() => (auth ? onLogin() : retrySync(userId))}
            >
              {auth ? "Entrar" : "Sincronizar"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
