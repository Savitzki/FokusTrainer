import { validDate, type Weight } from "./model";
export type WeightRecord = {
  date: string;
  kg: number | null;
  version: number;
  updatedAt: string;
};
export type WeightChange = {
  date: string;
  kg: number | null;
  baseVersion: number;
  mutationId: string;
  conflict?: boolean;
};
export type WeightCache = {
  version: 1;
  records: WeightRecord[];
  pending: WeightChange[];
  guestImported: boolean;
};
export type WeightResponse = { records: WeightRecord[]; applied: string[] };
const validKg = (kg: unknown) =>
  kg === null ||
  (typeof kg === "number" &&
    Number.isFinite(kg) &&
    kg >= 20 &&
    kg <= 500 &&
    Math.abs(kg * 10 - Math.round(kg * 10)) < 0.00001);
export function readWeightCache(
  raw: string | null,
  weights: Weight[],
): WeightCache {
  if (raw === null)
    return {
      version: 1,
      records: [],
      pending: weights.map((w) => ({
        ...w,
        baseVersion: 0,
        mutationId: crypto.randomUUID(),
      })),
      guestImported: false,
    };
  const value = JSON.parse(raw) as WeightCache;
  if (
    value.version !== 1 ||
    !Array.isArray(value.records) ||
    !Array.isArray(value.pending) ||
    !value.records.every(
      (r) =>
        validDate(r.date) &&
        validKg(r.kg) &&
        Number.isSafeInteger(r.version) &&
        r.version > 0 &&
        Number.isFinite(Date.parse(r.updatedAt)),
    ) ||
    !value.pending.every(
      (r) =>
        validDate(r.date) &&
        validKg(r.kg) &&
        Number.isSafeInteger(r.baseVersion) &&
        r.baseVersion >= 0 &&
        /^[0-9a-f-]{36}$/i.test(r.mutationId),
    )
  )
    throw new Error(
      "Não foi possível ler a fila de sincronização do peso. Seus registros foram preservados.",
    );
  return value;
}
export function projectWeights(cache: WeightCache): Weight[] {
  const values = new Map(cache.records.map((r) => [r.date, r.kg]));
  cache.pending.forEach((r) => values.set(r.date, r.kg));
  return [...values]
    .filter(([, kg]) => kg !== null)
    .map(([date, kg]) => ({ date, kg: kg! }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function queueWeight(
  cache: WeightCache,
  date: string,
  kg: number | null,
): WeightCache {
  const previous = cache.pending.find((p) => p.date === date);
  const change: WeightChange = {
    date,
    kg,
    baseVersion:
      previous?.baseVersion ??
      cache.records.find((r) => r.date === date)?.version ??
      0,
    mutationId: crypto.randomUUID(),
  };
  return {
    ...cache,
    pending: [...cache.pending.filter((p) => p.date !== date), change],
  };
}
export function acceptWeightResponse(
  cache: WeightCache,
  sent: WeightChange[],
  response: WeightResponse,
): WeightCache {
  // Validate the API response before replacing any local history.
  readWeightCache(
    JSON.stringify({
      version: 1,
      records: response.records,
      pending: [],
      guestImported: false,
    }),
    [],
  );
  if (!Array.isArray(response.applied))
    throw new Error("Resposta de sincronização inválida.");
  const pending = cache.pending.flatMap((current) => {
    const request = sent.find((p) => p.date === current.date);
    if (!request) return [current];
    const record = response.records.find((r) => r.date === current.date);
    if (response.applied.includes(request.mutationId)) {
      if (current.mutationId === request.mutationId) return [];
      // An edit made while the request was in flight follows that accepted edit.
      return [
        {
          ...current,
          baseVersion: record?.version ?? current.baseVersion,
          conflict: false,
        },
      ];
    }
    if (record?.kg === current.kg) return [];
    return [{ ...current, conflict: true }];
  });
  return { ...cache, records: response.records, pending };
}
