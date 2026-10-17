import {
  bestStreak,
  localDate,
  shiftDate,
  streak,
  validDate,
  type Workout,
} from "./model";

export const WEEKDAYS = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];
export type TrainingPlan = {
  revision: number;
  effectiveFrom: string;
  trainingDays: number[];
};
export type TrainingState = {
  revision: number;
  timezone: string;
  today: string;
  startedOn: string;
  weeklyExtraLimit: number;
  plans: TrainingPlan[];
  extraRests: string[];
};
export type TrainingDayKind = "training" | "scheduled-rest" | "extra-rest";
export function isoWeekday(day: string) {
  return new Date(`${day}T12:00:00Z`).getUTCDay() || 7;
}
export function weekStart(day: string) {
  return shiftDate(day, 1 - isoWeekday(day));
}
export function dateInTimezone(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function trainingDaysFor(
  state: TrainingState | null | undefined,
  day: string,
) {
  const plan = state?.plans
    .filter((p) => p.effectiveFrom <= day)
    .sort(
      (a, b) =>
        b.effectiveFrom.localeCompare(a.effectiveFrom) ||
        b.revision - a.revision,
    )[0];
  return plan?.trainingDays ?? [1, 2, 3, 4, 5, 6, 7];
}
export function trainingDayKind(
  state: TrainingState | null | undefined,
  day: string,
): TrainingDayKind {
  if (state?.extraRests.includes(day)) return "extra-rest";
  return trainingDaysFor(state, day).includes(isoWeekday(day))
    ? "training"
    : "scheduled-rest";
}
export function extraRestsRemaining(state: TrainingState, today: string) {
  const monday = weekStart(today),
    next = shiftDate(monday, 7);
  return Math.max(
    0,
    state.weeklyExtraLimit -
      state.extraRests.filter((d) => d >= monday && d < next).length,
  );
}
export function trainingStreak(
  workouts: Workout[],
  state: TrainingState | null | undefined,
  today = localDate(),
) {
  const eligible = workouts.filter((w) => w.date <= today);
  if (!state || (!state.plans.length && !state.extraRests.length))
    return { current: streak(eligible, today), best: bestStreak(eligible) };
  const dates = [...new Set(eligible.map((w) => w.date))]
    .filter((day) => trainingDayKind(state, day) === "training")
    .sort();
  let current = 0,
    best = 0;
  let previous: string | undefined;
  const missedBetween = (start: string, end: string) => {
    for (let day = shiftDate(start, 1); day < end; day = shiftDate(day, 1))
      if (trainingDayKind(state, day) === "training") return true;
    return false;
  };
  for (const day of dates) {
    if (previous && missedBetween(previous, day)) current = 0;
    current++;
    best = Math.max(best, current);
    previous = day;
  }
  if (previous && missedBetween(previous, today)) current = 0;
  return { current, best };
}
export function readTrainingState(raw: unknown): TrainingState {
  const value = raw as TrainingState;
  if (
    !value ||
    !Number.isInteger(value.revision) ||
    value.revision < 0 ||
    !validDate(value.today) ||
    !validDate(value.startedOn) ||
    typeof value.timezone !== "string" ||
    !Number.isInteger(value.weeklyExtraLimit) ||
    value.weeklyExtraLimit < 0 ||
    !Array.isArray(value.plans) ||
    !Array.isArray(value.extraRests) ||
    !value.extraRests.every(validDate) ||
    !value.plans.every(
      (p) =>
        validDate(p.effectiveFrom) &&
        Number.isInteger(p.revision) &&
        Array.isArray(p.trainingDays) &&
        p.trainingDays.length >= 1 &&
        p.trainingDays.length <= 7 &&
        new Set(p.trainingDays).size === p.trainingDays.length &&
        p.trainingDays.every((d) => Number.isInteger(d) && d >= 1 && d <= 7),
    )
  )
    throw new Error("Não foi possível ler sua programação de treinos");
  dateInTimezone(new Date(), value.timezone);
  return value;
}
