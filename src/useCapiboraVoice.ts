import { useEffect, useMemo, useState } from "react";
import {
  CAPIBORA_PHRASES,
  selectCapiboraPhrase,
  type VoiceContext,
  type VoiceFacts,
} from "./capiboraVoice";
import { STORAGE_KEY } from "./model";
import { accountStorageGeneration } from "./accountStorage";

/** Cosmetic variety only; uses the existing account namespace and logout cleanup. */
export function useCapiboraVoice(
  context: VoiceContext,
  facts: VoiceFacts,
  day: string,
  userId?: string,
) {
  const key = `${STORAGE_KEY}:account:${userId ?? "guest"}:capibora-voice`;
  const generation = useMemo(
    () => (userId ? accountStorageGeneration(userId) : 0),
    [userId],
  );
  function readRecent(): Record<string, string> {
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? "{}");
      return stored && typeof stored === "object" && !Array.isArray(stored)
        ? Object.fromEntries(
            Object.entries(stored).filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === "string" &&
                CAPIBORA_PHRASES.some(
                  (p) => p.context === entry[0] && p.id === entry[1],
                ),
            ),
          )
        : {};
    } catch {
      return {};
    }
  }
  const previous = useMemo(readRecent, [key]);
  const factsKey = JSON.stringify(facts);
  const [seed] = useState(() => Math.floor(Math.random() * 10000));
  const phrase = useMemo(
    () =>
      selectCapiboraPhrase(
        context,
        seed + Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000),
        facts,
        previous[context],
      ),
    [context, day, factsKey, seed, previous],
  );
  useEffect(() => {
    if (!phrase || (userId && accountStorageGeneration(userId) !== generation))
      return;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ ...readRecent(), [context]: phrase.id }),
      );
    } catch {
      /* Copy must work without storage. */
    }
  }, [phrase?.id, key, generation, userId, previous]);
  return phrase;
}
