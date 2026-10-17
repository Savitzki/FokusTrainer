import { useEffect, useState } from "react";
import { Check, Dumbbell, Moon } from "lucide-react";
import { formatDay, shiftDate } from "./model";
import { trainingDaysFor, WEEKDAYS } from "./training";
import type { TrainingController } from "./useTrainingPlan";

export default function TrainingScheduleSettings({
  training,
  onLogin,
}: {
  training: TrainingController;
  onLogin: () => void;
}) {
  const [days, setDays] = useState<number[]>([]),
    [message, setMessage] = useState("");
  const state = training.state;
  useEffect(() => {
    void training.refresh();
  }, [training.refresh]);
  useEffect(() => {
    if (state) setDays(trainingDaysFor(state, shiftDate(state.today, 1)));
  }, [state?.revision]);
  return (
    <section className="training-settings" aria-label="Semana de treinos">
      <h4>
        <Dumbbell size={18} /> Sua semana
      </h4>
      {!training.enabled ? (
        <button type="button" className="text-button" onClick={onLogin}>
          Entre para configurar sua semana
        </button>
      ) : (
        <>
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
                <span>
                  {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][i]}
                </span>
                {days.includes(i + 1) ? (
                  <Dumbbell size={17} />
                ) : (
                  <Moon size={17} />
                )}
              </button>
            ))}
          </div>
          <p className="field-hint">
            <Dumbbell size={13} /> Treino <Moon size={13} /> Descanso
          </p>
          <p className="field-hint">
            Mudanças a partir de{" "}
            {state ? formatDay(shiftDate(state.today, 1)) : "amanhã"}
          </p>
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
            <button
              type="button"
              className="outline-button"
              disabled={training.busy || !days.length}
              onClick={async () => {
                setMessage("");
                if (await training.save(days)) setMessage("Semana salva 🔥");
              }}
            >
              <Check size={17} />
              {training.busy ? "Salvando…" : "Salvar semana"}
            </button>
          )}
          {!days.length && state && (
            <p className="field-hint">Escolha pelo menos um dia de treino</p>
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
