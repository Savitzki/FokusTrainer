import { useSyncExternalStore } from "react";
import { Flame, RefreshCw } from "lucide-react";
import { retrySync, subscribeSync, syncStates, syncVersion } from "./sync";

export function InitialLoading({
  message = "Preparando seu espaço…",
}: {
  message?: string;
}) {
  return (
    <div className="app-loading fokus-loading" role="status" aria-live="polite">
      <div className="loading-identity" aria-hidden="true">
        <Flame className="loading-flame" size={56} fill="currentColor" />
        <strong>
          fokus<span>trainer</span>
        </strong>
      </div>
      <span>{message}</span>
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
