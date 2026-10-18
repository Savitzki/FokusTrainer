import { shiftDate, validDate } from "./model";
export type Mission = {
  key: string;
  target: number;
  progress: number;
  reward: number;
  claimedAt: string | null;
};
export type Badge = {
  key: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  goal: number;
  earnedAt: string | null;
  historical: boolean | null;
};
export type Cosmetic = {
  id: string;
  name: string;
  category: "frame" | "share" | "theme";
  price: number;
  rarity: string;
  badgeKey: string | null;
  owned: boolean;
  equipped: boolean;
  locked: boolean;
};
export type GameState = {
  economyRevision?: number | null;
  features?: { reports: boolean; challenges: boolean };
  weekly: {
    timezone?: string;
    weekStart: string;
    startsOn?: string;
    policy?: number;
    endsAt: string;
    bonus: number;
    missions: Mission[];
  };
  achievements?: { featured: string[]; visible: boolean; badges: Badge[] };
  cosmetics?: Cosmetic[];
};
export type Challenge = {
  id: string;
  name: string;
  kind: "consistency" | "collective" | "frequency";
  start: string;
  end: string;
  inviteUntil: string;
  target: number;
  closed: boolean;
  cancelled: boolean;
  invited: boolean;
  participants: { id: string | null; nickname: string; accepted: boolean }[];
  board: {
    id: string | null;
    nickname: string;
    completed: number;
    planned: number;
    percent: number | null;
    place: number | null;
  }[];
};
export type ProgressReport = {
  period: "week" | "month";
  start: string;
  end: string;
  today: string;
  timezone: string;
  partial: boolean;
  summary: {
    completed: number;
    planned: number;
    due: number;
    mandatory_completed: number;
    missed: number;
    minutes: number;
    average: number | null;
    compliance: number | null;
  };
  streak: { current: number; best: number };
  days: { day: string; kind: string; completed: boolean; minutes: number }[];
  weeks: {
    week_start: string;
    planned: number;
    completed: number;
    missed: number;
    fulfilled: boolean;
    partial?: boolean;
  }[];
  goals: { weekStart: string; completed: number; total: number }[];
  weights: { id: string; date: string; kg: number; recordedAt: string }[];
};
const natural = (x: unknown) => Number.isSafeInteger(x) && Number(x) >= 0;
export function readGameState(raw: unknown): GameState {
  const s = raw as GameState;
  if (
    !s?.weekly ||
    !validDate(s.weekly.weekStart) ||
    (s.weekly.startsOn !== undefined && (!validDate(s.weekly.startsOn) || s.weekly.startsOn < s.weekly.weekStart || s.weekly.startsOn > shiftDate(s.weekly.weekStart, 6))) ||
    (s.weekly.policy !== undefined && ![1, 2].includes(s.weekly.policy)) ||
    !Number.isFinite(Date.parse(s.weekly.endsAt)) ||
    !natural(s.weekly.bonus) ||
    !Array.isArray(s.weekly.missions) ||
    (s.weekly.policy === 2 && s.weekly.missions.length > 3) ||
    !s.weekly.missions.every(
      (m) =>
        typeof m.key === "string" &&
        natural(m.target) &&
        m.target > 0 &&
        natural(m.progress) &&
        m.progress <= m.target &&
        natural(m.reward) &&
        (m.claimedAt === null || Number.isFinite(Date.parse(m.claimedAt))),
    )
  )
    throw new Error("Não foi possível ler suas missões");
  if (
    s.achievements &&
    (!Array.isArray(s.achievements.featured) ||
      s.achievements.featured.length > 3 ||
      typeof s.achievements.visible !== "boolean" ||
      !Array.isArray(s.achievements.badges) ||
      !s.achievements.badges.every(
        (b) =>
          typeof b.key === "string" &&
          typeof b.name === "string" &&
          (b.earnedAt === null || Number.isFinite(Date.parse(b.earnedAt))),
      ))
  )
    throw new Error("Não foi possível ler suas medalhas");
  if (
    s.cosmetics &&
    (!Array.isArray(s.cosmetics) ||
      !s.cosmetics.every(
        (i) =>
          typeof i.id === "string" &&
          typeof i.name === "string" &&
          ["frame", "share", "theme"].includes(i.category) &&
          natural(i.price) &&
          typeof i.owned === "boolean" &&
          typeof i.locked === "boolean" &&
          typeof i.equipped === "boolean",
      ))
  )
    throw new Error("Não foi possível ler seus itens");
  return s;
}
export function readChallenges(raw: unknown): Challenge[] {
  const rows = raw as Challenge[];
  if (
    !Array.isArray(rows) ||
    !rows.every(
      (c) =>
        typeof c.id === "string" &&
        typeof c.name === "string" &&
        ["consistency", "collective", "frequency"].includes(c.kind) &&
        validDate(c.start) &&
        validDate(c.end) &&
        typeof c.closed === "boolean" &&
        Array.isArray(c.participants) &&
        Array.isArray(c.board) &&
        c.board.every(
          (p) =>
            typeof p.nickname === "string" &&
            natural(p.completed) &&
            natural(p.planned) &&
            (p.place === null || natural(p.place)) &&
            (p.percent === null ||
              (Number.isFinite(p.percent) &&
                p.percent >= 0 &&
                p.percent <= 100)),
        ),
    )
  )
    throw new Error("Não foi possível ler os desafios");
  return rows;
}
export function readProgressReport(raw: unknown): ProgressReport {
  const r = raw as ProgressReport;
  if (
    !r ||
    !["week", "month"].includes(r.period) ||
    !validDate(r.start) ||
    !validDate(r.end) ||
    !validDate(r.today) ||
    !r.summary ||
    !natural(r.summary.completed) ||
    !natural(r.summary.planned) ||
    !natural(r.summary.minutes) ||
    !Array.isArray(r.days) ||
    !Array.isArray(r.weeks) ||
    !Array.isArray(r.weights) ||
    !Array.isArray(r.goals) ||
    !r.streak ||
    !natural(r.streak.current) ||
    !natural(r.streak.best)
  )
    throw new Error("Não foi possível ler seu relatório");
  return r;
}
export const MISSION_NAMES: Record<string, string> = {
  workouts: "Treine no seu ritmo",
  weight: "Peso em dois dias",
  schedule: "Cumpra sua semana",
  consistency: "Mantenha a chama viva",
};
export const DAY_NAMES: Record<string, string> = {
  training: "Treino programado",
  compensatory: "Treino compensatório",
  "scheduled-rest": "Descanso programado",
  "rescheduled-rest": "Descanso por reagendamento",
  "extra-rest": "Descanso extra",
  "medical-kit": "Kit Médico",
};
