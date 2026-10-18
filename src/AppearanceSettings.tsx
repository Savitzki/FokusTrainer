import { useEffect, useState } from "react";
import { ChevronDown, CircleHelp, Moon } from "lucide-react";
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
      aria-label="Aparência e informações do app"
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
      <details className="settings-about help-content">
        <summary>
          <h2>
            <CircleHelp size={19} /> Sobre o app
          </h2>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <p>
          Capibora é treino, amigos e pequenas vitórias. Planeje sua semana,
          acompanhe seu progresso e participe de desafios no seu ritmo.
        </p>
        <p>
          Confirme um treino por dia. Depois de confirmar, ele não pode ser
          editado nem excluído. Só é possível registrar o dia atual. Se um dia
          de treino passar sem confirmação nem descanso autorizado, a ofensiva
          zera. Descansos válidos mantêm a sequência sem somar pontos. Treinos
          em descanso ficam no histórico, sem pontos extras.
        </p>
        <p>
          Seu peso é privado. Amigos veem apenas seu perfil e as informações da
          ofensiva. Registros pendentes precisam de conexão para serem
          confirmados.
        </p>
        <p>
          Os lembretes locais precisam do app aberto. O push pode funcionar com
          ele fechado quando disponível e autorizado neste aparelho. Nenhum
          aviso substitui o descanso quando você precisar.
        </p>
      </details>
    </section>
  );
}
