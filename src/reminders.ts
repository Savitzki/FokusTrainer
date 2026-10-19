import { backendRpc } from "./backend";
import { selectCapiboraNotification } from "./capiboraVoice";
import type { Reminder } from "./model";

export type LocalReminderClaim = {
  day: string;
  hour: number;
  minute: number;
  selectionKey: string;
  timezone: string;
};
/** Server claim verifies today, rest/protection/session/workout and cross-channel dedup. */
export async function claimReminder(reminder: Reminder, timezone: string) {
  const claim = await backendRpc<LocalReminderClaim | null>(
    "claim_local_reminder",
    {
      p_kind: reminder.id,
      p_time: reminder.time,
      p_timezone: timezone,
    },
  );
  if (!claim) return null;
  const copy = selectCapiboraNotification({
    category:
      reminder.id === "workout" ? "workout_reminder" : "weight_reminder",
    ...claim,
    tone: "gentle",
    facts:
      reminder.id === "workout" ? { pending: true } : { weightPending: true },
  });
  return copy
    ? {
        ...copy,
        day: claim.day,
        tag: `fokus-${claim.day}-${reminder.id === "workout" ? "reminder" : "weight"}`,
      }
    : null;
}
