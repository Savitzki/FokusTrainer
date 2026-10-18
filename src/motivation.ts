import type { PhrasePreferences } from "./phrasePreferences";
import { CAPIBORA_PHRASES, selectCapiboraPhrase } from "./capiboraVoice";

// Compatibility exports: consumers keep the existing API, with Capibora's voice.
export const MOTIVATIONAL_PHRASES = CAPIBORA_PHRASES.filter(
  (p) => p.context === "pending",
).map((p) => p.text);
export const COMPLETED_PHRASES = CAPIBORA_PHRASES.filter(
  (p) => p.context === "completed",
).map((p) => p.text);
export function motivationFor(
  done: boolean,
  index: number,
  preferences?: PhrasePreferences & { fallbackName?: string },
) {
  const phrase = selectCapiboraPhrase(
    done ? "completed" : "pending",
    index,
    done ? { completed: true } : { pending: true },
  );
  return personalizeCapiboraPhrase(phrase?.text ?? "", index, preferences);
}
export function personalizeCapiboraPhrase(
  text: string,
  index: number,
  preferences?: PhrasePreferences & { fallbackName?: string },
) {
  const name = (preferences?.displayName || preferences?.fallbackName || "")
    .trim()
    .split(/[\s._-]+/)[0];
  return preferences &&
    name &&
    [...name].length <= 12 &&
    /^[\p{L}\p{M}'-]+$/u.test(name) &&
    index % 5 === 0
    ? `${name}, ${text.charAt(0).toLocaleLowerCase("pt-BR")}${text.slice(1)}`
    : text;
}
