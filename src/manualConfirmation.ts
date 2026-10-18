import { STORAGE_KEY } from "./model";

export const MANUAL_MINIMUM_MINUTES = 35;
export const MANUAL_FINAL_QUESTION =
  "Você confirma que realmente treinou por pelo menos 35 minutos?";
export const MANUAL_QUESTIONS = [
  { id: "real", text: "Você treinou de verdade, sem inventar história?" },
  {
    id: "happened",
    text: "Esse treino aconteceu mesmo, fora da sua imaginação?",
  },
  { id: "earned", text: "Sua ofensiva realmente merece esse ponto hoje?" },
  { id: "honest", text: "Você está sendo sincero sobre esse treino?" },
  {
    id: "witness",
    text: "Quem tivesse visto o treino confirmaria sua história?",
  },
  { id: "truth", text: "Pode confirmar esse treino sem pesar na consciência?" },
  { id: "effort", text: "Você realmente dedicou esse tempo a treinar?" },
  { id: "not-invented", text: "Você garante que não inventou esse treino?" },
  { id: "outside-head", text: "Esse treino existiu fora da sua cabeça?" },
  { id: "flame", text: "Você fez por merecer essa chama hoje?" },
] as const;
export type ManualQuestionId = (typeof MANUAL_QUESTIONS)[number]["id"];
export type ManualConfirmation = {
  version: 1;
  questionIds: [ManualQuestionId, ManualQuestionId];
  answers: [true, true, true];
};
export function validManualConfirmation(
  raw: unknown,
): raw is ManualConfirmation {
  const c = raw as ManualConfirmation;
  return Boolean(
    c &&
      c.version === 1 &&
      Object.keys(c).length === 3 &&
      Array.isArray(c.questionIds) &&
      c.questionIds.length === 2 &&
      c.questionIds[0] !== c.questionIds[1] &&
      c.questionIds.every((id) => MANUAL_QUESTIONS.some((q) => q.id === id)) &&
      Array.isArray(c.answers) &&
      c.answers.length === 3 &&
      c.answers.every((answer) => answer === true),
  );
}
export function pickManualQuestions(
  previous: readonly string[] = [],
  random = Math.random,
): [ManualQuestionId, ManualQuestionId] {
  const available = MANUAL_QUESTIONS.filter(
    (q) => !previous.includes(q.id),
  ).map((q) => q.id);
  const pool =
    available.length >= 2 ? available : MANUAL_QUESTIONS.map((q) => q.id);
  const first = pool.splice(
    Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length))),
    1,
  )[0];
  const second = pool.splice(
    Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length))),
    1,
  )[0];
  return [first, second];
}
function recentKey(userId?: string) {
  return `${STORAGE_KEY}:account:${userId ?? "guest"}:manual-questions`;
}
export function recentManualQuestions(userId?: string): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(recentKey(userId)) ?? "[]");
    return Array.isArray(ids)
      ? ids.filter((id) => typeof id === "string").slice(0, 2)
      : [];
  } catch {
    return [];
  }
}
export function rememberManualQuestions(
  userId: string | undefined,
  ids: ManualConfirmation["questionIds"],
) {
  try {
    localStorage.setItem(recentKey(userId), JSON.stringify(ids));
  } catch {
    /* Variety is optional; confirmation is validated online. */
  }
}
export const MANUAL_ASIDES = [
  "Pensa bem antes de responder 👀",
  "Sua consciência está acompanhando",
  "A chama não aceita histórias inventadas",
];
export const MANUAL_ACKNOWLEDGMENTS = [
  "Tá bom, vou acreditar",
  "Espero que seja verdade 👀",
  "Até agora sua história parece convincente",
];
