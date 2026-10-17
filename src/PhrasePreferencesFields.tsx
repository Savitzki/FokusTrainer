import type { PhrasePreferences, PhraseTreatment } from "./phrasePreferences";
export default function PhrasePreferencesFields({
  value,
  onChange,
}: {
  value: PhrasePreferences;
  onChange: (value: PhrasePreferences) => void;
}) {
  return (
    <>
      <label className="form-label">
        Seu nome
        <input
          autoComplete="given-name"
          maxLength={40}
          placeholder="Como você gosta de ser chamado(a)?"
          value={value.displayName}
          onChange={(e) => onChange({ ...value, displayName: e.target.value })}
        />
      </label>
      <label className="form-label">
        Tratamento nas frases
        <select
        aria-label="Tratamento nas frases"
          value={value.treatment}
          onChange={(e) =>
            onChange({ ...value, treatment: e.target.value as PhraseTreatment })
          }
        >
          <option value="neutral">Prefiro frases neutras</option>
          <option value="masculine">Masculino</option>
          <option value="feminine">Feminino</option>
        </select>
      </label>
    </>
  );
}
