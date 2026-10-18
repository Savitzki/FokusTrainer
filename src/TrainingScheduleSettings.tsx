import { useEffect, useState } from "react";
import { Check, Dumbbell, LockKeyhole, Moon } from "lucide-react";
import { formatDay, shiftDate } from "./model";
import {
  hasTrainingPlan,
  TRAINING_DAYS_PER_WEEK,
  trainingDaysFor,
  WEEKDAYS,
} from "./training";
import { OperationSpinner } from "./SyncFeedback";
import type { TrainingController } from "./useTrainingPlan";
const SHORT_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export default function TrainingScheduleSettings({
  training,
  onLogin,
  onSaved,
}: {
  training: TrainingController;
  onLogin: () => void;
  onSaved?: () => void;
}) {
  const state = training.state,
    hasPlan = hasTrainingPlan(state);
  const [mode, setMode] = useState<"create" | "locked" | "replace">(
    hasPlan ? "locked" : "create",
  );
  const [days, setDays] = useState<number[]>([]),
    [preview, setPreview] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    setMode(hasPlan ? "locked" : "create");
    setPreview(false);
    setDays(
      hasPlan && state ? trainingDaysFor(state, shiftDate(state.today, 1)) : [],
    );
  }, [state?.revision, state?.today]);
  const locked = mode === "locked",
    invalid = days.length !== TRAINING_DAYS_PER_WEEK;
  const effective = state
    ? hasPlan
      ? shiftDate(state.today, 1)
      : state.today
    : "";
  const pending = state?.plans
    .filter((p) => p.effectiveFrom > state.today)
    .sort((a, b) => b.revision - a.revision)[0];
  return (
    <section className="card training-settings" aria-label="Semana de treinos">
      <div className="training-settings-heading">
        <h2>Personalize sua semana</h2>
        {training.enabled && state && (
          <span className="training-count">
            {locked ? (
              <>
                <LockKeyhole size={13} /> Bloqueado
              </>
            ) : (
              `${days.length} treinos`
            )}
          </span>
        )}
      </div>
      {!training.enabled ? (
        <button type="button" className="text-button" onClick={onLogin}>
          Entre para configurar sua semana
        </button>
      ) : (
        <>
          {mode === "replace" && (
            <p className="field-hint">
              Atual:{" "}
              {trainingDaysFor(state, state!.today)
                .map((d) => SHORT_DAYS[d - 1])
                .join(" · ")}
              <br />
              Seu histórico será preservado
            </p>
          )}
          <div
            className="training-week"
            role="group"
            aria-label={preview ? "Prévia do novo plano" : "Dias de treino"}
          >
            {WEEKDAYS.map((name, i) => (
              <button
                key={name}
                type="button"
                aria-label={name}
                aria-pressed={days.includes(i + 1)}
                disabled={training.busy || !state || locked || preview}
                onClick={() => {
                  setMessage("");
                  setDays((prev) =>
                    prev.includes(i + 1)
                      ? prev.filter((d) => d !== i + 1)
                      : [...prev, i + 1].sort(),
                  );
                }}
              >
                <span className="training-day-icon" aria-hidden="true">
                  {days.includes(i + 1) ? (
                    <Dumbbell size={19} />
                  ) : (
                    <Moon size={19} />
                  )}
                </span>
                <span className="training-day-name">{SHORT_DAYS[i]}</span>
              </button>
            ))}
          </div>
          <div className="training-selection-summary">
            <span>
              {days.length} treinos · {7 - days.length} descansos
            </span>
          </div>
          {locked && pending && (
            <p className="field-hint">
              Novo plano a partir de {formatDay(pending.effectiveFrom)}. Até lá:{" "}
              {trainingDaysFor(state, state!.today)
                .map((d) => SHORT_DAYS[d - 1])
                .join(" · ")}
            </p>
          )}
          {mode === "replace" && pending && (
            <p className="field-hint">
              A nova seleção substituirá o plano pendente
            </p>
          )}
          {training.error && (
            <p className="form-error" role="alert">
              {training.error}{" "}
              <button
                type="button"
                className="text-button"
                disabled={training.busy}
                onClick={() => void training.refresh()}
              >
                Atualizar
              </button>
            </p>
          )}
          {state && (
            <div className="training-save-row">
              <span className="training-effective-date">
                {locked
                  ? pending
                    ? "Substituição programada"
                    : "Plano ativo"
                  : `Vale ${hasPlan ? `a partir de ${formatDay(effective, { day: "numeric", month: "short" })}` : "hoje"}`}
              </span>
              {locked ? (
                <button
                  type="button"
                  className="outline-button"
                  disabled={training.busy}
                  onClick={() => {
                    setMode("replace");
                    setMessage("");
                  }}
                >
                  Substituir plano
                </button>
              ) : (
                <button
                  type="button"
                  className="outline-button"
                  disabled={training.busy || invalid}
                  onClick={async () => {
                    if (invalid) return;
                    if (mode === "replace" && !preview) {
                      setPreview(true);
                      return;
                    }
                    setMessage("");
                    if (await training.save(days)) {
                      setMode("locked");
                      setPreview(false);
                      setMessage(
                        hasPlan ? "Novo plano confirmado" : "Plano criado",
                      );
                      onSaved?.();
                    }
                  }}
                >
                  {training.busy ? (
                    <OperationSpinner active />
                  ) : (
                    <Check size={17} />
                  )}
                  {training.busy
                    ? "Salvando…"
                    : mode === "create"
                      ? "Criar meu plano"
                      : preview
                        ? "Confirmar substituição"
                        : "Revisar novo plano"}
                </button>
              )}
            </div>
          )}
          {mode === "replace" && (
            <>
              {preview && (
                <p className="field-hint">
                  Confirma este plano de 5 treinos e 2 descansos? O plano atual
                  continua valendo hoje
                </p>
              )}
              <div className="plan-editor-actions">
                {preview && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={training.busy}
                    onClick={() => setPreview(false)}
                  >
                    Voltar à seleção
                  </button>
                )}
                <button
                  type="button"
                  className="text-button"
                  disabled={training.busy}
                  onClick={() => {
                    setMode("locked");
                    setPreview(false);
                    setDays(trainingDaysFor(state, shiftDate(state!.today, 1)));
                  }}
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
          {!locked && invalid && state && (
            <p className="field-hint">
              Escolha exatamente 5 dias de treino e 2 de descanso
            </p>
          )}
          {message && (
            <p className="field-hint" role="status">
              {message}
            </p>
          )}
        </>
      )}
    </section>
  );
}
