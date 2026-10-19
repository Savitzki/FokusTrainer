import { useEffect, useState } from "react";
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
}: {
  day: string;
  workouts: Workout[];
  training: TrainingController;
  onSaved: (target: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [target, setTarget] = useState("");
  const state = training.state;
  useEffect(() => {
    setOpen(false);
    setTarget("");
  }, [day]);
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
      <button
        className="outline-button"
        disabled={training.busy || !targets.length}
        onClick={async () => {
          await training.refresh();
          setOpen(true);
        }}
      >
        <ArrowRightLeft size={17} /> Reagendar treino
      </button>
      <small>
        {remaining}/{state.weeklyRescheduleLimit} trocas disponíveis nesta
        semana
      </small>
      {explanation && <p className="field-hint">{explanation}</p>}
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
                  disabled={training.busy}
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
              disabled={training.busy}
              onClick={() => setOpen(false)}
            >
              Cancelar
            </button>
            <button
              className="primary-button"
              disabled={training.busy || !targets.includes(target)}
              onClick={async () => {
                if (!targets.includes(target)) return;
                if (await training.reschedule(day, target)) {
                  setOpen(false);
                  onSaved(target);
                }
              }}
            >
              <Check size={17} />
              {training.busy ? "Confirmando…" : "Confirmar troca"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
