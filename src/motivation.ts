import type { PhrasePreferences } from "./phrasePreferences";
import {
  CAPIBORA_PHRASES,
  composeCapiboraMessage,
  selectCapiboraPhrase,
  type CapiboraMessage,
} from "./capiboraVoice";

// Compatibility exports: consumers keep the existing API, with Capibora's voice.
export const MOTIVATIONAL_PHRASES = CAPIBORA_PHRASES.filter(
  (p) => p.context === "pending",
).map(composeCapiboraMessage);
export const COMPLETED_PHRASES = CAPIBORA_PHRASES.filter(
  (p) => p.context === "completed",
).map(composeCapiboraMessage);
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
  return personalizeCapiboraPhrase(
    phrase ? composeCapiboraMessage(phrase) : "",
    index,
    preferences,
  );
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

/** Keep names in the complement so a long name never crowds the headline. */
export function personalizeCapiboraMessage(
  message: CapiboraMessage,
  index: number,
  preferences?: Parameters<typeof personalizeCapiboraPhrase>[2],
): CapiboraMessage {
  return {
    ...message,
    body: personalizeCapiboraPhrase(message.body, index, preferences),
  };
}
