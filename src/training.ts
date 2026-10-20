import {
  bestStreak,
  localDate,
  shiftDate,
  streak,
  validDate,
  type Workout,
} from "./model";

export const MIN_TRAINING_DAYS = 1;
export const MAX_TRAINING_DAYS = 7;
export function validTrainingSelection(days: number[], count: number) {
  return (
    Number.isInteger(count) &&
    count >= MIN_TRAINING_DAYS &&
    count <= MAX_TRAINING_DAYS &&
    days.length === count &&
    new Set(days).size === count &&
    days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)
  );
}
/** Reducing the target keeps the earliest selected weekdays; increasing keeps
 * the current selection and asks the person to explicitly choose the extra days. */
export function resizeTrainingSelection(days: number[], count: number) {
  return [...days].sort((a, b) => a - b).slice(0, count);
}
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
  replacesRevision?: number | null;
};
export type TrainingReschedule = {
  id: string;
  originalDay: string;
  targetDay: string;
  weekStart: string;
  createdAt: string;
  revision: number;
};
export type TrainingState = {
  revision: number;
  timezone: string;
  today: string;
  startedOn: string;
  weeklyExtraLimit: number;
  plans: TrainingPlan[];
  planRequired?: boolean;
  legacyScheduleBefore?: string | null;
  extraRests: string[];
  medicalRests?: string[];
  weeklyRescheduleLimit?: number;
  reschedules?: TrainingReschedule[];
};
export type TrainingDayKind =
  | "unplanned"
  | "training"
  | "scheduled-rest"
  | "extra-rest"
  | "medical-kit";
export type EffectiveDayKind =
  | TrainingDayKind
  | "rescheduled-rest"
  | "compensatory";
export const isTrainingDay = (kind: EffectiveDayKind) =>
  kind === "training" || kind === "compensatory";
