import { CAPIBORA_PHRASES } from "./capiboraVoice";
import { STORAGE_KEY } from "./model";

export const MANUAL_MINIMUM_MINUTES = 35;
export const MANUAL_FINAL_QUESTION =
  "Você confirma que realmente treinou por pelo menos 35 minutos?";
const MANUAL_QUESTION_IDS = [
  "real",
  "happened",
  "earned",
  "honest",
  "witness",
  "truth",
  "effort",
  "not-invented",
  "outside-head",
  "flame",
] as const;
export const MANUAL_QUESTIONS = MANUAL_QUESTION_IDS.map((id) => ({
  id,
  text: CAPIBORA_PHRASES.find((p) => p.id === `manual-question-${id}`)!.text,
}));
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
