import { useEffect, useId, useRef, useState } from "react";
import Mascot from "./Mascot";
import { LockKeyhole, Dumbbell, Moon } from "lucide-react";
import { formatDay, shiftDate } from "./model";
import {
  hasTrainingPlan,
  resizeTrainingSelection,
  trainingDaysFor,
  validTrainingSelection,
  WEEKDAYS,
} from "./training";
import { OperationSpinner } from "./SyncFeedback";
import type { TrainingController } from "./useTrainingPlan";
const SHORT_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const list = (days: number[]) =>
  new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" }).format(
    days.map((d) => WEEKDAYS[d - 1]),
  );
export default function TrainingScheduleSettings({
  training,
  onLogin,
  onSaved,
  initialSetup = false,
  onBusyChange,
}: {
  training: TrainingController;
  onLogin: () => void;
  onSaved?: (firstPlan: boolean) => void;
  initialSetup?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const saving = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const busy = training.busy || submitting;
  const state = training.state,
    hasPlan = hasTrainingPlan(state);
  const [step, setStep] = useState<"locked" | "quantity" | "days" | "confirm">(
    hasPlan ? "locked" : "quantity",
  );
  const [count, setCount] = useState(3),
    [days, setDays] = useState<number[]>([]),
    [message, setMessage] = useState("");
  const current = state && hasPlan ? trainingDaysFor(state, state.today) : [];
  const pending = state?.plans
    .filter((p) => p.effectiveFrom > state.today)
    .sort((a, b) => b.revision - a.revision)[0];
  useEffect(() => {
    setStep(hasPlan ? "locked" : "quantity");
    setMessage("");
    const next =
      hasPlan && state ? trainingDaysFor(state, shiftDate(state.today, 1)) : [];
    setDays(next);
    setCount(next.length || 3);
  }, [state?.revision, state?.today]);
  useEffect(() => {
    if (initialSetup) titleRef.current?.focus({ preventScroll: true });
  }, [initialSetup, step]);
  const title =
    step === "days"
      ? count === 1
        ? "Escolha o dia em que vai treinar"
        : `Escolha os ${count} dias em que vai treinar`
      : step === "confirm"
        ? "Revisar plano"
        : "Quantos dias da semana você quer treinar?";
  const locked = step === "locked",
    displayDays = locked ? current : days;
  const restDays = Array.from({ length: 7 }, (_, i) => i + 1).filter(
    (d) => !days.includes(d),
  );
  const effective = state
    ? hasPlan
      ? shiftDate(state.today, 1)
      : state.today
    : "";
  return (
    <section
      className={`card training-settings${initialSetup ? " first-plan-flow" : ""}`}
      aria-label="Semana de treinos"
    >
      {initialSetup ? (
        <div
          className={`first-plan-heading ${step === "quantity" ? "with-mascot" : ""}`}
        >
          <h2 id={titleId} ref={titleRef} tabIndex={-1}>
            {title}
          </h2>
          {step === "quantity" && <Mascot pose="judging" size={108} />}
        </div>
      ) : (
        <div className="training-settings-heading">
          <h2>Meu plano semanal</h2>
          {locked && (
            <span className="training-count plan-locked">
              <LockKeyhole size={13} /> Bloqueado
            </span>
          )}
        </div>
      )}
      {!training.enabled ? (
        <button className="text-button" onClick={onLogin}>
          Entre para configurar sua semana
        </button>
      ) : !state ? (
        <p role="status">Carregando seu plano…</p>
      ) : (
        <>
          {locked ? (
            <>
              <p className="plan-count-summary">
                {current.length}{" "}
                {current.length === 1 ? "dia de treino" : "dias de treino"} ·{" "}
                {7 - current.length}{" "}
                {7 - current.length === 1
                  ? "dia de descanso"
                  : "dias de descanso"}
              </p>
              <WeekDays days={displayDays} locked />
              <div className="training-save-row">
                <button
                  className="outline-button"
                  disabled={busy}
                  onClick={() => {
                    setStep("quantity");
                    setMessage("");
                  }}
                >
                  Substituir plano
                </button>
              </div>
            </>
          ) : step === "quantity" ? (
            <>
              {!initialSetup && (
                <label
                  className="plan-quantity-label"
                  htmlFor="training-day-count"
                >
                  Quantos dias por semana você quer treinar?
                </label>
              )}
              <select
                id="training-day-count"
                aria-labelledby={initialSetup ? titleId : undefined}
                value={count}
                disabled={busy}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setCount(value);
                  setDays((previous) =>
                    resizeTrainingSelection(previous, value),
                  );
                  setMessage("");
                }}
              >
                {Array.from({ length: 7 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1} {i === 0 ? "dia" : "dias"}
                  </option>
                ))}
              </select>
              <p className="plan-count-summary" aria-live="polite">
                {count} {count === 1 ? "dia de treino" : "dias de treino"} ·{" "}
                {7 - count}{" "}
                {7 - count === 1 ? "dia de descanso" : "dias de descanso"}
              </p>
              {count === 7 && (
                <small className="field-hint">
                  Sem descansos programados. Esta escolha não é uma recomendação
                  para treinar todos os dias
                </small>
              )}
              <button
                className="primary-button plan-next"
                disabled={busy}
                onClick={() => setStep("days")}
              >
                Escolher dias
              </button>
            </>
          ) : step === "days" ? (
            <>
              {!initialSetup && <h3 className="plan-step-title">{title}</h3>}
              <WeekDays
                days={days}
                locked={busy}
                onToggle={(day) =>
                  setDays((previous) =>
                    previous.includes(day)
                      ? previous.filter((d) => d !== day)
                      : [...previous, day].sort((a, b) => a - b),
                  )
                }
              />
              <p className="plan-count-summary" aria-live="polite">
                {days.length} de {count} dias selecionados
              </p>
              <button
                className="primary-button plan-next"
                disabled={busy || !validTrainingSelection(days, count)}
                onClick={() => setStep("confirm")}
              >
                Revisar plano
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => setStep("quantity")}
              >
                Alterar quantidade
              </button>
            </>
          ) : (
            <>
              {!initialSetup && (
                <h3 className="plan-step-title">Confirmar plano semanal</h3>
              )}
              <dl className="plan-confirmation">
                <div>
                  <dt>
                    {count} {count === 1 ? "dia de treino" : "dias de treino"}
                  </dt>
                  <dd>{list(days)}</dd>
                </div>
                <div>
                  <dt>
                    {restDays.length}{" "}
                    {restDays.length === 1
                      ? "dia de descanso"
                      : "dias de descanso"}
                  </dt>
                  <dd>
                    {restDays.length
                      ? list(restDays)
                      : "Nenhum descanso programado"}
                  </dd>
                </div>
                <div>
                  <dt>Quando começa a valer</dt>
                  <dd>
                    {formatDay(effective, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    {!hasPlan && " · hoje"}
                  </dd>
                </div>
              </dl>
              {hasPlan && (
                <p className="field-hint">
                  O plano atual continua valendo hoje. Seu histórico será
                  preservado
                  {pending
                    ? ". A nova seleção substituirá o plano pendente"
                    : ""}
                </p>
              )}
              <button
                className="primary-button plan-next"
                disabled={busy || !validTrainingSelection(days, count)}
                onClick={async () => {
                  if (saving.current || !validTrainingSelection(days, count))
                    return;
                  saving.current = true;
                  setSubmitting(true);
                  onBusyChange?.(true);
                  setMessage("");
                  try {
                    if (await training.save(days)) {
                      setStep("locked");
                      setMessage(
                        hasPlan ? "Novo plano confirmado" : "Plano criado",
                      );
                      onSaved?.(!hasPlan);
                    }
                  } finally {
                    saving.current = false;
                    setSubmitting(false);
                    onBusyChange?.(false);
                  }
                }}
              >
                <OperationSpinner active={busy} />
                {busy ? "Salvando…" : "Confirmar e salvar"}
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => setStep("days")}
              >
                Voltar e editar
              </button>
            </>
          )}
          {!locked && hasPlan && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setStep("locked");
                setDays(pending?.trainingDays ?? current);
                setCount((pending?.trainingDays ?? current).length);
              }}
            >
              Cancelar substituição
            </button>
          )}
          {training.error && (
            <p className="form-error" role="alert">
              {training.error}{" "}
              <button
                className="text-button"
                disabled={busy}
                onClick={() => void training.refresh()}
              >
                Atualizar
              </button>
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
function WeekDays({
  days,
  locked,
  onToggle,
}: {
  days: number[];
  locked: boolean;
  onToggle?: (day: number) => void;
}) {
  return (
    <div className="training-week" role="group" aria-label="Dias de treino">
      {WEEKDAYS.map((name, i) => (
        <button
          key={name}
          type="button"
          aria-label={`${name}${locked ? `, ${days.includes(i + 1) ? "treino" : "descanso"}` : ""}`}
          aria-pressed={days.includes(i + 1)}
          disabled={locked}
          onClick={() => onToggle?.(i + 1)}
        >
          <span className="training-day-name">{SHORT_DAYS[i]}</span>
          <span className="plan-day-status" aria-hidden="true">
            {days.includes(i + 1) ? <Dumbbell size={16} /> : <Moon size={16} />}
          </span>
        </button>
      ))}
    </div>
  );
}
