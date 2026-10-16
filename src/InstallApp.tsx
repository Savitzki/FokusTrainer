import { useEffect, useState } from "react";
import { ArrowDownToLine, Smartphone, X } from "lucide-react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function InstallApp() {
  const [installed, setInstalled] = useState(isStandalone);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [guide, setGuide] = useState(false);
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    const media = window.matchMedia?.("(display-mode: standalone)");
    const onDisplay = () => setInstalled(isStandalone());
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    media?.addEventListener?.("change", onDisplay);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      media?.removeEventListener?.("change", onDisplay);
    };
  }, []);
  if (installed) return null;
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  async function install() {
    if (!prompt) {
      setGuide(true);
      return;
    }
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "dismissed") setGuide(true);
    } catch {
      setGuide(true);
    } finally {
      setPrompt(null);
    }
  }
  return (
    <section className="install-card" aria-label="Instalar aplicativo">
      <div className="install-heading">
        <Smartphone size={23} />
        <div>
          <h2>FokusTrainer no celular</h2>
          <p>Acesso direto pela tela inicial.</p>
        </div>
        <button className="outline-button" onClick={install}>
          <ArrowDownToLine size={18} /> Instalar app
        </button>
      </div>
      {guide && (
        <div className="install-guide">
          <button
            className="icon-button"
            aria-label="Fechar instruções de instalação"
            onClick={() => setGuide(false)}
          >
            <X size={18} />
          </button>
          <strong>{ios ? "No iPhone ou iPad" : "Pelo navegador"}</strong>
          <p>
            {!window.isSecureContext
              ? "Abra o endereço HTTPS publicado do app para instalar."
              : ios
                ? "No Safari: Compartilhar → Adicionar à Tela de Início → Adicionar. Se aparecer, ative Abrir como App."
                : "No Chrome do Android: menu ⋮ → Instalar app ou Adicionar à tela inicial. Em outros navegadores, procure Instalar no menu; se não aparecer, abra no Chrome (Android) ou Safari (iPhone)."}
          </p>
          <small>Instalar não ativa avisos com o app fechado.</small>
        </div>
      )}
    </section>
  );
}
