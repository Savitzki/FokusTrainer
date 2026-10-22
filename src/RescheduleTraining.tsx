import { useEffect, useRef, useState } from "react";
import { ArrowRightLeft, Check } from "lucide-react";
import { formatDay, type Workout } from "./model";
import {
  rescheduleFor,
  rescheduleTargets,
  reschedulesRemaining,
  trainingDayKind,
} from "./training";
import type { TrainingController } from "./useTrainingPlan";

export default function RescheduleTraining({
  day,
  workouts,
  training,
  onSaved,
  description,
  disabled = false,
  onBusyChange,
  initiallyOpen = false,
  onCancel,
}: {
  day: string;
  workouts: Workout[];
  training: TrainingController;
  onSaved: (target: string) => void;
  description?: string;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  initiallyOpen?: boolean;
  onCancel?: () => void;
}) {
  const [open, setOpen] = useState(false),
    [target, setTarget] = useState("");
  const pending = useRef(false);
  const [reading, setReading] = useState(false),
    [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function openPicker() {
    if (pending.current) return;
    pending.current = true;
    setReading(true);
    setFailure("");
    try {
      if (await training.refresh()) {
        if (alive.current) setOpen(true);
      } else if (alive.current)
        setFailure(
          "Não foi possível atualizar os dias disponíveis. Tente novamente",
        );
    } catch {
      if (alive.current)
        setFailure(
          "Não foi possível atualizar os dias disponíveis. Tente novamente",
        );
    } finally {
      pending.current = false;
      if (alive.current) setReading(false);
    }
  }

  const state = training.state;
  useEffect(() => {
    setOpen(false);
    setTarget("");
    if (initiallyOpen) void openPicker();
  }, [day, initiallyOpen]);
  if (
    !training.enabled ||
    !state?.reschedules ||
    day < state.today ||
    trainingDayKind(state, day) !== "training" ||
    rescheduleFor(state, day) ||
    workouts.some((w) => w.date === day)
  )
    return null;
  const targets = rescheduleTargets(state, day, workouts),
    remaining = reschedulesRemaining(state, day);
  const explanation = !remaining
    ? "Você já usou as trocas desta semana"
    : !targets.length
      ? "Não há descanso disponível depois deste treino, na mesma semana"
      : "";
  return (
    <div className="reschedule-action">
      {!initiallyOpen && (
        <button
          className="outline-button"
          aria-busy={reading || submitting}
          disabled={
            disabled ||
            training.busy ||
            reading ||
            submitting ||
            !targets.length
          }
          onClick={() => void openPicker()}
        >
          <ArrowRightLeft size={17} />{" "}
          {reading ? "Consultando dias…" : "Reagendar treino"}
        </button>
      )}
      {initiallyOpen && reading && <p role="status">Consultando dias…</p>}
      {description && <p className="field-hint">{description}</p>}
      <small>
        {remaining}/{state.weeklyRescheduleLimit} trocas disponíveis nesta
        semana
      </small>
      {explanation && <p className="field-hint">{explanation}</p>}
      {failure && (
        <p className="form-error" role="alert">
          {failure}
          {initiallyOpen && (
            <button
              className="outline-button"
              disabled={reading || submitting}
              onClick={() => void openPicker()}
            >
              Atualizar opções
            </button>
          )}
        </p>
      )}
      {open && (
        <div className="reschedule-picker">
          <fieldset>
            <legend>Compensar em qual descanso?</legend>
            {targets.map((date) => (
              <label
                key={date}
                className={`reschedule-option ${target === date ? "is-selected" : ""}`}
              >
                <input
                  type="radio"
                  name="reschedule-date"
                  value={date}
                  checked={target === date}
                  disabled={disabled || training.busy || submitting}
                  onChange={() => setTarget(date)}
                />
                <span>
                  {formatDay(date, {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </label>
            ))}
          </fieldset>
          <p className="field-hint">
            O dia original vira descanso. A troca não soma pontos nem potes
          </p>
          {training.error && (
            <p className="form-error" role="alert">
              {training.error}
            </p>
          )}
          <div className="form-actions">
            <button
              className="outline-button"
              disabled={disabled || training.busy || submitting}
              onClick={() => {
                setOpen(false);
                onCancel?.();
              }}
            >
              Cancelar
            </button>
            <button
              className="primary-button"
              disabled={
                disabled ||
                training.busy ||
                submitting ||
                !targets.includes(target)
              }
              onClick={async () => {
                if (pending.current || disabled || !targets.includes(target))
                  return;
                pending.current = true;
                setSubmitting(true);
                setFailure("");
                onBusyChange?.(true);
                try {
                  if (
                    (await training.reschedule(day, target)) &&
                    alive.current
                  ) {
                    setOpen(false);
                    onSaved(target);
                  }
                } catch {
                  if (alive.current)
                    setFailure(
                      "Não foi possível confirmar a troca. Atualize e tente novamente",
                    );
                } finally {
                  pending.current = false;
                  if (alive.current) setSubmitting(false);
                  onBusyChange?.(false);
                }
              }}
            >
              <Check size={17} />
              {training.busy || submitting ? "Confirmando…" : "Confirmar troca"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
