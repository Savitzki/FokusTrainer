import { useRef, useState } from "react";
import { AlertTriangle, BriefcaseMedical } from "lucide-react";
import { kitUsesRemaining, type EconomyState } from "./economy";
export default function MedicalKitConfirmation({
  state,
  today,
  canProtect,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  state: EconomyState;
  today: string;
  canProtect: boolean;
  busy: boolean;
  error?: string;
  onConfirm: () => Promise<boolean>;
  onCancel: () => void;
}) {
  const pending = useRef(false),
    [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState("");
  const remaining = kitUsesRemaining(state);
  const allowed =
    canProtect && state.today === today && state.kits > 0 && remaining !== 0;
  return (
    <div className="kit-confirmation">
      <h3>
        <BriefcaseMedical size={21} /> Usar 1 Kit Médico hoje?
      </h3>
      <p className="kit-warning" role="alert">
        <AlertTriangle size={19} /> O kit será consumido e não será devolvido,
        mesmo se você treinar depois
      </p>
      <ul className="kit-rules">
        <li>
          Protege apenas um treino obrigatório de hoje, antes de o dia acabar
        </li>
        <li>Mantém a ofensiva, sem acrescentar pontos ou potes</li>
        <li>Não serve para dias passados, descanso ou treino já registrado</li>
        {state.monthlyKits && (
          <li>
            {state.monthlyKits.allowance} kits gratuitos por mês, sem acumular ·
            Os gratuitos são usados primeiro
          </li>
        )}
        {remaining === null ? (
          <li>Sem limite semanal · Você precisa ter kits disponíveis</li>
        ) : (
          <li>
            Até {state.rules.weeklyKitLimit} usos por semana, de segunda a
            domingo
          </li>
        )}
      </ul>
      <p className="field-hint">
        {state.kits} {state.kits === 1 ? "kit disponível" : "kits disponíveis"}{" "}
        {remaining !== null && (
          <>
            {" "}
            · {remaining}/{state.rules.weeklyKitLimit} usos restantes
          </>
        )}{" "}
        · {state.timezone}
      </p>
      {!allowed && (
        <p className="form-error" role="alert">
          Não há proteção disponível para este dia. Atualize sua semana e
          confira seus kits
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {failure && (
        <p className="form-error" role="alert">
          {failure}
        </p>
      )}
      <div className="form-actions">
        <button
          className="outline-button"
          disabled={busy || submitting}
          onClick={onCancel}
        >
          Agora não
        </button>
        <button
          className="primary-button"
          disabled={busy || submitting || !allowed}
          onClick={async () => {
            if (!allowed || pending.current) return;
            pending.current = true;
            setSubmitting(true);
            setFailure("");
            try {
              if (await onConfirm()) onCancel();
            } catch {
              setFailure(
                "Não foi possível usar o kit. Atualize e tente novamente",
              );
            } finally {
              pending.current = false;
              setSubmitting(false);
            }
          }}
        >
          {busy || submitting ? "Protegendo…" : "Usar 1 kit"}
        </button>
      </div>
    </div>
  );
}
