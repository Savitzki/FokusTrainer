import { expect, it } from "vitest";
import { dueReminders, freshData, type Workout } from "./model";
import {
  dateInTimezone,
  extraRestsRemaining,
  readTrainingState,
  trainingDayKind,
  trainingDaysFor,
  trainingStreak,
  weeklyTrainingProgress,
  weekStart,
  type TrainingState,
} from "./training";

export const trainingFixture = (
  overrides: Partial<TrainingState> = {},
): TrainingState => ({
  revision: 1,
  timezone: "UTC",
  today: "2026-10-18",
  startedOn: "2026-10-12",
  weeklyExtraLimit: 2,
  plans: [
    { revision: 1, effectiveFrom: "2026-10-12", trainingDays: [1, 3, 5] },
  ],
  extraRests: [],
  ...overrides,
});
const workouts = (...dates: string[]): Workout[] =>
  dates.map((date) => ({ id: date, date, activity: "Corrida", minutes: 30 }));

it("mede a meta semanal sem duplicatas, dias futuros ou outras semanas", () => {
  const state = trainingFixture({
    today: "2026-10-14",
    plans: [
      { revision: 1, effectiveFrom: "2026-10-12", trainingDays: [1, 2, 3, 4, 5] },
    ],
  });
  const entries = workouts(
    "2026-10-09", "2026-10-12", "2026-10-12", "2026-10-13",
    "2026-10-15", "2026-10-19",
  );
  expect(weeklyTrainingProgress(entries, state)).toEqual({
    completed: 2, goal: 5, remaining: 3, percent: 40,
  });
  expect(weeklyTrainingProgress([], state)).toEqual({
    completed: 0, goal: 5, remaining: 5, percent: 0,
  });
});

it("conta a compensação concluída e mantém descansos e proteções sem pontos", () => {
  const state = trainingFixture({
    plans: [
      { revision: 1, effectiveFrom: "2026-10-12", trainingDays: [1, 2, 3, 4, 5] },
    ],
    extraRests: ["2026-10-14"],
    medicalRests: ["2026-10-15"],
    reschedules: [{
      id: "swap", originalDay: "2026-10-13", targetDay: "2026-10-17",
      weekStart: "2026-10-12", createdAt: "2026-10-13T10:00:00Z", revision: 2,
    }],
  });
  const entries = workouts(
    "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15",
    "2026-10-16", "2026-10-17", "2026-10-18",
  );
  expect(weeklyTrainingProgress(entries, state)).toEqual({
    completed: 3, goal: 5, remaining: 2, percent: 60,
  });
});

it("renova na segunda-feira e limita a meta em cronogramas legados", () => {
  const entries = workouts(
    "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15",
    "2026-10-16", "2026-10-17", "2026-10-18",
  );
  const state = trainingFixture({ plans: [] });
  expect(weeklyTrainingProgress(entries, state)).toEqual({
    completed: 5, goal: 5, remaining: 0, percent: 100,
  });
  expect(weeklyTrainingProgress(entries, { ...state, today: "2026-10-19" })).toEqual({
    completed: 0, goal: 5, remaining: 5, percent: 0,
  });
});

