import { expect, it } from "vitest";
import { dueReminders, freshData, type Workout } from "./model";
import {
  extraRestsRemaining,
  isTrainingDay,
  plannedTrainingCount,
  readTrainingState,
  rescheduleTargets,
  reschedulesRemaining,
  trainingDayKind,
  trainingDaysFor,
  trainingStreak,
  type TrainingState,
} from "./training";
export const fixture = (
  overrides: Partial<TrainingState> = {},
): TrainingState => ({
  revision: 1,
  timezone: "UTC",
  today: "2026-10-20",
  startedOn: "2026-10-12",
  weeklyExtraLimit: 2,
  weeklyRescheduleLimit: 2,
  plans: [
    { revision: 1, effectiveFrom: "2026-10-12", trainingDays: [1, 2, 3, 5, 6] },
  ],
  extraRests: [],
  medicalRests: [],
  reschedules: [],
  ...overrides,
});
const swap = {
  id: "swap1",
  originalDay: "2026-10-20",
  targetDay: "2026-10-22",
  weekStart: "2026-10-19",
  createdAt: "2026-10-20T12:00:00Z",
  revision: 2,
};
const entries = (...days: string[]): Workout[] =>
  days.map((date, i) => ({
    id: String(i),
    date,
    activity: "Corrida",
    minutes: 30,
  }));
