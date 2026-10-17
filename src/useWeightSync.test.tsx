import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { localDate, shiftDate, STORAGE_KEY } from "./model";
import { useWeightSync } from "./useWeightSync";
import type { WeightRecord, WeightResponse } from "./weightSync";
import { clearAccountStorage } from "./accountStorage";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("./backend", () => ({ backendRpc: rpc }));
const uid = "11111111-1111-4111-8111-111111111111";
let rows: (WeightRecord & { mutationId: string })[] = [];
function server(
  _name: string,
  args: Record<string, any>,
): Promise<WeightResponse> {
  expect(args.p_user_id).toBe(uid);
  const applied: string[] = [];
  for (const change of args.p_changes) {
    const row = rows.find((r) => r.date === change.date);
    if (row?.mutationId === change.mutationId) {
      applied.push(change.mutationId);
      continue;
    }
    if ((row?.version ?? 0) !== change.baseVersion) continue;
    const next = {
      date: change.date,
      kg: change.kg,
      version: (row?.version ?? 0) + 1,
      updatedAt: new Date().toISOString(),
      mutationId: change.mutationId,
    };
    rows = rows.filter((r) => r.date !== change.date).concat(next);
    applied.push(change.mutationId);
  }
  return Promise.resolve({ records: structuredClone(rows), applied });
}
beforeEach(() => {
  rows = [];
  rpc.mockReset();
  rpc.mockImplementation(server);
});
it("importa pesos associados à conta e recupera o histórico em outro aparelho", async () => {
  const original = [
    { date: shiftDate(localDate(), -1), kg: 75 },
    { date: localDate(), kg: 74.5 },
  ];
  const a = renderHook(() => useWeightSync(uid, original, vi.fn()));
  await waitFor(() => expect(a.result.current.synced).toBe(true));
  expect(rows).toHaveLength(2);
  a.unmount();
  localStorage.removeItem(`${STORAGE_KEY}:account:${uid}:weight-sync`);
  const received = vi.fn();
  const b = renderHook(() => useWeightSync(uid, [], received));
  await waitFor(() => expect(b.result.current.synced).toBe(true));
  expect(received).toHaveBeenLastCalledWith(original);
});
it("preserva a fila offline, recupera o peso ao reabrir e tenta novamente ao reconectar", async () => {
  rpc.mockRejectedValue(new Error("Sem internet"));
  const first = renderHook(() => useWeightSync(uid, [], vi.fn()));
  await waitFor(() => expect(first.result.current.error).toBe("Sem internet"));
  act(() => first.result.current.save(localDate(), 73.2));
  await waitFor(() => expect(first.result.current.busy).toBe(false));
  first.unmount();
  const received = vi.fn();
  const second = renderHook(() => useWeightSync(uid, [], received));
  await waitFor(() =>
    expect(received).toHaveBeenCalledWith([{ date: localDate(), kg: 73.2 }]),
  );
  rpc.mockImplementation(server);
  await act(async () => {
    window.dispatchEvent(new Event("online"));
  });
  await waitFor(() => expect(second.result.current.pending).toBe(0));
  expect(rows[0].kg).toBe(73.2);
});
it("resolve alterações concorrentes por escolha explícita e sincroniza exclusões", async () => {
  const hook = renderHook(() => useWeightSync(uid, [], vi.fn()));
  await waitFor(() => expect(hook.result.current.synced).toBe(true));
  act(() => hook.result.current.save(localDate(), 75));
  await waitFor(() => expect(hook.result.current.pending).toBe(0));
  rows[0] = { ...rows[0], kg: 74, version: 2, mutationId: crypto.randomUUID() };
  act(() => hook.result.current.save(localDate(), 76));
  await waitFor(() => expect(hook.result.current.conflicts).toHaveLength(1));
  expect(rows[0].kg).toBe(74);
  act(() => hook.result.current.resolve(localDate(), true));
  await waitFor(() => expect(hook.result.current.pending).toBe(0));
  expect(rows[0].kg).toBe(76);
  act(() => hook.result.current.save(localDate(), null));
  await waitFor(() => expect(hook.result.current.pending).toBe(0));
  expect(rows[0].kg).toBeNull();
});
it("mantém a edição feita enquanto uma requisição está em andamento", async () => {
  const hook = renderHook(() => useWeightSync(uid, [], vi.fn()));
  await waitFor(() => expect(hook.result.current.synced).toBe(true));
  let release!: () => void;
  rpc.mockImplementationOnce(
    (name, args) =>
      new Promise((resolve) => {
        release = () => {
          void server(name, args).then(resolve);
        };
      }),
  );
  act(() => hook.result.current.save(localDate(), 75));
  await waitFor(() => expect(hook.result.current.busy).toBe(true));
  act(() => hook.result.current.save(localDate(), 74.8));
  await act(async () => release());
  await waitFor(() => expect(hook.result.current.pending).toBe(0));
  expect(rows[0].kg).toBe(74.8);
  expect(rows[0].version).toBe(2);
});
it("não publica dados de uma conta depois que ela foi desmontada e não importa pesos sem login sozinho", async () => {
  const guest = vi.fn();
  renderHook(() => useWeightSync(null, [{ date: localDate(), kg: 70 }], guest));
  expect(rpc).not.toHaveBeenCalled();
  let resolve!: (r: WeightResponse) => void;
  rpc.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const received = vi.fn();
  const hook = renderHook(() => useWeightSync(uid, [], received));
  await waitFor(() => expect(rpc).toHaveBeenCalled());
  received.mockClear();
  hook.unmount();
  await act(async () =>
    resolve({
      records: [
        {
          date: localDate(),
          kg: 74,
          version: 1,
          updatedAt: new Date().toISOString(),
        },
      ],
      applied: [],
    }),
  );
  expect(received).not.toHaveBeenCalled();
});
it("não recria o cache nem publica uma resposta atrasada após limpar a conta", async () => {
  let finish!: (value: WeightResponse) => void;
  rpc.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const received = vi.fn();
  const hook = renderHook(() => useWeightSync(uid, [], received));
  await waitFor(() => expect(hook.result.current.busy).toBe(true));
  clearAccountStorage(uid);
  received.mockClear();
  await act(async () =>
    finish({
      records: [
        {
          date: localDate(),
          kg: 75,
          version: 1,
          updatedAt: new Date().toISOString(),
        },
      ],
      applied: [],
    }),
  );
  expect(received).not.toHaveBeenCalled();
  expect(
    localStorage.getItem(`${STORAGE_KEY}:account:${uid}:weight-sync`),
  ).toBeNull();
});
