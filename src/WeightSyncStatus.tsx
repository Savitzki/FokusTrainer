import { CloudOff, RefreshCw, Upload } from "lucide-react";
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
  const canImport = !sync.guestImported && guest.length > 0;
  if (
    !sync.error &&
    !sync.pending &&
    !sync.conflicts.length &&
    !sync.legacyNotice &&
    !canImport
  )
    return null;
  return (
    <div className="weight-sync">
      {sync.pending > 0 && (
        <div className="weight-sync-line" role="status">
          <CloudOff size={15} aria-hidden="true" />
          <span>
            {sync.pending}{" "}
            {sync.pending === 1 ? "peso pendente" : "pesos pendentes"} · salvo
            neste aparelho
          </span>
          <button
            className="icon-button"
            aria-label="Sincronizar pesos"
            disabled={sync.busy}
            onClick={() => void sync.refresh()}
          >
            <RefreshCw
              size={16}
              className={sync.busy ? "operation-spinner" : undefined}
            />
          </button>
        </div>
      )}
      {sync.error && (
        <p className="form-error" role="alert">
          {sync.error}
          {!sync.pending && (
            <button
              className="text-button"
              disabled={sync.busy}
              onClick={() => void sync.refresh()}
            >
              Tentar novamente
            </button>
          )}
        </p>
      )}
      {sync.legacyNotice && (
        <p className="field-hint">
          Pesagens anteriores preservadas. Exclusões pendentes da versão antiga
          não foram aplicadas
        </p>
      )}
      {canImport && (
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
        <div className="weight-conflict" key={c.id}>
          <strong>Pesagem pendente de {formatDay(c.date)}</strong>
          <p>Escolha qual pesagem manter</p>
          <button
            className="text-button"
            onClick={() => attempt(() => sync.resolve(c.id, true))}
          >
            Adicionar outra pesagem: {formatKg(c.kg)} kg
          </button>
          <button
            className="text-button"
            onClick={() => attempt(() => sync.resolve(c.id, false))}
          >
            Manter somente a da conta
            {c.remoteKg === null ? "" : `: ${formatKg(c.remoteKg)} kg`}
          </button>
        </div>
      ))}
    </div>
  );
}
