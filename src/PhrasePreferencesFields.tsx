import type { PhrasePreferences, PhraseTreatment } from "./phrasePreferences";
export default function PhrasePreferencesFields({
  value,
  onChange,
  field,
}: {
  value: PhrasePreferences;
  onChange: (value: PhrasePreferences) => void;
  field?: "name" | "sex";
}) {
  return (
    <>
      {field !== "sex" && (
        <label className="form-label">
          Seu nome
          <input
            autoComplete="given-name"
            enterKeyHint={field === "name" ? "next" : undefined}
            maxLength={40}
            placeholder={
              field ? undefined : "Como você gosta de ser chamado(a)?"
            }
            value={value.displayName}
            onChange={(e) =>
              onChange({ ...value, displayName: e.target.value })
            }
          />
        </label>
      )}
      {field !== "name" && (
        <label className="form-label">
          Sexo
          <select
            aria-label="Sexo"
            value={value.treatment}
            onChange={(e) =>
              onChange({
                ...value,
                treatment: e.target.value as PhraseTreatment,
              })
            }
          >
            <option value="neutral">Prefiro não informar</option>
            <option value="masculine">Masculino</option>
            <option value="feminine">Feminino</option>
          </select>
        </label>
      )}
    </>
  );
}
