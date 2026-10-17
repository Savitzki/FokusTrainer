import { describe, expect, it } from "vitest";
import {
  COMPLETED_PHRASES,
  MOTIVATIONAL_PHRASES,
  motivationFor,
} from "./motivation";

describe("frases de treino", () => {
  it("usa o primeiro nome e adapta o tratamento sem alongar nomes grandes", () => {
    expect(
      motivationFor(false, 0, {
        displayName: "Ana Clara",
        treatment: "feminine",
      }),
    ).toBe("Ana, vai desistir?");
    expect(
      motivationFor(true, 0, { displayName: "João", treatment: "masculine" }),
    ).toBe("Tá pago, João 🔥");
    expect(
      motivationFor(false, 2, { displayName: "", treatment: "feminine" }),
    ).toContain("consagrada");
    expect(
      motivationFor(false, 2, { displayName: "", treatment: "masculine" }),
    ).toContain("meu consagrado");
    expect(
      motivationFor(false, 2, { displayName: "", treatment: "neutral" }),
    ).toContain("parça");
    expect(
      motivationFor(false, 0, {
        displayName: "NomeExtremamenteComprido",
        treatment: "neutral",
      }),
    ).not.toContain("NomeExtremamenteComprido");
  });
  it("mantém as frases gerais curtas e muda a mensagem depois do treino", () => {
    expect(MOTIVATIONAL_PHRASES).toHaveLength(50);
    expect(COMPLETED_PHRASES).toHaveLength(12);
    for (let i = 0; i < 100; i++) {
      expect(MOTIVATIONAL_PHRASES).toContain(motivationFor(false, i));
      expect(COMPLETED_PHRASES).toContain(motivationFor(true, i));
      expect(motivationFor(false, i)).not.toBe(motivationFor(true, i));
    }
    expect(
      [...MOTIVATIONAL_PHRASES, ...COMPLETED_PHRASES].every(
        (phrase) =>
          !/[.\n]/.test(phrase) &&
          !/sofá|sofa|tênis|tenis|fanfic|fofoca|story/i.test(phrase),
      ),
    ).toBe(true);
  });
});
