import { validDate, type Weight } from "./model";

// Kept to read caches from the former one-weight-per-date format.
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
export type WeightEntry = Weight & {
  id: string;
  recordedAt: string;
  confirmedAt?: string;
};
export type PendingWeight = WeightEntry & { conflict?: boolean };
export type WeightCache = {
  version: 2;
  records: WeightEntry[];
  pending: PendingWeight[];
  guestImported: boolean;
  legacyNotice?: boolean;
};
export type WeightResponse = { records: WeightEntry[]; applied: string[] };
const uuid = (id: unknown): id is string =>
  typeof id === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const timestamp = (s: unknown): s is string =>
  typeof s === "string" && Number.isFinite(Date.parse(s));
const validKg = (kg: unknown): kg is number =>
  typeof kg === "number" &&
  Number.isFinite(kg) &&
  kg >= 20 &&
  kg <= 500 &&
  Math.abs(kg * 10 - Math.round(kg * 10)) < 0.00001;
const validEntry = (e: WeightEntry) =>
  e &&
  uuid(e.id) &&
  validDate(e.date) &&
  validKg(e.kg) &&
  timestamp(e.recordedAt) &&
  (e.confirmedAt === undefined || timestamp(e.confirmedAt));
export const legacyWeightId = (date: string) =>
  `00000000-0000-4000-8000-${date.replaceAll("-", "")}0000`;
export const weightOrder = (a: Weight, b: Weight) =>
  a.date.localeCompare(b.date) ||
  Date.parse(a.recordedAt ?? `${a.date}T12:00:00Z`) -
    Date.parse(b.recordedAt ?? `${b.date}T12:00:00Z`) ||
  (a.id ?? "").localeCompare(b.id ?? "");
function importEntry(w: Weight): WeightEntry {
  return {
    ...w,
    id: w.id ?? legacyWeightId(w.date),
    recordedAt: w.recordedAt ?? new Date().toISOString(),
  };
}
export function readWeightCache(
  raw: string | null,
  weights: Weight[],
): WeightCache {
  if (raw === null)
    return {
      version: 2,
      records: [],
      pending: weights.map(importEntry),
      guestImported: false,
    };
  const value = JSON.parse(raw);
  const fail = () => {
    throw new Error(
      "Não foi possível ler a fila de sincronização do peso. Seus registros foram preservados.",
    );
  };
  if (value?.version === 1) {
    const records = value.records as WeightRecord[],
      pending = value.pending as WeightChange[];
    if (
      !Array.isArray(records) ||
      !Array.isArray(pending) ||
      !records.every(
        (r) =>
          validDate(r.date) &&
          (r.kg === null || validKg(r.kg)) &&
          Number.isSafeInteger(r.version) &&
          r.version > 0 &&
          timestamp(r.updatedAt),
      ) ||
      !pending.every(
        (p) =>
          validDate(p.date) &&
          (p.kg === null || validKg(p.kg)) &&
          uuid(p.mutationId) &&
          Number.isSafeInteger(p.baseVersion) &&
          p.baseVersion >= 0,
      )
    )
      return fail();
    return {
      version: 2,
      records: records
        .filter((r) => r.kg !== null)
        .map((r) => ({
          id: legacyWeightId(r.date),
          date: r.date,
          kg: r.kg!,
          recordedAt: r.updatedAt,
          confirmedAt: r.updatedAt,
        })),
      pending: pending
        .filter(
          (p) =>
            p.kg !== null &&
            !records.some((r) => r.date === p.date && r.kg === p.kg),
        )
        .map((p) => ({
          id: p.mutationId,
          date: p.date,
          kg: p.kg!,
          recordedAt: new Date().toISOString(),
        })),
      guestImported: value.guestImported === true,
      legacyNotice: pending.some((p) => p.kg === null),
    };
  }
  if (
    value?.version !== 2 ||
    !Array.isArray(value.records) ||
    !Array.isArray(value.pending) ||
    !value.records.every(validEntry) ||
    !value.pending.every(validEntry) ||
    new Set(value.records.map((r: WeightEntry) => r.id)).size !==
      value.records.length ||
    new Set(value.pending.map((p: WeightEntry) => p.id)).size !==
      value.pending.length ||
    typeof value.guestImported !== "boolean"
  )
    return fail();
  return value;
}
export function projectWeights(cache: WeightCache): WeightEntry[] {
  const values = new Map(cache.records.map((r) => [r.id, r]));
  for (const p of cache.pending) if (!values.has(p.id)) values.set(p.id, p);
  return [...values.values()].sort(weightOrder);
}
export function queueWeight(
  cache: WeightCache,
  date: string,
  kg: number,
): WeightCache {
  if (!validDate(date) || !validKg(kg))
    throw new Error(
      "Informe um peso válido. Registros salvos não podem ser alterados.",
    );
  return {
    ...cache,
    pending: [
      ...cache.pending,
      {
        id: crypto.randomUUID(),
        date,
        kg,
        recordedAt: new Date().toISOString(),
      },
    ],
  };
}
export function importWeights(
  cache: WeightCache,
  entries: Weight[],
): WeightCache {
  const known = new Set([...cache.records, ...cache.pending].map((r) => r.id));
  const pending = [...cache.pending];
  for (const w of entries) {
    const entry = importEntry(w);
    if (!validEntry(entry))
      throw new Error(
        "Há um peso inválido na importação. Os dados foram preservados.",
      );
    if (known.has(entry.id)) {
      const saved = cache.records.find((r) => r.id === entry.id);
      if (
        saved &&
        (saved.kg !== entry.kg || saved.date !== entry.date) &&
        !pending.some((p) => p.id === entry.id)
      )
        pending.push({ ...entry, conflict: true });
      continue;
    }
    known.add(entry.id);
    pending.push(entry);
  }
  return { ...cache, pending, guestImported: true };
}
export function acceptWeightResponse(
  cache: WeightCache,
  sent: PendingWeight[],
  response: WeightResponse,
): WeightCache {
  readWeightCache(
    JSON.stringify({
      version: 2,
      records: response.records,
      pending: [],
      guestImported: false,
    }),
    [],
  );
  if (!Array.isArray(response.applied) || !response.applied.every(uuid))
    throw new Error("Resposta de sincronização inválida.");
  const pending = cache.pending.flatMap((current) => {
    if (!sent.some((p) => p.id === current.id)) return [current];
    if (response.applied.includes(current.id)) return [];
    const saved = response.records.find((r) => r.id === current.id);
    if (
      saved &&
      saved.date === current.date &&
      saved.kg === current.kg &&
      Date.parse(saved.recordedAt) === Date.parse(current.recordedAt)
    )
      return [];
    return [{ ...current, conflict: true }];
  });
  return { ...cache, records: response.records, pending };
}