export const rescheduleFor = (
  state: TrainingState | null | undefined,
  day: string,
) =>
  state?.reschedules?.find((r) => r.originalDay === day || r.targetDay === day);
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
export function planFor(state: TrainingState | null | undefined, day: string) {
  let selected: TrainingPlan | undefined;
  for (const plan of state?.plans ?? [])
    if (plan.effectiveFrom <= day && (!selected ||
      plan.effectiveFrom > selected.effectiveFrom ||
      (plan.effectiveFrom === selected.effectiveFrom && plan.revision > selected.revision)))
      selected = plan;
  return selected;
}
export function hasTrainingPlan(state: TrainingState | null | undefined) {
  if (!state) return false;
  return state.planRequired === undefined
    ? state.plans.length > 0
    : !state.planRequired;
}
export function trainingDaysFor(
  state: TrainingState | null | undefined,
  day: string,
) {
  const plan = planFor(state, day);
  if (plan) return plan.trainingDays;
  // Old cache DTOs preserve their former implicit history until refreshed.
  if (
    !state ||
    state.legacyScheduleBefore === undefined ||
    (state.legacyScheduleBefore && day < state.legacyScheduleBefore)
  )
    return [1, 2, 3, 4, 5, 6, 7];
  return [];
}
export function trainingDayKind(
  state: TrainingState | null | undefined,
  day: string,
): EffectiveDayKind {
  if (state?.medicalRests?.includes(day)) return "medical-kit";
  if (state?.extraRests.includes(day)) return "extra-rest";
  const moved = rescheduleFor(state, day);
  if (moved)
    return moved.originalDay === day ? "rescheduled-rest" : "compensatory";
  const days = trainingDaysFor(state, day);
  if (!days.length) return "unplanned";
  return days.includes(isoWeekday(day))
    ? "training"
    : "scheduled-rest";
}
export function reschedulesRemaining(state: TrainingState, day: string) {
  return Math.max(
    0,
    (state.weeklyRescheduleLimit ?? 0) -
      (state.reschedules ?? []).filter((r) => r.weekStart === weekStart(day))
        .length,
  );
}
export function plannedTrainingCount(state: TrainingState, day: string) {
  const monday = weekStart(day);
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i)).filter(
    (d) => {
      const moved = rescheduleFor(state, d);
      return moved
        ? moved.targetDay === d
        : trainingDaysFor(state, d).includes(isoWeekday(d));
    },
  ).length;
}
export function weeklyTrainingProgress(
  workouts: Workout[],
  state: TrainingState,
) {
  const monday = weekStart(state.today);
  const goal = Array.from({ length: 7 }, (_, i) => shiftDate(monday, i)).filter(
    (d) => isTrainingDay(trainingDayKind(state, d)),
  ).length;
  const completed = new Set(
    workouts
      .filter(
        (w) =>
          w.date >= monday &&
          w.date <= state.today &&
          isTrainingDay(trainingDayKind(state, w.date)),
      )
      .map((w) => w.date),
  ).size;
  return {
    completed,
    goal,
    remaining: Math.max(0, goal - completed),
    percent: goal ? Math.round((completed / goal) * 100) : 0,
  };
}
export function rescheduleTargets(
  state: TrainingState,
  original: string,
  workouts: Workout[],
) {
  if (
    !state.reschedules ||
    original < state.today ||
    trainingDayKind(state, original) !== "training" ||
    rescheduleFor(state, original) ||
    workouts.some((w) => w.date === original) ||
    !reschedulesRemaining(state, original)
  )
    return [];
  const end = shiftDate(weekStart(original), 7),
    result: string[] = [];
  for (let day = shiftDate(original, 1); day < end; day = shiftDate(day, 1))
    if (
      trainingDayKind(state, day) === "scheduled-rest" &&
      !rescheduleFor(state, day) &&
      !workouts.some((w) => w.date === day)
    )
      result.push(day);
  return result;
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
  today = state?.today ?? localDate(),
) {
  const eligible = workouts.filter((w) => w.date <= today);
  if (
    !state ||
    (!state.plans.length &&
      !state.extraRests.length &&
      !state.medicalRests?.length &&
      !state.reschedules?.length)
  )
    return { current: streak(eligible, today), best: bestStreak(eligible) };
  const dates = [...new Set(eligible.map((w) => w.date))]
    .filter((day) => isTrainingDay(trainingDayKind(state, day)))
    .sort();
  let current = 0,
    best = 0;
  let previous: string | undefined;
  const missedBetween = (start: string, end: string) => {
    for (let day = shiftDate(start, 1); day < end; day = shiftDate(day, 1))
      if (isTrainingDay(trainingDayKind(state, day))) return true;
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
    (value.planRequired !== undefined &&
      typeof value.planRequired !== "boolean") ||
    (value.legacyScheduleBefore !== undefined &&
      value.legacyScheduleBefore !== null &&
      !validDate(value.legacyScheduleBefore)) ||
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
    (value.medicalRests !== undefined &&
      (!Array.isArray(value.medicalRests) ||
        !value.medicalRests.every(validDate))) ||
    (value.weeklyRescheduleLimit !== undefined &&
      (!Number.isInteger(value.weeklyRescheduleLimit) ||
        value.weeklyRescheduleLimit < 0)) ||
    (value.reschedules !== undefined &&
      (!Array.isArray(value.reschedules) ||
        !value.reschedules.every(
          (r) =>
            typeof r.id === "string" &&
            validDate(r.originalDay) &&
            validDate(r.targetDay) &&
            r.targetDay > r.originalDay &&
            r.weekStart === weekStart(r.originalDay) &&
            r.targetDay < shiftDate(r.weekStart, 7) &&
            Number.isFinite(Date.parse(r.createdAt)) &&
            Number.isInteger(r.revision) &&
            r.revision > 0,
        ) ||
        new Set(value.reschedules.flatMap((r) => [r.originalDay, r.targetDay]))
          .size !==
          value.reschedules.length * 2)) ||
    !value.plans.every(
      (p) =>
        (p.replacesRevision == null ||
          (Number.isInteger(p.replacesRevision) &&
            p.replacesRevision > 0 &&
            p.replacesRevision < p.revision)) &&
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
