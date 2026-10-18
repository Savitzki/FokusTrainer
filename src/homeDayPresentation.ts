import { isTrainingDay, type EffectiveDayKind } from "./training";

// Presentation only: the effective day and the streak still come from training.ts.
export function homeDayPresentation(
  kind: EffectiveDayKind,
  trained: boolean,
  motivation: string,
) {
  const voluntary = trained && !isTrainingDay(kind) && kind !== "unplanned";
  if (kind === "training" || kind === "compensatory" || kind === "unplanned")
    return {
      title: motivation,
      information: kind === "compensatory" ? "Treino compensatório" : null,
      explanation: null,
      voluntary: false,
    };

  const labels = {
    "scheduled-rest": ["Descansa, a chama tá segura", "Descanso programado"],
    "rescheduled-rest": [
      "Treino transferido, chama protegida",
      "Descanso por reagendamento",
    ],
    "extra-rest": ["Pausa autorizada, chama protegida", "Descanso extra"],
    "medical-kit": ["Kit em ação, chama protegida", "Kit Médico usado"],
  };
  const [title, information] = labels[kind];
  return {
    title: voluntary ? "Treino extra concluído!" : title,
    information:
      voluntary && kind === "scheduled-rest"
        ? "Você treinou no seu descanso"
        : information,
    explanation: voluntary
      ? "Sua ofensiva continua protegida, sem somar pontos"
      : "Sua ofensiva está protegida",
    voluntary,
  };
}
