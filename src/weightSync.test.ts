import { expect, it } from "vitest";
import {
  acceptWeightResponse,
  importWeights,
  legacyWeightId,
  projectWeights,
  queueWeight,
  readWeightCache,
  type WeightEntry,
} from "./weightSync";
const day = "2026-10-17";
const row = (kg: number, id: string = crypto.randomUUID()): WeightEntry => ({
  id,
  date: day,
  kg,
  recordedAt: "2026-10-17T12:00:00Z",
  confirmedAt: "2026-10-17T12:00:01Z",
});
it("acrescenta pesagens no mesmo dia, incluindo valores iguais, sem alterar a anterior", () => {
  let cache = readWeightCache(null, []);
  cache = queueWeight(cache, day, 75);
  cache = queueWeight(cache, day, 74.8);
  cache = queueWeight(cache, day, 75);
  expect(projectWeights(cache)).toHaveLength(3);
  expect(new Set(cache.pending.map((p) => p.id)).size).toBe(3);
  expect(cache.pending.map((p) => p.kg)).toEqual([75, 74.8, 75]);
});
it("remove somente os IDs confirmados e preserva uma pesagem feita durante o envio", () => {
  const first = queueWeight(readWeightCache(null, []), day, 75),
    later = queueWeight(first, day, 74.8);
  const next = acceptWeightResponse(later, first.pending, {
    records: [{ ...first.pending[0], confirmedAt: new Date().toISOString() }],
    applied: [first.pending[0].id],
  });
  expect(next.pending).toHaveLength(1);
  expect(next.pending[0].kg).toBe(74.8);
  expect(projectWeights(next)).toHaveLength(2);
});
it("um conflito de identidade nunca substitui o valor confirmado", () => {
  const saved = row(75),
    cache = {
      ...readWeightCache(null, []),
      records: [saved],
      pending: [{ ...saved, kg: 80 }],
    };
  const next = acceptWeightResponse(cache, cache.pending, {
    records: [saved],
    applied: [],
  });
  expect(next.pending[0].conflict).toBe(true);
  expect(projectWeights(next)[0].kg).toBe(75);
});
it("migra o cache antigo preservando valores, transformando edição pendente em nova entrada e sinalizando exclusão antiga", () => {
  const id: string = crypto.randomUUID();
  const cache = readWeightCache(
    JSON.stringify({
      version: 1,
      records: [
        { date: day, kg: 75, version: 1, updatedAt: "2026-10-17T12:00:00Z" },
      ],
      pending: [
        { date: day, kg: 76, baseVersion: 1, mutationId: id },
        {
          date: "2026-10-16",
          kg: null,
          baseVersion: 1,
          mutationId: crypto.randomUUID(),
        },
      ],
      guestImported: true,
    }),
    [],
  );
  expect(cache.version).toBe(2);
  expect(cache.records[0].id).toBe(legacyWeightId(day));
  expect(cache.records[0].kg).toBe(75);
  expect(cache.pending[0]).toMatchObject({ id, kg: 76 });
  expect(projectWeights(cache)).toHaveLength(2);
  expect(cache.legacyNotice).toBe(true);
});
it("importar de novo o mesmo histórico não duplica as pesagens", () => {
  const original = [{ date: day, kg: 75 }];
  let cache = importWeights(readWeightCache(null, []), original);
  cache = importWeights(cache, original);
  expect(cache.pending).toHaveLength(1);
  expect(cache.pending[0].id).toBe(legacyWeightId(day));
});
it("recusa exclusão, resposta corrompida e IDs duplicados", () => {
  const saved = row(75),
    cache = readWeightCache(null, []);
  expect(() => queueWeight(cache, day, null as unknown as number)).toThrow();
  expect(() => readWeightCache("quebrado", [])).toThrow();
  expect(() =>
    readWeightCache(JSON.stringify({ ...cache, records: [saved, saved] }), []),
  ).toThrow();
  expect(() =>
    acceptWeightResponse(cache, [], {
      records: [{ ...saved, kg: -1 }],
      applied: [],
    }),
  ).toThrow();
});
it("preserva uma importação diferente na mesma data para guardar ambas sem sobrescrever", () => {
  const saved = row(75, legacyWeightId(day));
  const cache = importWeights(
    { ...readWeightCache(null, []), records: [saved] },
    [{ date: day, kg: 74 }],
  );
  expect(cache.pending).toHaveLength(1);
  expect(cache.pending[0]).toMatchObject({ kg: 74, conflict: true });
  expect(projectWeights(cache)[0].kg).toBe(75);
});
