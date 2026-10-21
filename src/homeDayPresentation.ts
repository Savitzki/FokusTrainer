import {
  dateInTimezone,
  hasTrainingPlan,
  isTrainingDay,
  planFor,
  trainingDayKind,
  type EffectiveDayKind,
  type TrainingState,
} from "./training";
import type { RecordingState } from "./workoutRecording";
import { selectCapiboraPhrase, type VoiceContext } from "./capiboraVoice";

/** Visibility only. Server time + its monotonic anchor cannot reopen yesterday
 * when the device clock changes. Every operation still needs its existing RPC. */
export function canOpenMissedWorkout({
  authenticated,
  training,
  recording,
  elapsedMs = 0,
  trained,
  pendingWorkout = false,
  protectedDay = false,
}: {
  authenticated: boolean;
  training: TrainingState | null;
  recording: RecordingState | null;
  elapsedMs?: number;
  trained: boolean;
  pendingWorkout?: boolean;
  protectedDay?: boolean;
}) {
  if (
    !authenticated ||
    !training ||
    !recording ||
    trained ||
    pendingWorkout ||
    protectedDay ||
    !hasTrainingPlan(training) ||
    !planFor(training, training.today) ||
    recording.today !== training.today ||
    recording.timezone !== training.timezone ||
    recording.session?.status === "active" ||
    recording.session?.workout?.date === training.today ||
    !isTrainingDay(trainingDayKind(training, training.today))
  )
    return false;
  try {
    return (
      dateInTimezone(
        new Date(Date.parse(recording.serverNow) + Math.max(0, elapsedMs)),
        training.timezone,
      ) === training.today
    );
  } catch {
    return false;
  }
}

// Presentation only: the effective day and the streak still come from training.ts.
export function homeDayPresentation(
  kind: EffectiveDayKind,
  trained: boolean,
  motivation: string,
  options: { needsPlan?: boolean; active?: boolean; returning?: boolean } = {},
) {
  const voluntary = trained && !isTrainingDay(kind) && kind !== "unplanned";
  const context: VoiceContext = trained
    ? voluntary
      ? "voluntary"
      : "completed"
    : options.active
      ? "active"
      : options.needsPlan || kind === "unplanned"
        ? "unplanned"
        : isTrainingDay(kind)
          ? options.returning
            ? "returning"
            : "pending"
          : kind === "rescheduled-rest"
            ? "rescheduled"
            : kind === "medical-kit" || kind === "extra-rest"
              ? "protected"
              : "rest";
  const facts = { [context]: true, completed: trained, voluntary };
  const phrase = selectCapiboraPhrase(context, 0, facts);
  const title = phrase?.title ?? motivation;
  const information =
    options.active && !trained
      ? "Treino em andamento"
      : options.needsPlan && !trained
        ? ""
        : kind === "compensatory"
          ? "Treino compensatório"
          : kind === "medical-kit"
            ? "Kit Médico usado"
            : kind === "extra-rest"
              ? "Descanso extra"
              : kind === "rescheduled-rest"
                ? "Descanso por reagendamento"
                : kind === "scheduled-rest"
                  ? voluntary
                    ? "Você treinou no seu descanso"
                    : "Descanso programado"
                  : trained
                    ? "Treino concluído"
                    : "Treino de hoje";
  return {
    title,
    body: phrase?.body ?? "",
    information,
    context,
    facts,
    voluntary,
    explanation:
      context === "unplanned"
        ? null
        : !isTrainingDay(kind) && kind !== "unplanned"
          ? voluntary
            ? "Sua ofensiva continua protegida, sem somar pontos"
            : "Sua ofensiva está protegida"
          : null,
  };
}
