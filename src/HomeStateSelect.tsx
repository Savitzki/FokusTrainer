import { BRAZILIAN_STATES } from "./homeState";
export default function HomeStateSelect({
  value,
  onChange,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="form-label">
      De qual estado você é?
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      >
        <option value="" disabled>
          Escolha seu estado
        </option>
        {Object.entries(BRAZILIAN_STATES).map(([uf, name]) => (
          <option key={uf} value={uf}>
            {name} · {uf}
          </option>
        ))}
        <option value="general">Prefiro frases gerais</option>
      </select>
      <small className="field-hint">Pra dar seu sotaque às provocações</small>
    </label>
  );
}