it("oferece somente descansos posteriores na mesma semana, sem datas ocupadas nem proteções", () => {
  expect(rescheduleTargets(fixture(), "2026-10-20", [])).toEqual([
    "2026-10-22",
    "2026-10-25",
  ]);
  expect(rescheduleTargets(fixture(), "2026-10-19", [])).toEqual([]);
  expect(
    rescheduleTargets(fixture(), "2026-10-20", entries("2026-10-20")),
  ).toEqual([]);
  expect(
    rescheduleTargets(fixture(), "2026-10-20", entries("2026-10-22")),
  ).toEqual(["2026-10-25"]);
  expect(
    rescheduleTargets(
      fixture({ extraRests: ["2026-10-22"], medicalRests: ["2026-10-25"] }),
      "2026-10-20",
      [],
    ),
  ).toEqual([]);
  expect(rescheduleTargets(fixture(), "2026-10-25", [])).toEqual([]);
});
it("troca papéis sem mudar o plano permanente ou a quantidade de cinco treinos", () => {
  const s = fixture({ reschedules: [swap] });
  expect(trainingDayKind(s, swap.originalDay)).toBe("rescheduled-rest");
  expect(trainingDayKind(s, swap.targetDay)).toBe("compensatory");
  expect(plannedTrainingCount(s, swap.originalDay)).toBe(5);
  expect(trainingDaysFor(s, "2026-10-29")).toEqual([1, 2, 3, 5, 6]);
  expect(trainingDayKind(s, "2026-10-29")).toBe("scheduled-rest");
  expect(rescheduleTargets(s, swap.originalDay, [])).toEqual([]);
  expect(rescheduleTargets(s, swap.targetDay, [])).toEqual([]);
  expect(rescheduleTargets(s, "2026-10-21", [])).toEqual(["2026-10-25"]);
});
it("a segunda troca esgota o limite independente de extras, renovado na segunda-feira", () => {
  const s = fixture({
    reschedules: [
      swap,
      {
        ...swap,
        id: "swap2",
        originalDay: "2026-10-23",
        targetDay: "2026-10-25",
        revision: 3,
      },
    ],
    extraRests: ["2026-10-21"],
  });
  expect(reschedulesRemaining(s, "2026-10-24")).toBe(0);
  expect(rescheduleTargets(s, "2026-10-24", [])).toEqual([]);
  expect(reschedulesRemaining(s, "2026-10-26")).toBe(2);
  expect(extraRestsRemaining(s, "2026-10-24")).toBe(1);
});
it("conclusão compensatória soma uma vez e descanso transferido não soma nem interrompe", () => {
  const s = fixture({ reschedules: [swap] }),
    w = entries(
      "2026-10-19",
      "2026-10-20",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
    );
  expect(trainingStreak(w, s, "2026-10-25")).toEqual({ current: 5, best: 5 });
  expect(trainingStreak(w, s, "2026-10-26")).toEqual({ current: 5, best: 5 });
  expect(
    trainingStreak([...w, ...entries("2026-10-26")], s, "2026-10-27"),
  ).toEqual({ current: 6, best: 6 });
});
it("falta na compensação quebra a sequência depois de encerrar o dia", () => {
  const s = fixture({ reschedules: [swap] }),
    w = entries("2026-10-19", "2026-10-21");
  expect(trainingStreak(w, s, "2026-10-22")).toEqual({ current: 2, best: 2 });
  expect(trainingStreak(w, s, "2026-10-23")).toEqual({ current: 0, best: 2 });
  expect(
    trainingStreak([...w, ...entries("2026-10-23")], s, "2026-10-23"),
  ).toEqual({ current: 1, best: 2 });
});
it.each(["extraRests", "medicalRests"] as const)(
  "proteção %s na compensação mantém, sem somar nem duplicar benefícios",
  (key) => {
    const s = fixture({ reschedules: [swap], [key]: ["2026-10-22"] });
    expect(isTrainingDay(trainingDayKind(s, "2026-10-22"))).toBe(false);
    expect(
      trainingStreak(
        entries("2026-10-19", "2026-10-21", "2026-10-22", "2026-10-23"),
        s,
        "2026-10-23",
      ),
    ).toEqual({ current: 3, best: 3 });
  },
);
it("mantém lembretes de peso e cobra só o dia obrigatório efetivo, sem repetir o dia marcado", () => {
  const s = fixture({ reschedules: [swap] }),
    data = freshData();
  data.reminders.forEach((r) => {
    r.enabled = true;
    r.time = "00:00";
  });
  const clock = new Date(2026, 9, 20, 18);
  expect(
    dueReminders(
      data,
      clock,
      !isTrainingDay(trainingDayKind(s, "2026-10-20")),
      "2026-10-20",
    ).map((r) => r.id),
  ).toEqual(["weight"]);
  expect(
    dueReminders(
      data,
      clock,
      !isTrainingDay(trainingDayKind(s, "2026-10-22")),
      "2026-10-22",
    ).map((r) => r.id),
  ).toEqual(["workout", "weight"]);
  data.reminders.forEach((r) => (r.lastSent = "2026-10-22"));
  expect(dueReminders(data, clock, false, "2026-10-22")).toEqual([]);
});
it("aceita cache antigo sem capacidades novas e recusa trocas corrompidas ou encadeadas", () => {
  const legacy = {
    ...fixture(),
    reschedules: undefined,
    weeklyRescheduleLimit: undefined,
  };
  expect(readTrainingState(legacy)).toEqual(legacy);
  expect(rescheduleTargets(legacy, "2026-10-20", [])).toEqual([]);
  expect(() =>
    readTrainingState(
      fixture({ reschedules: [{ ...swap, targetDay: "2026-10-26" }] }),
    ),
  ).toThrow();
  expect(() =>
    readTrainingState(
      fixture({
        reschedules: [
          swap,
          {
            ...swap,
            id: "bad",
            originalDay: "2026-10-22",
            targetDay: "2026-10-25",
          },
        ],
      }),
    ),
  ).toThrow();
  expect(trainingDayKind(fixture({ reschedules: [swap] }), "2026-10-16")).toBe(
    "training",
  );
});

it("usa a data do servidor para a ofensiva mesmo quando o aparelho está em outro dia", () => {
  const state = fixture({ today: "2026-10-23", reschedules: [swap] });
  const w = entries("2026-10-19", "2026-10-21");
  // The device's real date is irrelevant: missing Thursday has already ended on the server.
  expect(trainingStreak(w, state)).toEqual({ current: 0, best: 2 });
});
