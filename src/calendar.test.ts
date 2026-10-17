import { describe, expect, it } from "vitest";
import { calendarDays, shiftMonth } from "./calendar";

describe("calendário mensal", () => {
  it("inclui todos os dias de fevereiro bissexto e completa as semanas de segunda a domingo", () => {
    const days = calendarDays("2024-02");
    expect(days).toHaveLength(35);
    expect(days[0]).toBe("2024-01-29");
    expect(days.at(-1)).toBe("2024-03-03");
    expect(days.filter((day) => day.startsWith("2024-02"))).toHaveLength(29);
    expect(new Set(days).size).toBe(days.length);
  });
  it("comporta meses de quatro e seis semanas, inclusive na mudança de horário de verão", () => {
    expect(calendarDays("2021-02")).toHaveLength(28);
    const days = calendarDays("2026-03");
    expect(days).toHaveLength(42);
    expect(days[0]).toBe("2026-02-23");
    expect(days.at(-1)).toBe("2026-04-05");
    expect(days.filter((day) => day.startsWith("2026-03"))).toHaveLength(31);
  });
  it("troca de ano sem herdar o dia 29, 30 ou 31 do dispositivo", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
    expect(shiftMonth("2024-03", -1)).toBe("2024-02");
  });
});
