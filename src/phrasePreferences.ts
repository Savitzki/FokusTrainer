export type PhraseTreatment = "masculine" | "feminine" | "neutral";
export type PhrasePreferences = {
  displayName: string;
  treatment: PhraseTreatment;
};
export const defaultPhrasePreferences = (): PhrasePreferences => ({
  displayName: "",
  treatment: "neutral",
});
export function readPhrasePreferences(
  metadata: Record<string, unknown> | undefined,
): PhrasePreferences {
  const name =
    typeof metadata?.display_name === "string"
      ? metadata.display_name.normalize("NFKC").trim().replace(/\s+/g, " ")
      : "";
  return {
    displayName: /^[\p{L}\p{M} '\-]{1,40}$/u.test(name) ? name : "",
    treatment:
      metadata?.phrase_treatment === "masculine" ||
      metadata?.phrase_treatment === "feminine"
        ? metadata.phrase_treatment
        : "neutral",
  };
}
export function validatePhrasePreferences(
  value: PhrasePreferences,
): PhrasePreferences {
  const name = value.displayName.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (name && !/^[\p{L}\p{M} '\-]{1,40}$/u.test(name))
    throw new Error(
      "Use até 40 caracteres no nome, com letras, espaços, hífen ou apóstrofo.",
    );
  if (!["masculine", "feminine", "neutral"].includes(value.treatment))
    throw new Error("Escolha como prefere as frases.");
  return { displayName: name, treatment: value.treatment };
}
