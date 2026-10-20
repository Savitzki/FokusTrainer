import { isTrainingDay, type EffectiveDayKind } from "./training";
import { phraseText, type VoiceContext } from "./capiboraVoice";

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
  const title =
    context === "unplanned"
      ? "Já está quase tudo pronto..."
      : context === "pending" || context === "completed"
        ? motivation
        : phraseText(context, 0, facts);
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
