import { describe, expect, it } from "vitest";
import {
  COMPLETED_PHRASES,
  MOTIVATIONAL_PHRASES,
  motivationFor,
} from "./motivation";
import { CAPIBORA_PHRASES, selectCapiboraPhrase } from "./capiboraVoice";

describe("voz da Capibora", () => {
  it("preserva o primeiro nome e as preferências sem impor tratamento ou gírias regionais", () => {
    expect(
      motivationFor(false, 0, {
        displayName: "Ana Clara",
        treatment: "feminine",
      }),
    ).toBe("Ana, tá esperando o quê?");
    expect(
      motivationFor(true, 0, { displayName: "João", treatment: "masculine" }),
    ).toBe("João, tá pago");
    for (const treatment of ["feminine", "masculine", "neutral"] as const)
      expect(motivationFor(false, 2, { displayName: "", treatment })).toBe(
        "Até eu treino, e você?",
      );
    expect(
      motivationFor(false, 0, {
        displayName: "NomeExtremamenteComprido",
        treatment: "neutral",
      }),
    ).not.toContain("NomeExtremamenteComprido");
  });
  it("mantém textos curtos, identificadores únicos e contextos explícitos", () => {
    expect(new Set(CAPIBORA_PHRASES.map((p) => p.id)).size).toBe(
      CAPIBORA_PHRASES.length,
    );
    for (const p of CAPIBORA_PHRASES) {
      expect(p.text.length).toBeLessThanOrEqual(65);
      expect(p.expression).toBeTruthy();
      expect([
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
      ]).toContain(p.position);
      expect(p.conditions.all).toBeInstanceOf(Array);
      expect(p.text).not.toMatch(
        /Você consegue|jornada|coach|vou saber|eles vão saber|sofá|tênis|meu consagrado/i,
      );
    }
    for (let i = 0; i < 100; i++) {
      expect(MOTIVATIONAL_PHRASES).toContain(motivationFor(false, i));
      expect(COMPLETED_PHRASES).toContain(motivationFor(true, i));
    }
  });
  it("não provoca em descanso, proteção, treino concluído, sessão ativa ou retorno após ausência", () => {
    for (const fact of [
      "rest",
      "protected",
      "completed",
      "returning",
      "active",
      "unplanned",
    ] as const)
      expect(
        selectCapiboraPhrase("pending", 0, { pending: true, [fact]: true }),
      ).toBeUndefined();
    expect(selectCapiboraPhrase("rest", 0, { rest: true })?.text).toBe(
      "Hoje pode",
    );
    expect(
      selectCapiboraPhrase("returning", 0, { returning: true })?.text,
    ).toBe("Olha quem apareceu");
  });
  it("só comenta uma competição aceita com posição real e não repete a última fala", () => {
    expect(selectCapiboraPhrase("arena-behind", 0, {})).toBeUndefined();
    expect(
      selectCapiboraPhrase("arena-behind", 0, { acceptedChallenge: true }),
    ).toBeUndefined();
    expect(
      selectCapiboraPhrase("arena-behind", 0, {
        acceptedChallenge: true,
        behind: true,
        rest: true,
      }),
    ).toBeUndefined();
    expect(
      selectCapiboraPhrase("arena-behind", 0, {
        acceptedChallenge: true,
        behind: true,
      })?.text,
    ).toBe("Tá ficando pra trás");
    const first = selectCapiboraPhrase("pending", 0, { pending: true });
    expect(
      selectCapiboraPhrase("pending", 0, { pending: true }, first?.id)?.id,
    ).not.toBe(first?.id);
  });
});

it("distribui as falas entre os cantos sem mudar a posição em consultas idênticas", () => {
  expect(new Set(CAPIBORA_PHRASES.map((p) => p.position)).size).toBe(4);
  const line = selectCapiboraPhrase("pending", 2, { pending: true });
  expect(selectCapiboraPhrase("pending", 2, { pending: true })?.position).toBe(
    line?.position,
  );
  expect(selectCapiboraPhrase("active", 0, { active: true })?.position).toBe(
    "top-right",
  );
});
