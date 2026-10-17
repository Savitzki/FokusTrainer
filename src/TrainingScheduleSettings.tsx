import { useEffect, useState } from "react";
import { Check, Dumbbell, Flame, Moon } from "lucide-react";
import { formatDay, shiftDate, type Workout } from "./model";
import {
  TRAINING_DAYS_PER_WEEK,
  trainingDaysFor,
  weeklyTrainingProgress,
  WEEKDAYS,
} from "./training";
import type { TrainingController } from "./useTrainingPlan";

export default function TrainingScheduleSettings({
  training,
  onLogin,
  workouts = [],
}: {
  training: TrainingController;
  onLogin: () => void;
  workouts?: Workout[];
}) {
  const [days, setDays] = useState<number[]>([]),
    [message, setMessage] = useState("");
  const state = training.state;
  const invalidWeek = days.length !== TRAINING_DAYS_PER_WEEK;
  const rests = WEEKDAYS.length - days.length;
  const progress =
    training.enabled && state ? weeklyTrainingProgress(workouts, state) : null;
  const remaining = progress?.remaining ?? TRAINING_DAYS_PER_WEEK;
  const progressMessage =
    remaining === 0
      ? "Semana concluída. Você fez acontecer 🔥"
      : `${remaining === 1 ? "Falta 1 treino" : `Faltam ${remaining} treinos`} para concluir a semana`;
  useEffect(() => {
    void training.refresh();
  }, [training.refresh]);
  useEffect(() => {
    if (state) setDays(trainingDaysFor(state, shiftDate(state.today, 1)));
  }, [state?.revision, state?.today]);
  return (
    <>
      <section className="card training-settings" aria-label="Semana de treinos">
        <div className="training-settings-heading">
          <h2>Personalize sua semana</h2>
          {state && training.enabled && (
            <span className="training-count">{days.length} treinos</span>
          )}
        </div>
        {!training.enabled ? (
          <button type="button" className="text-button" onClick={onLogin}>
            Entre para configurar sua semana
          </button>
        ) : (
          <>
            <p className="training-instruction">
              Toque nos dias para alternar treino e descanso
            </p>
            <div
              className="training-week"
              role="group"
              aria-label="Dias de treino"
            >
              {WEEKDAYS.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  aria-label={name}
                  aria-pressed={days.includes(i + 1)}
                  disabled={training.busy || !state}
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
                  <span className="training-day-name">
                    {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][i]}
                  </span>
                </button>
              ))}
            </div>
            <div className="training-selection-summary" aria-live="polite">
              <span>
                {rests} {rests === 1 ? "dia" : "dias"} de descanso programado
              </span>
              <strong>{days.length}/7 dias</strong>
            </div>
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
                  Vale a partir de{" "}
                  {formatDay(shiftDate(state.today, 1), {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <button
                  type="button"
                  className="outline-button"
                  disabled={training.busy || invalidWeek}
                  onClick={async () => {
                    if (invalidWeek) return;
                    setMessage("");
                    if (await training.save(days)) setMessage("Semana salva 🔥");
                  }}
                >
                  <Check size={17} />
                  {training.busy ? "Salvando…" : "Salvar semana"}
                </button>
              </div>
            )}
            {invalidWeek && state && (
              <p className="field-hint" role="alert">
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
      {progress && (
        <section
          className="card training-progress"
          aria-label="Progresso da semana"
        >
          <h2>
            <Flame size={18} aria-hidden="true" /> Sua semana
          </h2>
          <div className="training-progress-values">
            <div>
              <strong>
                {progress.completed}
                <span>/{progress.goal}</span>
              </strong>
              <span>treinos concluídos</span>
            </div>
            <strong className="training-progress-percent">
              {progress.percent}%
            </strong>
          </div>
          <progress
            aria-label="Treinos concluídos na semana"
            value={progress.completed}
            max={progress.goal}
          />
          <p aria-live="polite">{progressMessage}</p>
        </section>
      )}
    </>
  );
}
