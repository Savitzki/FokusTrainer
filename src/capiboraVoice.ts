import {
  CAPIBORA_PHRASES as SHARED_PHRASES,
  CAPIBORA_NOTIFICATIONS,
  selectCapiboraPhrase as selectSharedPhrase,
  type MascotPose as SharedPose,
  type VoiceContext,
  type VoiceFacts,
} from "../supabase/functions/_shared/capibora";
import editorial from "./capiboraEditorial.json";

// Frontend presentation only. Shared server copy and selection contracts stay untouched.
export {
  CAPIBORA_NOTIFICATIONS,
  selectCapiboraNotification,
  dayPeriod,
} from "../supabase/functions/_shared/capibora";
export type {
  NotificationSelection,
  MessageCategory,
  HumorIntensity,
  VoiceContext,
  VoiceFacts,
} from "../supabase/functions/_shared/capibora";
export type MascotPose = SharedPose | "excited" | "smug" | "bored" | "dramatic";
export type CapiboraMessage = {
  title: string;
  body: string;
  expression: MascotPose;
};
type CopyId = keyof typeof editorial;
function copy(id: CopyId): CapiboraMessage {
  const item = editorial[id];
  return {
    title: item.title,
    body: item.body,
    expression: item.pose as MascotPose,
  };
}
export const CAPIBORA_PHRASES = SHARED_PHRASES.map((p) => ({
  ...p,
  ...copy(p.id as CopyId),
}));
const byId = new Map(CAPIBORA_PHRASES.map((p) => [p.id, p]));
export const CAPIBORA_MESSAGES = [
  ...CAPIBORA_PHRASES,
  ...CAPIBORA_NOTIFICATIONS,
];
export function capiboraMessage(id: CopyId): CapiboraMessage {
  return copy(id);
}
export function composeCapiboraMessage(
  message: Pick<CapiboraMessage, "title" | "body">,
): string {
  return [message.title, message.body].filter(Boolean).join(" ");
}
export function selectCapiboraPhrase(
  context: VoiceContext,
  seed = 0,
  facts: VoiceFacts = {},
  previousId?: string,
) {
  const selected = selectSharedPhrase(context, seed, facts, previousId);
  return selected ? byId.get(selected.id) : undefined;
}
export const phraseText = (
  context: VoiceContext,
  seed = 0,
  facts: VoiceFacts = {},
) => {
  const selected = selectCapiboraPhrase(context, seed, facts);
  return selected ? composeCapiboraMessage(selected) : "";
};
