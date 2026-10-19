import { accountConfigured, backendRpc } from "./backend";
import { STORAGE_KEY, validDate } from "./model";
import { deviceTimezone } from "./social";
import type { EffectiveDayKind } from "./training";
import { useSyncedResource } from "./useSyncedResource";
export type TrainingCalendarDay = {
  day: string;
  kind: EffectiveDayKind;
  completed: boolean;
  active: boolean;
  streak: number;
};
export type TrainingCalendarMonth = {
  month: string;
  today: string;
  timezone: string;
  revision: number;
  days: TrainingCalendarDay[];
};
const kinds = [
  "unplanned",
  "training",
  "compensatory",
  "scheduled-rest",
  "rescheduled-rest",
  "extra-rest",
  "medical-kit",
];
export function readTrainingCalendar(value: unknown): TrainingCalendarMonth {
  const v = value as TrainingCalendarMonth;
  if (
    !v ||
    !/^\d{4}-\d{2}$/.test(v.month) ||
    !validDate(`${v.month}-01`) ||
    !validDate(v.today) ||
    typeof v.timezone !== "string" ||
    !Number.isInteger(v.revision) ||
    v.revision < 0 ||
    !Array.isArray(v.days) ||
    !v.days.every(
      (d) =>
        validDate(d.day) &&
        d.day.startsWith(v.month) &&
        kinds.includes(d.kind) &&
        typeof d.completed === "boolean" &&
        typeof d.active === "boolean" &&
        Number.isInteger(d.streak) &&
        d.streak >= 0 &&
        (!d.active ||
          (d.day <= v.today && d.streak > 0 && d.kind !== "unplanned")),
    ) ||
    new Set(v.days.map((d) => d.day)).size !== v.days.length ||
    v.days.length !==
      new Date(
        Date.UTC(Number(v.month.slice(0, 4)), Number(v.month.slice(5)), 0),
      ).getUTCDate()
  )
    throw new Error("Não foi possível consultar a ofensiva deste mês");
  new Intl.DateTimeFormat("en", { timeZone: v.timezone }).format(new Date());
  return v;
}
export function useTrainingCalendar(
  userId: string | null,
  enabled: boolean,
  month: string,
  timezone: string,
) {
  return useSyncedResource({
    userId,
    resource: "calendar",
    queryKey: `calendar:${month}`,
    enabled: Boolean(accountConfigured && userId && enabled),
    cacheKey: userId
      ? `${STORAGE_KEY}:account:${userId}:calendar:${month}`
      : undefined,
    parse: readTrainingCalendar,
    accept: (next, old) => next.revision >= old.revision,
    read: () =>
      backendRpc("get_training_calendar", {
        p_month: `${month}-01`,
        p_timezone: timezone || deviceTimezone(),
      }),
  });
}
