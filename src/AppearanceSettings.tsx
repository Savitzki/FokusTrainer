import { useEffect, useState } from "react";
import { Moon } from "lucide-react";
import { applyTheme, readTheme, THEME_STORAGE_KEY, type Theme } from "./theme";

export default function AppearanceSettings() {
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
    <section
      className="appearance-settings"
      aria-label="Aparência"
    >
      <h2 className="settings-section-title">
        <Moon size={20} aria-hidden="true" /> Aparência
      </h2>
      <div className="appearance-switch-row">
        <div>
          <strong>Modo escuro</strong>
        </div>
        <button
          type="button"
          role="switch"
          aria-label="Modo escuro"
          aria-checked={theme === "dark"}
          className={`toggle ${theme === "dark" ? "enabled" : ""}`}
          onClick={() => chooseTheme(theme === "dark" ? "light" : "dark")}
        >
          <span />
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

    </section>
  );
}
