import { validateProfile, type Profile } from "./profile";
export type Workout = {
  id: string;
  date: string;
  activity: string;
  minutes: number;
  recordedAt?: string;
  confirmedAt?: string;
};
export type Weight = { date: string; kg: number };
export type Reminder = {
  id: "workout" | "weight";
  time: string;
  enabled: boolean;
  lastSent: string | null;
};
export type Data = {
  version: 1;
  profile: Profile | null;
  workouts: Workout[];
  weights: Weight[];
  reminders: Reminder[];
};
export const STORAGE_KEY = "fokus-trainer:v1";
export const freshData = (): Data => ({
  version: 1,
  profile: null,
  workouts: [],
  weights: [],
  reminders: [
    { id: "workout", time: "18:00", enabled: false, lastSent: null },
    { id: "weight", time: "08:00", enabled: false, lastSent: null },
  ],
});
export function localDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function shiftDate(day: string, delta: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
export function streak(workouts: Workout[], today = localDate()): number {
  const dates = new Set(workouts.map((w) => w.date));
  let day = dates.has(today) ? today : shiftDate(today, -1);
  let count = 0;
  while (dates.has(day)) {
    count++;
    day = shiftDate(day, -1);
  }
  return count;
}
export function bestStreak(workouts: Workout[]): number {
  const dates = [...new Set(workouts.map((w) => w.date))].sort();
  let best = 0,
    current = 0;
  dates.forEach((date, index) => {
    current =
      index > 0 && shiftDate(dates[index - 1], 1) === date ? current + 1 : 1;
    best = Math.max(best, current);
  });
  return best;
}
// Daily confirmations are append-only. Missed days cannot be filled later.
export function confirmWorkout(
  data: Data,
  workout: Workout,
  today = localDate(),
): Data {
  if (workout.date !== today)
    throw new Error("Só é possível confirmar o treino de hoje.");
  if (data.workouts.some((entry) => entry.date === today))
    throw new Error(
      "O treino de hoje já foi confirmado e não pode ser alterado.",
    );
  if (
    !workout.activity.trim() ||
    !Number.isInteger(workout.minutes) ||
    workout.minutes < 1 ||
    workout.minutes > 1440
  )
    throw new Error("Informe uma atividade e uma duração válida.");
  return {
    ...data,
    workouts: [
      ...data.workouts,
      {
        ...workout,
        recordedAt: workout.recordedAt ?? new Date().toISOString(),
      },
    ],
  };
}
export function dueReminders(
  data: Data,
  now = new Date(),
  resting = false,
  day = localDate(now),
): Reminder[] {
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return data.reminders.filter(
    (r) =>
      r.enabled &&
      !(resting && r.id === "workout") &&
      r.time <= time &&
      r.lastSent !== day &&
      !(r.id === "workout" ? data.workouts : data.weights).some(
        (entry) => entry.date === day,
      ),
  );
}
export function parseData(raw: string): Data {
  const d = JSON.parse(raw);
  if (
    d?.version !== 1 ||
    !Array.isArray(d.workouts) ||
    !Array.isArray(d.weights) ||
    !Array.isArray(d.reminders)
  )
    throw new Error("Formato de dados inválido");
  if (
    !d.workouts.every(
      (w: Workout) =>
        typeof w.id === "string" &&
        validDate(w.date) &&
        typeof w.activity === "string" &&
        w.activity.length > 0 &&
        Number.isInteger(w.minutes) &&
        w.minutes >= 1 &&
        w.minutes <= 1440 &&
        [w.recordedAt, w.confirmedAt].every(
          (t) =>
            t === undefined ||
            (typeof t === "string" && Number.isFinite(Date.parse(t))),
        ),
    )
  )
    throw new Error("Treinos inválidos");
  if (
    !d.weights.every(
      (w: Weight) =>
        validDate(w.date) && Number.isFinite(w.kg) && w.kg >= 20 && w.kg <= 500,
    )
  )
    throw new Error("Pesos inválidos");
  if (
    d.reminders.length !== 2 ||
    new Set(d.reminders.map((r: Reminder) => r.id)).size !== 2 ||
    !d.reminders.every(
      (r: Reminder) =>
        ["workout", "weight"].includes(r.id) &&
        typeof r.enabled === "boolean" &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(r.time) &&
        (r.lastSent === null || validDate(r.lastSent)),
    )
  )
    throw new Error("Lembretes inválidos");
  return {
    ...d,
    profile: d.profile == null ? null : validateProfile(d.profile),
  } as Data;
}
export const formatDay = (
  day: string,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" },
) => new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", options);
export const formatKg = (kg: number) =>
  kg.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
