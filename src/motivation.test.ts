import { describe, expect, it } from "vitest";
import { BRAZILIAN_STATES, readHomeState } from "./homeState";
import {
  COMPLETED_PHRASES,
  MOTIVATIONAL_PHRASES,
  REGIONAL_PHRASES,
  motivationFor,
} from "./motivation";

describe("frases e estado da conta", () => {
  it("usa o nome em algumas frases, adapta o tratamento e preserva frases curtas para nomes longos", () => {
    expect(
      motivationFor("MG", false, 0, {
        displayName: "Ana Clara",
        treatment: "feminine",
      }),
    ).toBe("Ana, cadê o treino?");
    expect(
      motivationFor(null, true, 0, {
        displayName: "João",
        treatment: "masculine",
      }),
    ).toBe("Tá pago, João 🔥");
    expect(
      motivationFor("BA", false, 6, { displayName: "", treatment: "feminine" }),
    ).toContain("minha rainha");
    expect(
      motivationFor("SP", false, 6, {
        displayName: "",
        treatment: "masculine",
      }),
    ).toContain("Mano");
    expect(
      motivationFor("SP", false, 6, { displayName: "", treatment: "feminine" }),
    ).toContain("Mana");
    expect(
      motivationFor("SP", false, 6, { displayName: "", treatment: "neutral" }),
    ).toContain("Parça");
    expect(
      motivationFor(null, false, 0, {
        displayName: "NomeExtremamenteComprido",
        treatment: "neutral",
      }),
    ).not.toContain("NomeExtremamenteComprido");
  });
  it("aceita os 26 estados e DF e usa frases gerais para contas antigas ou valores inválidos", () => {
    expect(Object.keys(BRAZILIAN_STATES)).toHaveLength(27);
    expect(readHomeState("MG")).toBe("MG");
    for (const value of [
      null,
      undefined,
      "",
      "general",
      "ZZ",
      "toString",
      "__proto__",
      1,
    ]) {
      expect(readHomeState(value)).toBeNull();
      expect(MOTIVATIONAL_PHRASES).toContain(motivationFor(value, false, 2));
      expect(COMPLETED_PHRASES).toContain(motivationFor(value, true, 2));
    }
  });
  it("mistura a provocação regional com frases gerais e muda a mensagem após o treino", () => {
    for (const state of Object.keys(
      BRAZILIAN_STATES,
    ) as (keyof typeof BRAZILIAN_STATES)[]) {
      const region = REGIONAL_PHRASES[state];
      expect(region.before).toContain(motivationFor(state, false, 0));
      expect(region.after).toContain(motivationFor(state, true, 0));
      expect(MOTIVATIONAL_PHRASES).toContain(motivationFor(state, false, 1));
      expect(motivationFor(state, false, 2)).toBe(
        motivationFor(state, false, 2),
      );
    }
    expect(motivationFor("MG", false, 0)).not.toBe(
      motivationFor("RJ", false, 0),
    );
  });
});
