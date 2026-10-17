import { expect, it } from "vitest";
import {
  acceptWeightResponse,
  projectWeights,
  queueWeight,
  readWeightCache,
  type WeightRecord,
} from "./weightSync";
const row = (kg: number | null, version = 1): WeightRecord => ({
  date: "2026-10-16",
  kg,
  version,
  updatedAt: "2026-10-16T12:00:00Z",
});
it("prepara pesos antigos para importar sem sobrescrever um registro já existente na conta", () => {
  const cache = readWeightCache(null, [{ date: row(75).date, kg: 75 }]);
  const next = acceptWeightResponse(cache, cache.pending, {
    records: [row(74, 2)],
    applied: [],
  });
  expect(next.pending[0].conflict).toBe(true);
  expect(projectWeights(next)).toEqual([{ date: row(75).date, kg: 75 }]);
  expect(next.records[0].kg).toBe(74);
});
it("mantém uma edição feita durante o envio e encadeia sua revisão", () => {
  let cache = readWeightCache(null, []);
  cache = { ...cache, records: [row(75)] };
  const sent = queueWeight(cache, row(75).date, 76);
  const edited = queueWeight(sent, row(75).date, 77);
  const next = acceptWeightResponse(edited, sent.pending, {
    records: [row(76, 2)],
    applied: [sent.pending[0].mutationId],
  });
  expect(next.pending[0]).toMatchObject({
    kg: 77,
    baseVersion: 2,
    conflict: false,
  });
  expect(projectWeights(next)[0].kg).toBe(77);
});
it("propaga exclusões e não ressuscita um peso apagado por outro aparelho", () => {
  let cache = readWeightCache(null, [{ date: row(75).date, kg: 75 }]);
  const next = acceptWeightResponse(cache, cache.pending, {
    records: [row(null, 3)],
    applied: [],
  });
  expect(next.pending[0].conflict).toBe(true);
  expect(projectWeights({ ...next, pending: [] })).toEqual([]);
  cache = { ...next, pending: [] };
  const deletion = queueWeight(cache, row(75).date, null);
  expect(projectWeights(deletion)).toEqual([]);
});
it("remove uma alteração já atendida e recusa respostas ou filas corrompidas", () => {
  const cache = readWeightCache(null, [{ date: row(75).date, kg: 75 }]);
  expect(
    acceptWeightResponse(cache, cache.pending, {
      records: [row(75, 2)],
      applied: [],
    }).pending,
  ).toEqual([]);
  expect(() => readWeightCache("quebrado", [])).toThrow();
  expect(() =>
    acceptWeightResponse(cache, [], { records: [row(-1)], applied: [] }),
  ).toThrow();
});
