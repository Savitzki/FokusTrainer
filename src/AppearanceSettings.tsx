import { useEffect, useState } from "react";
import { ArrowLeft, Check, Moon, Sun } from "lucide-react";
import { applyTheme, readTheme, THEME_STORAGE_KEY, type Theme } from "./theme";

export default function AppearanceSettings({ onBack }: { onBack: () => void }) {
  const [theme, setTheme] = useState(readTheme);
  const [error, setError] = useState("");
  useEffect(() => {
    const sync = () => setTheme(readTheme());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function chooseTheme(next: Theme) {
    setTheme(next);
    applyTheme(next);
    setError("");
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      setError(
        "A aparência mudou, mas o navegador não permitiu salvar a escolha neste aparelho.",
      );
    }
  }
  return (
    <section className="appearance-settings" aria-labelledby="settings-title">
      <button className="text-button" onClick={onBack}>
        <ArrowLeft size={17} /> Voltar ao perfil
      </button>
      <h3 id="settings-title">Configurações</h3>
      <fieldset className="theme-options">
        <legend>Aparência</legend>
        <div role="radiogroup" aria-label="Modo de aparência">
          {(
            [
              { value: "light", label: "Claro", Icon: Sun },
              { value: "dark", label: "Escuro", Icon: Moon },
            ] as const
          ).map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => chooseTheme(value)}
            >
              <Icon size={25} />
              <span>{label}</span>
              <span className="theme-check" aria-hidden="true">
                {theme === value && <Check size={16} />}
              </span>
            </button>
          ))}
        </div>
      </fieldset>
      <p className="privacy-note">Sua escolha fica salva neste aparelho</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
