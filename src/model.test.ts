import { describe, expect, it } from "vitest";
import {
  bestStreak,
  confirmWorkout,
  dueReminders,
  freshData,
  localDate,
  parseData,
  shiftDate,
  streak,
  validDate,
  type Workout,
} from "./model";

const workout = (date: string): Workout => ({
  id: date,
  date,
  activity: "Corrida",
  minutes: 30,
});

describe("ofensivas", () => {
  it("confirma apenas o dia atual e impede duplicação sem alterar dados existentes", () => {
    const before = freshData();
    const next = confirmWorkout(before, workout("2026-10-16"), "2026-10-16");
    expect(before.workouts).toHaveLength(0);
    expect(next.workouts).toHaveLength(1);
    expect(() =>
      confirmWorkout(next, workout("2026-10-16"), "2026-10-16"),
    ).toThrow(/já foi confirmado/);
    expect(() =>
      confirmWorkout(next, workout("2026-10-15"), "2026-10-16"),
    ).toThrow(/Só é possível/);
    expect(() =>
      confirmWorkout(next, workout("2026-10-17"), "2026-10-16"),
    ).toThrow(/Só é possível/);
    expect(next.workouts).toHaveLength(1);
  });
  it("zera após um dia completo perdido e começa uma nova sequência sem apagar o recorde", () => {
    let data = freshData();
    for (const date of ["2026-10-13", "2026-10-14", "2026-10-15"])
      data = confirmWorkout(data, workout(date), date);
    expect(streak(data.workouts, "2026-10-16")).toBe(3);
    expect(streak(data.workouts, "2026-10-17")).toBe(0);
    expect(() =>
      confirmWorkout(data, workout("2026-10-16"), "2026-10-17"),
    ).toThrow();
    data = confirmWorkout(data, workout("2026-10-17"), "2026-10-17");
    expect(streak(data.workouts, "2026-10-17")).toBe(1);
    expect(bestStreak(data.workouts)).toBe(3);
  });
  it("conta dias distintos e preserva a ofensiva antes do treino de hoje", () => {
    const workouts = ["2026-10-14", "2026-10-15", "2026-10-15"].map(workout);
    expect(streak(workouts, "2026-10-16")).toBe(2);
    expect(streak([...workouts, workout("2026-10-16")], "2026-10-16")).toBe(3);
  });
  it("reinicia após um dia perdido e preserva o recorde", () => {
    const workouts = [
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-16",
    ].map(workout);
    expect(streak(workouts, "2026-10-16")).toBe(1);
    expect(streak(workouts, "2026-10-18")).toBe(0);
    expect(bestStreak(workouts)).toBe(3);
    expect(bestStreak([])).toBe(0);
  });
  it("atravessa meses, anos e dias de horário de verão", () => {
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDate("2024-03-01", -1)).toBe("2024-02-29");
    expect(
      streak(
        ["2026-03-07", "2026-03-08", "2026-03-09"].map(workout),
        "2026-03-09",
      ),
    ).toBe(3);
  });
});

describe("lembretes", () => {
  it("usa data e hora locais, entrega pendentes e evita repetir no mesmo dia", () => {
    const data = freshData();
    const now = new Date(2026, 9, 16, 19, 0);
    data.reminders.forEach((r) => {
      r.enabled = true;
    });
    expect(localDate(now)).toBe("2026-10-16");
    expect(dueReminders(data, now)).toHaveLength(2);
    data.reminders[0].lastSent = "2026-10-16";
    expect(dueReminders(data, now).map((r) => r.id)).toEqual(["weight"]);
    expect(dueReminders(data, new Date(2026, 9, 17, 19, 0))).toHaveLength(2);
  });
  it("não avisa antes do horário, quando desativado ou quando já houve registro", () => {
    const data = freshData();
    const now = new Date(2026, 9, 16, 7, 0);
    expect(dueReminders(data, now)).toHaveLength(0);
    data.reminders.forEach((r) => {
      r.enabled = true;
    });
    expect(dueReminders(data, now)).toHaveLength(0);
    data.workouts.push(workout("2026-10-16"));
    data.weights.push({ date: "2026-10-16", kg: 72 });
    expect(dueReminders(data, new Date(2026, 9, 16, 19, 0))).toHaveLength(0);
  });
});

describe("dados persistidos", () => {
  it("aceita o formato atual e rejeita dados inválidos", () => {
    expect(parseData(JSON.stringify(freshData()))).toEqual(freshData());
    expect(() => parseData("{")).toThrow();
    expect(() =>
      parseData(
        JSON.stringify({
          ...freshData(),
          weights: [{ date: "2026-02-30", kg: 75 }],
        }),
      ),
    ).toThrow();
    expect(() =>
      parseData(
        JSON.stringify({
          ...freshData(),
          weights: [{ date: "2026-10-16", kg: -2 }],
        }),
      ),
    ).toThrow();
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("2024-02-29")).toBe(true);
  });
});
