import { useEffect, useRef, useState } from "react";
import { Check, Copy, Search, UserPlus } from "lucide-react";
import Initials from "./ArenaAvatar";
import { backendRpc } from "./backend";
import { isNickname } from "./nickname";
import { normalizeNickname } from "./profile";
import type { useSocial } from "./social";
type FriendMatch = {
  id: string;
  nickname: string;
  relationship: "self" | "friend" | "incoming" | "outgoing" | "none";
  requestId: string | null;
};
export default function AddFriend({
  social,
  onCopyCode,
  onDone,
}: {
  social: ReturnType<typeof useSocial>;
  onCopyCode: () => Promise<boolean>;
  onDone: (message: string) => void;
}) {
  const [nick, setNick] = useState(""),
    [found, setFound] = useState<FriendMatch | null>(null),
    [busy, setBusy] = useState(false),
    [searched, setSearched] = useState(false),
    [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  const pending = useRef<number | null>(null);
  const sequence = useRef(0);
  const validCode = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(code);
  useEffect(
    () => () => {
      sequence.current++;
    },
    [],
  );
  return (
    <form
      className="social-form add-friend-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (
          pending.current === sequence.current ||
          busy ||
          social.busy ||
          (code ? !validCode : !isNickname(nick))
        )
          return;
        const version = ++sequence.current;
        pending.current = version;
        setBusy(true);
        setError("");
        setFound(null);
        setSearched(false);
        try {
          const result = await backendRpc<FriendMatch | null>(
            code ? "find_friend_by_code" : "find_friend_by_nickname",
            code ? { p_code: code } : { p_nickname: normalizeNickname(nick) },
          );
          if (version !== sequence.current) return;
          if (
            result &&
            (typeof result.id !== "string" ||
              typeof result.nickname !== "string" ||
              !["self", "friend", "incoming", "outgoing", "none"].includes(
                result.relationship,
              ))
          )
            throw new Error("Não foi possível conferir esse nick");
          setFound(result);
          setSearched(true);
        } catch (failure) {
          if (version === sequence.current)
            setError(
              failure instanceof Error
                ? failure.message
                : "Não foi possível buscar esse nick",
            );
        } finally {
          if (pending.current === version) pending.current = null;
          if (version === sequence.current) setBusy(false);
        }
      }}
    >
      <p>Adicione amigos pelo nome de usuario ou pelo código de amigo.</p>
      <label htmlFor="friend-nickname">Nome de usuario</label>
      <div className="friend-search-entry">
        <input
          id="friend-nickname"
          type="search"
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={24}
          value={nick}
          disabled={Boolean(code) || social.busy}
          onChange={(event) => {
            sequence.current++;
            setBusy(false);
            setNick(event.target.value);
            setFound(null);
            setSearched(false);
            setError("");
          }}
        />
        <button
          className="outline-button"
          aria-label="Buscar por nome de usuario"
          disabled={busy || social.busy || Boolean(code) || !isNickname(nick)}
        >
          <Search size={19} aria-hidden="true" />
        </button>
      </div>
      <label htmlFor="friend-code">Código de amigo</label>
      <div className="friend-search-entry">
        <input
          id="friend-code"
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={200}
          value={code}
          disabled={Boolean(nick) || social.busy}
          onChange={(event) => {
            sequence.current++;
            setBusy(false);
            const text = event.target.value;
            setCode(
              text.match(
                /[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}/,
              )?.[0] ?? text.trim(),
            );
            setFound(null);
            setSearched(false);
            setError("");
          }}
        />
        <button
          className="outline-button"
          aria-label="Buscar por código de amigo"
          disabled={busy || social.busy || Boolean(nick) || !validCode}
        >
          <Search size={19} aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        className="outline-button"
        onClick={async () => setManualCopy(!(await onCopyCode()))}
      >
        <Copy size={17} aria-hidden="true" /> Copiar meu código
      </button>
      {manualCopy && (
        <input
          aria-label="Seu código de amigo"
          value={social.state?.code ?? ""}
          readOnly
          onFocus={(event) => event.target.select()}
        />
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {searched && !found && (
        <p className="field-hint" role="status">
          Não encontrei esse nick. Confira o @ completo
        </p>
      )}
      {found && (
        <div className="friend-search-result">
          <div className="friend-row">
            <Initials name={found.nickname} />
            <strong>@{found.nickname}</strong>
          </div>
          {found.relationship === "none" ? (
            <button
              type="button"
              className="primary-button"
              disabled={social.busy}
              onClick={async () => {
                if (
                  await social.act(
                    code
                      ? "send_friend_request"
                      : "send_friend_request_by_nickname",
                    code ? { p_code: code } : { p_nickname: found.nickname },
                  )
                )
                  onDone("Pedido enviado. Agora é só aguardar o aceite");
              }}
            >
              <UserPlus size={17} />
              Enviar pedido
            </button>
          ) : found.relationship === "incoming" && found.requestId ? (
            <button
              type="button"
              className="primary-button"
              disabled={social.busy}
              onClick={async () => {
                if (
                  await social.act("reply_friend_request", {
                    p_id: found.requestId,
                    p_accept: true,
                  })
                )
                  onDone("Amizade aceita. Já podem criar uma Arena");
              }}
            >
              <Check size={17} />
              Aceitar pedido
            </button>
          ) : (
            <p className="field-hint" role="status">
              {found.relationship === "self"
                ? "Esse é o seu nick"
                : found.relationship === "friend"
                  ? "Vocês já são amigos"
                  : "Pedido enviado · aguardando aceite"}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
