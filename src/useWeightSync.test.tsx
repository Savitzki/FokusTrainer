import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { localDate, STORAGE_KEY } from "./model";
import { useWeightSync } from "./useWeightSync";
import {
  legacyWeightId,
  type WeightEntry,
  type WeightResponse,
} from "./weightSync";
import { clearAccountStorage } from "./accountStorage";
import { queueWeight, readWeightCache } from "./weightSync";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("./backend", () => ({ backendRpc: rpc }));
const uid = "11111111-1111-4111-8111-111111111111",
  day = localDate();
let rows: WeightEntry[] = [];
function server(
  name: string,
  args: Record<string, any>,
): Promise<WeightResponse> {
  expect(name).toBe("sync_weight_entries");
  expect(args.p_user_id).toBe(uid);
  const applied: string[] = [];
  for (const entry of args.p_entries) {
    const old = rows.find((r) => r.id === entry.id);
    if (old) {
      if (
        old.kg === entry.kg &&
        old.date === entry.date &&
        Date.parse(old.recordedAt) === Date.parse(entry.recordedAt)
      )
        applied.push(entry.id);
      continue;
    }
    rows.push({ ...entry, confirmedAt: new Date().toISOString() });
    applied.push(entry.id);
  }
  return Promise.resolve({ records: structuredClone(rows), applied });
}
beforeEach(() => {
  rows = [];
  rpc.mockReset();
  rpc.mockImplementation(server);
});
afterEach(() =>
  Object.defineProperty(navigator, "onLine", {
    value: true,
    configurable: true,
  }),
);
it("projeta o último peso e a fila imediatamente mesmo offline, sem consultar o servidor", () => {
  const cache = queueWeight(readWeightCache(null, []), day, 76.2),
    received = vi.fn();
  localStorage.setItem(
    `${STORAGE_KEY}:account:${uid}:weight-sync`,
    JSON.stringify(cache),
  );
  Object.defineProperty(navigator, "onLine", {
    value: false,
    configurable: true,
  });
  const hook = renderHook(() => useWeightSync(uid, [], received));
  expect(received).toHaveBeenLastCalledWith([
    expect.objectContaining({ kg: 76.2 }),
  ]);
  expect(hook.result.current.pending).toBe(1);
  expect(hook.result.current.busy).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
it("recupera todas as pesagens do mesmo dia em outro aparelho", async () => {
  const a = renderHook(() => useWeightSync(uid, [], vi.fn()));
  await waitFor(() => expect(a.result.current.synced).toBe(true));
  act(() => {
    a.result.current.save(day, 75);
    a.result.current.save(day, 74.8);
  });
  await waitFor(() => expect(a.result.current.pending).toBe(0));
  expect(rows).toHaveLength(2);
  a.unmount();
  localStorage.removeItem(`${STORAGE_KEY}:account:${uid}:weight-sync`);
  const received = vi.fn(),
    b = renderHook(() => useWeightSync(uid, [], received));
  await waitFor(() => expect(b.result.current.synced).toBe(true));
  expect(received).toHaveBeenLastCalledWith(
    expect.arrayContaining([
      expect.objectContaining({ kg: 75 }),
      expect.objectContaining({ kg: 74.8 }),
    ]),
  );
});
it("preserva IDs e a fila offline e reenvia sem duplicar ao reabrir", async () => {
  rpc.mockRejectedValue(new Error("Sem internet"));
  const a = renderHook(() => useWeightSync(uid, [], vi.fn()));
  await waitFor(() => expect(a.result.current.error).toBe("Sem internet"));
  act(() => {
    a.result.current.save(day, 75);
    a.result.current.save(day, 74.8);
  });
  await waitFor(() => expect(a.result.current.busy).toBe(false));
  a.unmount();
  const key = `${STORAGE_KEY}:account:${uid}:weight-sync`,
    ids = JSON.parse(localStorage.getItem(key)!).pending.map(
      (p: WeightEntry) => p.id,
    );
  rpc.mockImplementation(server);
  const b = renderHook(() => useWeightSync(uid, [], vi.fn()));
  await waitFor(() => expect(b.result.current.synced).toBe(true));
  expect(rows.map((r) => r.id)).toEqual(ids);
  await act(async () => b.result.current.refresh());
  expect(rows).toHaveLength(2);
});
it("não perde nova pesagem adicionada enquanto a anterior está sendo enviada", async () => {
  const hook = renderHook(() => useWeightSync(uid, [], vi.fn()));
  await waitFor(() => expect(hook.result.current.synced).toBe(true));
  let release!: () => void;
  rpc.mockImplementationOnce(
    (name, args) =>
      new Promise((resolve) => {
        release = () => void server(name, args).then(resolve);
      }),
  );
  act(() => hook.result.current.save(day, 75));
  await waitFor(() => expect(hook.result.current.busy).toBe(true));
  act(() => hook.result.current.save(day, 74.8));
  await act(async () => release());
  await waitFor(() => expect(hook.result.current.pending).toBe(0));
  expect(rows.map((r) => r.kg)).toEqual([75, 74.8]);
});
it("migra o cache diário com cópia de segurança e reconhece o registro legado", async () => {
  const key = `${STORAGE_KEY}:account:${uid}:weight-sync`,
    raw = JSON.stringify({
      version: 1,
      records: [
        { date: day, kg: 75, version: 1, updatedAt: new Date().toISOString() },
      ],
      pending: [],
      guestImported: false,
    });
  localStorage.setItem(key, raw);
  rows = [
    {
      id: legacyWeightId(day),
      date: day,
      kg: 75,
      recordedAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
    },
  ];
  const hook = renderHook(() => useWeightSync(uid, [], vi.fn()));
  await waitFor(() => expect(hook.result.current.synced).toBe(true));
  expect(localStorage.getItem(`${key}:v1-backup`)).toBe(raw);
  expect(JSON.parse(localStorage.getItem(key)!).version).toBe(2);
  expect(rows).toHaveLength(1);
});
it("não publica resposta atrasada nem recria dados depois de sair", async () => {
  let finish!: (r: WeightResponse) => void;
  rpc.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const received = vi.fn(),
    hook = renderHook(() => useWeightSync(uid, [], received));
  await waitFor(() => expect(hook.result.current.busy).toBe(true));
  clearAccountStorage(uid);
  received.mockClear();
  await act(async () => finish({ records: [], applied: [] }));
  expect(received).not.toHaveBeenCalled();
  expect(
    localStorage.getItem(`${STORAGE_KEY}:account:${uid}:weight-sync`),
  ).toBeNull();
  expect(() => hook.result.current.save(day, 75)).toThrow();
});
it("o visitante não sincroniza e o mesmo ID em conflito só pode ser guardado como nova pesagem", async () => {
  renderHook(() => useWeightSync(null, [{ date: day, kg: 70 }], vi.fn()));
  expect(rpc).not.toHaveBeenCalled();
  const id = crypto.randomUUID(),
    recordedAt = new Date().toISOString();
  rows = [{ id, date: day, kg: 75, recordedAt }];
  localStorage.setItem(
    `${STORAGE_KEY}:account:${uid}:weight-sync`,
    JSON.stringify({
      version: 2,
      records: [],
      pending: [{ id, date: day, kg: 80, recordedAt }],
      guestImported: false,
    }),
  );
  const hook = renderHook(() => useWeightSync(uid, [], vi.fn()));
  await waitFor(() => expect(hook.result.current.conflicts).toHaveLength(1));
  act(() => hook.result.current.resolve(id, true));
  await waitFor(() => expect(hook.result.current.pending).toBe(0));
  expect(rows.map((r) => r.kg)).toEqual([75, 80]);
  expect(rows[1].id).not.toBe(id);
});
it("só reage ao peso aceito no servidor, sem repetir na consulta ou ao reabrir", async () => {
  const confirmed = vi.fn();
  const hook = renderHook(() =>
    useWeightSync(uid, [], vi.fn(), false, "UTC", confirmed),
  );
  await waitFor(() => expect(hook.result.current.synced).toBe(true));
  expect(confirmed).not.toHaveBeenCalled();
  rpc.mockRejectedValueOnce(new Error("offline"));
  act(() => hook.result.current.save(day, 75));
  await waitFor(() => expect(hook.result.current.error).toBe("offline"));
  expect(confirmed).not.toHaveBeenCalled();
  await act(async () => hook.result.current.refresh());
  await waitFor(() => expect(hook.result.current.pending).toBe(0));
  expect(confirmed).toHaveBeenCalledOnce();
  await act(async () => hook.result.current.refresh());
  expect(confirmed).toHaveBeenCalledOnce();
  hook.unmount();
  const reopened = renderHook(() =>
    useWeightSync(uid, [], vi.fn(), false, "UTC", confirmed),
  );
  await waitFor(() => expect(reopened.result.current.synced).toBe(true));
  expect(confirmed).toHaveBeenCalledOnce();
});
