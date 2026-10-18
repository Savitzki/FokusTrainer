import { useEffect, useState } from "react";
import { Copy, Download, Share2 } from "lucide-react";
import type { Profile } from "./profile";
import {
  createShareImage,
  downloadShareImage,
  SHARE_MESSAGES,
  type ShareFormat,
} from "./sharing";

export default function SharePanel({
  profile,
  days,
  date,
  styleId,
  frameId,
}: {
  profile: Profile | null;
  days: number;
  date: string;
  styleId?: string;
  frameId?: string;
}) {
  const [format, setFormat] = useState<ShareFormat>("story");
  const [message, setMessage] = useState(SHARE_MESSAGES[0]);
  const [generated, setGenerated] = useState<{
    file: File;
    url: string;
    key: string;
  } | null>(null);
  const inputKey = JSON.stringify({
    profile,
    days,
    date,
    message,
    format,
    styleId,
    frameId,
  });
  const asset = generated?.key === inputKey ? generated : null;
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    let cancelled = false,
      url: string | null = null;
    setGenerated(null);
    setError("");
    setNotice("");
    if (!days || !message.trim()) return;
    const timer = window.setTimeout(() => {
      void createShareImage({
        profile,
        days,
        message,
        format,
        date,
        ...(styleId ? { styleId } : {}),
        ...(frameId ? { frameId } : {}),
      })
        .then((file) => {
          if (cancelled) return;
          url = URL.createObjectURL(file);
          setGenerated({ file, url, key: inputKey });
        })
        .catch((error) => {
          if (!cancelled) setError((error as Error).message);
        });
    }, 150);
    return () => {
      window.clearTimeout(timer);
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [inputKey]);
  async function share() {
    if (!asset) return;
    setError("");
    setNotice("");
    if (!navigator.share || !navigator.canShare?.({ files: [asset.file] })) {
      setNotice(
        "Neste navegador, baixe o card e publique pela galeria da sua rede social.",
      );
      return;
    }
    setSharing(true);
    try {
      await navigator.share({
        files: [asset.file],
        title: "Minha ofensiva no FokusTrainer",
        text: message,
      });
    } catch (error) {
      if (
        !(
          error &&
          typeof error === "object" &&
          "name" in error &&
          error.name === "AbortError"
        )
      )
        setError(
          "Não foi possível abrir o compartilhamento. Você pode baixar a imagem abaixo.",
        );
    } finally {
      setSharing(false);
    }
  }
  return (
    <div className="share-panel">
      <div className="segmented-control" aria-label="Formato do card">
        <button
          aria-pressed={format === "story"}
          onClick={() => setFormat("story")}
        >
          Story · 9:16
        </button>
        <button
          aria-pressed={format === "square"}
          onClick={() => setFormat("square")}
        >
          Quadrado · 1:1
        </button>
      </div>
      <div className={`share-preview ${format}`}>
        {asset ? (
          <img
            src={asset.url}
            alt={`Card de ${days} ${days === 1 ? "dia" : "dias"} de ofensiva${profile ? ` de ${profile.nickname}` : ""}`}
          />
        ) : (
          <p role="status">
            {days < 1
              ? "Sem ofensiva ativa. Confirme o treino de hoje."
              : message.trim()
                ? "Preparando seu card…"
                : "Escreva uma mensagem para gerar o card."}
          </p>
        )}
      </div>
      <label className="form-label">
        Sua mensagem
        <textarea
          maxLength={160}
          rows={3}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </label>
      <div className="message-suggestions" aria-label="Sugestões de mensagem">
        {["Um dia de cada vez", "Cuidar de mim", "Sem perfeição"].map(
          (label, index) => (
            <button
              aria-pressed={message === SHARE_MESSAGES[index]}
              key={label}
              onClick={() => setMessage(SHARE_MESSAGES[index])}
            >
              {label}
            </button>
          ),
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="field-hint" role="status">
          {notice}
        </p>
      )}
      <button
        className="primary-button form-submit"
        disabled={!asset || sharing}
        onClick={share}
      >
        <Share2 size={18} />
        {sharing ? "Abrindo…" : "Compartilhar imagem"}
      </button>
      <div className="share-secondary">
        <button
          className="outline-button"
          disabled={!asset}
          onClick={() => {
            if (asset) {
              downloadShareImage(asset.file);
              setNotice(
                "Card baixado. Abra a rede social e escolha a imagem na galeria.",
              );
            }
          }}
        >
          <Download size={17} /> Baixar imagem
        </button>
        <button
          className="text-button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(message);
              setNotice("Mensagem copiada.");
            } catch {
              setNotice("Selecione a mensagem acima para copiar manualmente.");
            }
          }}
        >
          <Copy size={17} /> Copiar texto
        </button>
      </div>
      <details className="context-details">
        <summary>Privacidade</summary>
        <p>
          Somente o card e a mensagem são compartilhados. Seu peso permanece
          privado.
        </p>
      </details>
    </div>
  );
}
