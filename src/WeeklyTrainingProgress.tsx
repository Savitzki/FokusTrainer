import { Flame } from "lucide-react";
import type { Workout } from "./model";
import { weeklyTrainingProgress, type TrainingState } from "./training";

export default function WeeklyTrainingProgress({
  workouts,
  training,
  compact = false,
}: {
  workouts: Workout[];
  training: TrainingState | null;
  compact?: boolean;
}) {
  if (!training) return null;
  const progress = weeklyTrainingProgress(workouts, training);
  if (!progress.goal) return null;
  const remaining = progress.remaining;
  const progressMessage =
    remaining === 0
      ? "Semana concluída. Você fez acontecer 🔥"
      : `${remaining === 1 ? "Falta 1 treino" : `Faltam ${remaining} treinos`} para concluir a semana`;
  return (
    <section
      className="card training-progress"
      aria-label="Progresso da semana"
    >
      <h2>
        <Flame size={18} aria-hidden="true" /> Sua semana
      </h2>
      <div className="training-progress-values">
        <div>
          <strong
            aria-label={
              compact
                ? `${progress.completed} de ${progress.goal} treinos obrigatórios concluídos`
                : undefined
            }
          >
            {progress.completed}
            <span>
              {compact ? ` de ${progress.goal} treinos` : `/${progress.goal}`}
            </span>
          </strong>
          <span>
            {compact ? "obrigatórios concluídos" : "treinos concluídos"}
          </span>
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
      <p aria-live="polite">
        {compact && remaining > 0
          ? `${remaining === 1 ? "Falta 1 treino" : `Faltam ${remaining} treinos`} para cumprir seu plano.`
          : progressMessage}
      </p>
    </section>
  );
}
