import type { MascotPose } from "./capiboraVoice";
import catalog from "./arenaTauntCatalog.json";
type TauntPhrase = {
  id: string;
  text: string;
  pose: MascotPose;
  replyOnly?: boolean;
};
/** Closed social catalog; no claims about workout completion, ranking or appearance. */
export const ARENA_MESSAGES = catalog as TauntPhrase[];
export const ARENA_TAUNTS = ARENA_MESSAGES.filter((m) => !m.replyOnly);
export type ArenaMessage = {
  id: string;
  sender: string;
  nickname: string;
  messageId: string;
  text: string;
  pose: MascotPose;
  createdAt: string;
  seen: boolean;
  replyTo?: string | null;
  canReply?: boolean;
};
export type ArenaInbox = {
  version?: number;
  muted: boolean;
  push: boolean;
  messages: ArenaMessage[];
};
export function readArenaInbox(value: unknown): ArenaInbox {
  const data = value as ArenaInbox;
  if (
    !data ||
    typeof data.muted !== "boolean" ||
    typeof data.push !== "boolean" ||
    (data.version !== undefined && data.version !== 2) ||
    !Array.isArray(data.messages) ||
    data.messages.length > 20 ||
    !data.messages.every(
      (m) =>
        m &&
        typeof m.id === "string" &&
        typeof m.sender === "string" &&
        typeof m.nickname === "string" &&
        Number.isFinite(Date.parse(m.createdAt)) &&
        typeof m.seen === "boolean" &&
        (m.replyTo === undefined ||
          m.replyTo === null ||
          typeof m.replyTo === "string") &&
        (m.canReply === undefined || typeof m.canReply === "boolean") &&
        !(m.replyTo && m.canReply) &&
        ARENA_MESSAGES.some(
          (t) =>
            t.id === m.messageId &&
            t.text === m.text &&
            t.pose === m.pose &&
            (data.version !== 2 || Boolean(t.replyOnly) === Boolean(m.replyTo)),
        ),
    )
  )
    throw new Error("Não foi possível atualizar as provocações");
  return data;
}