it("conta treinos consecutivos atravessando descansos, inclusive até o próximo treino pendente", () => {
  const entries = workouts("2026-10-12", "2026-10-14", "2026-10-16");
  expect(trainingStreak(entries, trainingFixture(), "2026-10-18")).toEqual({
    current: 3,
    best: 3,
  });
  expect(trainingStreak(entries, trainingFixture(), "2026-10-19")).toEqual({
    current: 3,
    best: 3,
  });
  expect(trainingStreak(entries, trainingFixture(), "2026-10-20")).toEqual({
    current: 0,
    best: 3,
  });
});
it("treino voluntário e registros legados duplicados não geram pontos extras em descanso", () => {
  const entries = workouts(
    "2026-10-12",
    "2026-10-13",
    "2026-10-14",
    "2026-10-14",
    "2026-10-18",
  );
  expect(trainingStreak(entries, trainingFixture(), "2026-10-18")).toEqual({
    current: 0,
    best: 2,
  });
  expect(trainingStreak(entries, trainingFixture(), "2026-10-14")).toEqual({
    current: 2,
    best: 2,
  });
});
it("descanso extra protege um dia de treino, mesmo com treino voluntário, sem somar", () => {
  const state = trainingFixture({
    plans: [],
    extraRests: ["2026-10-13", "2026-10-16"],
  });
  const entries = workouts(
    "2026-10-12",
    "2026-10-13",
    "2026-10-14",
    "2026-10-15",
  );
  expect(trainingStreak(entries, state, "2026-10-17")).toEqual({
    current: 3,
    best: 3,
  });
  expect(trainingStreak(entries, state, "2026-10-18")).toEqual({
    current: 0,
    best: 3,
  });
});
it("alterações futuras não reclassificam faltas nem o recorde anterior", () => {
  const state = trainingFixture({
    plans: [{ revision: 1, effectiveFrom: "2026-10-17", trainingDays: [1] }],
  });
  const entries = workouts("2026-10-12", "2026-10-14", "2026-10-16");
  expect(trainingStreak(entries, state, "2026-10-16")).toEqual({
    current: 1,
    best: 1,
  });
  expect(trainingStreak(entries, state, "2026-10-19")).toEqual({
    current: 1,
    best: 1,
  });
  expect(trainingDayKind(state, "2026-10-15")).toBe("training");
});
it("usa a revisão mais recente da programação futura, preservando a de ontem", () => {
  const state = trainingFixture({
    plans: [
      { revision: 1, effectiveFrom: "2026-10-12", trainingDays: [1, 3, 5] },
      { revision: 2, effectiveFrom: "2026-10-19", trainingDays: [2, 4] },
      { revision: 3, effectiveFrom: "2026-10-19", trainingDays: [1, 5] },
    ],
  });
  expect(trainingDaysFor(state, "2026-10-18")).toEqual([1, 3, 5]);
  expect(trainingDaysFor(state, "2026-10-19")).toEqual([1, 5]);
});
it("limita extras de segunda a domingo e renova o saldo na segunda, inclusive na virada do ano", () => {
  const state = trainingFixture({
    extraRests: ["2026-10-11", "2026-10-12", "2026-10-18"],
  });
  expect(extraRestsRemaining(state, "2026-10-18")).toBe(0);
  expect(extraRestsRemaining(state, "2026-10-19")).toBe(2);
  expect(weekStart("2027-01-01")).toBe("2026-12-28");
  expect(
    extraRestsRemaining({ ...state, weeklyExtraLimit: 3 }, "2026-10-18"),
  ).toBe(1);
});
it("mantém o comportamento legado sem programação e não cria ofensiva apenas com descanso", () => {
  expect(
    trainingStreak(workouts("2026-10-12", "2026-10-13"), null, "2026-10-14"),
  ).toEqual({ current: 2, best: 2 });
  expect(trainingStreak([], trainingFixture(), "2026-10-18")).toEqual({
    current: 0,
    best: 0,
  });
  expect(
    trainingStreak(workouts("2026-10-13"), trainingFixture(), "2026-10-13"),
  ).toEqual({ current: 0, best: 0 });
});
it("usa o fuso da programação e bloqueia cache inválido", () => {
  expect(
    dateInTimezone(new Date("2026-10-19T01:00:00Z"), "America/Sao_Paulo"),
  ).toBe("2026-10-18");
  expect(readTrainingState(trainingFixture())).toEqual(trainingFixture());
  expect(() =>
    readTrainingState({
      ...trainingFixture(),
      plans: [
        { effectiveFrom: "2026-10-01", revision: 1, trainingDays: [1, 1] },
      ],
    }),
  ).toThrow();
});
it("não cobra treino durante o descanso, mas mantém o lembrete de peso", () => {
  const data = freshData();
  data.reminders.forEach((r) => {
    r.enabled = true;
    r.time = "00:00";
  });
  expect(
    dueReminders(data, new Date(2026, 9, 18, 19), true).map((r) => r.id),
  ).toEqual(["weight"]);
});
it("kit preserva a ofensiva entre semanas e não soma por treino voluntário ou duplicatas", () => {
  const state = trainingFixture({
    plans: [],
    extraRests: ["2026-10-18"],
    medicalRests: ["2026-10-17", "2026-10-19"],
  });
  const entries = workouts(
    "2026-10-16",
    "2026-10-17",
    "2026-10-19",
    "2026-10-19",
    "2026-10-20",
  );
  expect(trainingDayKind(state, "2026-10-19")).toBe("medical-kit");
  expect(trainingStreak(entries, state, "2026-10-20")).toEqual({
    current: 2,
    best: 2,
  });
  expect(trainingStreak(entries, state, "2026-10-22")).toEqual({
    current: 0,
    best: 2,
  });
});
it("nova programação não remove a proteção passada do kit nem reescreve faltas", () => {
  const state = trainingFixture({
    medicalRests: ["2026-10-15"],
    plans: [
      {
        revision: 2,
        effectiveFrom: "2026-10-17",
        trainingDays: [1, 2, 3, 4, 5],
      },
    ],
  });
  const entries = workouts("2026-10-14", "2026-10-16", "2026-10-19");
  expect(trainingStreak(entries, state, "2026-10-19")).toEqual({
    current: 3,
    best: 3,
  });
  expect(trainingDayKind(state, "2026-10-13")).toBe("training");
  expect(() =>
    readTrainingState({ ...state, medicalRests: ["invalid"] }),
  ).toThrow();
});
