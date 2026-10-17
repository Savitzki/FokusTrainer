import { useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";

export default function FullscreenControl() {
  const [active, setActive] = useState(() =>
    Boolean(document.fullscreenElement),
  );
  const [appFullscreen, setAppFullscreen] = useState(() =>
    Boolean(window.matchMedia?.("(display-mode: fullscreen)")?.matches),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const mode = window.matchMedia?.("(display-mode: fullscreen)");
    const update = () => {
      setActive(Boolean(document.fullscreenElement));
      setAppFullscreen(Boolean(mode?.matches));
    };
    document.addEventListener("fullscreenchange", update);
    mode?.addEventListener?.("change", update);
    return () => {
      document.removeEventListener("fullscreenchange", update);
      mode?.removeEventListener?.("change", update);
    };
  }, []);
  if (
    !document.fullscreenEnabled ||
    !document.documentElement.requestFullscreen ||
    (appFullscreen && !active)
  )
    return null;
  return (
    <div className="fullscreen-control">
      <button
        className="outline-button"
        disabled={busy}
        aria-pressed={active}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else
              await document.documentElement.requestFullscreen({
                navigationUI: "hide",
              });
          } catch {
            setError(
              "O navegador não liberou a tela cheia. As barras seguem as cores do app quando o sistema permite.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {active ? <Minimize size={18} /> : <Maximize size={18} />}
        {active ? "Sair da tela cheia" : "Tela cheia"}
      </button>
      <p>Oculta as barras quando o celular permite</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
