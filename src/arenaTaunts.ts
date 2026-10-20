import type { MascotPose } from "./capiboraVoice";
/** Approved, context-neutral social lines. Never pretend to know a friend's workout. */
export const ARENA_TAUNTS: { id: string; text: string; pose: MascotPose }[] = [
  { id: "doubt", text: "Duvido", pose: "suspicious" },
  { id: "watching", text: "Quero só ver...", pose: "judging" },
  { id: "sure", text: "Sei...", pose: "judging" },
];
export type ArenaInbox = {
  muted: boolean;
  push: boolean;
  messages: {
    id: string;
    sender: string;
    nickname: string;
    messageId: string;
    text: string;
    pose: MascotPose;
    createdAt: string;
    seen: boolean;
  }[];
};
export function readArenaInbox(value: unknown): ArenaInbox {
  const data = value as ArenaInbox;
  if (
    !data ||
    typeof data.muted !== "boolean" ||
    typeof data.push !== "boolean" ||
    !Array.isArray(data.messages) ||
    data.messages.length > 20 ||
    !data.messages.every(
      (m) =>
        typeof m.id === "string" &&
        typeof m.nickname === "string" &&
        Number.isFinite(Date.parse(m.createdAt)) &&
        typeof m.seen === "boolean" &&
        ARENA_TAUNTS.some(
          (t) => t.id === m.messageId && t.text === m.text && t.pose === m.pose,
        ),
    )
  )
    throw new Error("Não foi possível atualizar as provocações");
  return data;
}
