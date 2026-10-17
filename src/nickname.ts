import { normalizeNickname } from "./profile";
export const isEmailAddress = (value: string) =>
  value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export const isNickname = (value: string) =>
  /^[\p{L}\p{N}_.-]{3,24}$/u.test(normalizeNickname(value));
export type NicknameAvailability = {
  valid: boolean;
  available: boolean;
  suggestions: string[];
};
export function readNicknameAvailability(raw: unknown): NicknameAvailability {
  const v = raw as NicknameAvailability;
  if (
    !v ||
    typeof v.valid !== "boolean" ||
    typeof v.available !== "boolean" ||
    !Array.isArray(v.suggestions) ||
    v.suggestions.length > 3 ||
    !v.suggestions.every((s) => typeof s === "string" && isNickname(s))
  )
    throw new Error("Não foi possível conferir esse nick. Tente novamente");
  return v;
}
export class NicknameConflictError extends Error {
  constructor(public readonly suggestions: string[]) {
    super("Esse nick já está em uso. Escolha uma das sugestões ou tente outro");
  }
}
