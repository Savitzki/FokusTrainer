import { useRef, useState } from "react";
import { MoreHorizontal, MessageCircle, Swords, Settings } from "lucide-react";
import Modal from "./Modal";
import ArenaTauntPreferences from "./ArenaTauntPreferences";
import Mascot from "./Mascot";
import { ARENA_TAUNTS } from "./arenaTaunts";
import type { SocialState, useSocial } from "./social";
export default function FriendOptions({
  friend,
  userId,
  busy,
  act,
  onChallenge,
  interactions = false,
  error,
}: {
  friend: SocialState["friends"][number];
  userId?: string;
  busy: boolean;
  act: ReturnType<typeof useSocial>["act"];
  onChallenge?: () => void;
  interactions?: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState<"menu" | "remove" | "taunt" | "preferences">(
      "menu",
    ),
    [taunt, setTaunt] = useState(ARENA_TAUNTS[0]);
  const request = useRef(""),
    sending = useRef(false);
  return (
    <>
      <button
        className="icon-button"
        aria-label={`Opções de ${friend.nickname}`}
        onClick={() => {
          setMode("menu");
          setOpen(true);
          request.current = crypto.randomUUID();
        }}
      >
        <MoreHorizontal size={19} />
      </button>
      {open && (
        <Modal
          compactHeader
          centered
          title={`@${friend.nickname}`}
          closeDisabled={busy}
          onClose={() => setOpen(false)}
        >
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {mode === "preferences" && userId ? (
            <ArenaTauntPreferences userId={userId} />
          ) : mode === "remove" ? (
            <>
              <p>Remover amizade com {friend.nickname}?</p>
              <p className="field-hint">
                Desafios 1 contra 1 em aberto serão cancelados, sem vencedor.
                Grupos e resultados anteriores permanecem.
              </p>
              <div className="form-actions">
                <button
                  className="outline-button"
                  disabled={busy}
                  onClick={() => setMode("menu")}
                >
                  Voltar
                </button>
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={async () => {
                    if (sending.current) return;
                    sending.current = true;
                    try {
                      if (
                        await act("remove_friend", {
                          p_user: friend.id,
                          p_request: request.current,
                        })
                      )
                        setOpen(false);
                    } finally {
                      sending.current = false;
                    }
                  }}
                >
                  Remover amizade
                </button>
              </div>
            </>
          ) : mode === "taunt" ? (
            <>
              <Mascot pose={taunt.pose} size={100} />
              <div
                className="arena-taunt-picker"
                role="group"
                aria-label="Escolher provocação"
              >
                {ARENA_TAUNTS.map((t) => (
                  <button
                    className="outline-button"
                    key={t.id}
                    aria-pressed={t.id === taunt.id}
                    onClick={() => setTaunt(t)}
                  >
                    {t.text}
                  </button>
                ))}
              </div>
              <p className="field-hint">Até três por pessoa, por dia</p>
              <div className="form-actions">
                <button
                  className="outline-button"
                  disabled={busy}
                  onClick={() => setMode("menu")}
                >
                  Voltar
                </button>
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={async () => {
                    if (sending.current) return;
                    sending.current = true;
                    try {
                      if (
                        await act("send_arena_taunt", {
                          p_user: friend.id,
                          p_message: taunt.id,
                          p_request: request.current,
                        })
                      )
                        setOpen(false);
                    } finally {
                      sending.current = false;
                    }
                  }}
                >
                  Enviar provocação
                </button>
              </div>
            </>
          ) : (
            <div className="arena-action-list">
              {onChallenge && (
                <button
                  className="outline-button"
                  onClick={() => {
                    setOpen(false);
                    onChallenge();
                  }}
                >
                  <Swords size={16} /> Desafiar
                </button>
              )}
              {interactions && (
                <button
                  className="outline-button"
                  onClick={() => setMode("taunt")}
                >
                  <MessageCircle size={16} /> Provocar
                </button>
              )}
              {interactions && userId && (
                <button
                  className="outline-button"
                  onClick={() => setMode("preferences")}
                >
                  <Settings size={16} /> Preferências de provocações
                </button>
              )}
              <button
                className="text-button danger-action"
                onClick={() => setMode("remove")}
              >
                Remover amizade
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
