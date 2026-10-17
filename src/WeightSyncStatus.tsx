import { Cloud, CloudOff, RefreshCw, Upload } from "lucide-react";
import { formatDay, formatKg, type Weight } from "./model";
import type { useWeightSync } from "./useWeightSync";
export default function WeightSyncStatus({
  sync,
  guest,
  onError,
}: {
  sync: ReturnType<typeof useWeightSync>;
  guest: Weight[];
  onError: (message: string) => void;
}) {
  function attempt(action: () => void) {
    try {
      action();
    } catch (error) {
      onError((error as Error).message);
    }
  }
  return (
    <div className="weight-sync">
      <div className="weight-sync-line" role="status">
        {sync.busy ? (
          <RefreshCw size={15} className="syncing" />
        ) : sync.error || sync.pending ? (
          <CloudOff size={15} />
        ) : (
          <Cloud size={15} />
        )}
        <span>
          {sync.busy
            ? "Sincronizando pesos…"
            : sync.error
              ? sync.pending
                ? "Peso salvo neste aparelho"
                : "Sincronização indisponível"
              : sync.pending
                ? "Alterações pendentes"
                : sync.synced
                  ? "Pesos salvos na conta"
                  : "Conectando seus pesos…"}
        </span>
        <button
          className="icon-button"
          aria-label="Sincronizar pesos"
          disabled={sync.busy}
          onClick={() => void sync.refresh()}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {sync.error && (
        <p className="form-error" role="alert">
          {sync.error}
        </p>
      )}
      {!sync.guestImported && guest.length > 0 && (
        <button
          className="text-button"
          onClick={() => attempt(() => sync.importGuest(guest))}
        >
          <Upload size={16} />
          Importar {guest.length}{" "}
          {guest.length === 1 ? "peso sem conta" : "pesos sem conta"}
        </button>
      )}
      {sync.conflicts.map((c) => (
        <div className="weight-conflict" key={c.date}>
          <strong>Dois registros em {formatDay(c.date)}</strong>
          <p>Escolha o que deve ficar na sua conta</p>
          <button
            className="text-button"
            onClick={() => attempt(() => sync.resolve(c.date, true))}
          >
            Deste aparelho: {c.kg === null ? "excluir" : `${formatKg(c.kg)} kg`}
          </button>
          <button
            className="text-button"
            onClick={() => attempt(() => sync.resolve(c.date, false))}
          >
            Da conta:{" "}
            {c.remoteKg === null ? "excluído" : `${formatKg(c.remoteKg)} kg`}
          </button>
        </div>
      ))}
    </div>
  );
}
