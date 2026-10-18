import { invalidateSync } from "./sync";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { clearAccountStorage } from "./accountStorage";
import { STORAGE_KEY } from "./model";
import { useTrainingPlan } from "./useTrainingPlan";
import type { TrainingState } from "./training";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("./backend", () => ({ accountConfigured: true, backendRpc: rpc }));
const state = (revision = 1): TrainingState => ({
  revision,
  timezone: "America/Sao_Paulo",
  today: "2026-10-17",
  startedOn: "2026-10-12",
  weeklyExtraLimit: 2,
  plans: [
    { revision: 1, effectiveFrom: "2026-10-12", trainingDays: [1, 3, 5] },
  ],
  extraRests: [],
});
beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue(state());
});

it("salva por conta e envia a revisão e o fuso canônico ao alterar a semana", async () => {
  const { result } = renderHook(() => useTrainingPlan("schedule-a"));
  await waitFor(() => expect(result.current.busy).toBe(false));
  expect(result.current.state?.revision).toBe(1);
  rpc.mockResolvedValueOnce({
    ...state(2),
    plans: [
      ...state().plans,
      {
        revision: 2,
        effectiveFrom: "2026-10-18",
        trainingDays: [1, 2, 3, 4, 5],
      },
    ],
  });
  await act(async () => {
    expect(await result.current.save([1, 2, 3, 4, 5])).toBe(true);
  });
  expect(rpc).toHaveBeenLastCalledWith("save_training_plan", {
    p_timezone: "America/Sao_Paulo",
    p_revision: 1,
    p_training_days: [1, 2, 3, 4, 5],
  });
  expect(
    JSON.parse(
      localStorage.getItem(`${STORAGE_KEY}:account:schedule-a:training`)!,
    ).revision,
  ).toBe(2);
  expect(
    localStorage.getItem(`${STORAGE_KEY}:account:schedule-b:training`),
  ).toBeNull();
});
it("usa a programação salva offline e não autoriza um descanso localmente quando o servidor recusa", async () => {
  const key = `${STORAGE_KEY}:account:schedule-offline:training`;
  localStorage.setItem(key, JSON.stringify(state()));
  rpc.mockRejectedValue(new Error("Sem conexão"));
  const { result } = renderHook(() => useTrainingPlan("schedule-offline"));
  await waitFor(() => expect(result.current.error).toBe("Sem conexão"));
  await act(async () => {
    expect(await result.current.rest()).toBe(false);
  });
  expect(result.current.state?.extraRests).toEqual([]);
  expect(JSON.parse(localStorage.getItem(key)!).extraRests).toEqual([]);
});
it("uma resposta atrasada não recria dados após logout", async () => {
  let resolve!: (value: TrainingState) => void;
  rpc.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { result } = renderHook(() => useTrainingPlan("schedule-leaving"));
  await waitFor(() => expect(rpc).toHaveBeenCalledOnce());
  clearAccountStorage("schedule-leaving");
  await act(async () => resolve(state()));
  expect(result.current.state).toBeNull();
  expect(
    localStorage.getItem(`${STORAGE_KEY}:account:schedule-leaving:training`),
  ).toBeNull();
});
it("conflito mantém a versão atual e permite recarregar antes de tentar salvar novamente", async () => {
  const { result } = renderHook(() => useTrainingPlan("schedule-conflict"));
  await waitFor(() => expect(result.current.state?.revision).toBe(1));
  rpc.mockRejectedValueOnce(
    new Error("Sua programação mudou em outro aparelho"),
  );
  await act(async () => {
    expect(await result.current.save([1, 2, 3, 4, 5])).toBe(false);
  });
  expect(result.current.state?.revision).toBe(1);
  rpc.mockResolvedValueOnce(state(3));
  await act(async () => {
    await result.current.refresh();
  });
  expect(result.current.state?.revision).toBe(3);
  expect(result.current.error).toBe("");
});
it("reconsulta uma proteção feita enquanto uma atualização anterior ainda estava em andamento", async () => {
  let resolve!: (s: TrainingState) => void;
  rpc.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { result } = renderHook(() => useTrainingPlan("schedule-protection"));
  await waitFor(() => expect(rpc).toHaveBeenCalledOnce());
  rpc.mockResolvedValueOnce({ ...state(2), medicalRests: ["2026-10-17"] });
  await act(async () => {
    invalidateSync("schedule-protection", ["training"]);
  });
  await act(async () => {
    resolve(state());
  });
  await waitFor(() =>
    expect(result.current.state?.medicalRests).toEqual(["2026-10-17"]),
  );
  expect(rpc).toHaveBeenCalledTimes(2);
});

it("sincroniza a troca com revisão/fuso fixado e restaura os reagendamentos após recarregar", async () => {
  const key = `${STORAGE_KEY}:account:schedule-swap:training`;
  const swap = {
    id: "swap",
    originalDay: "2026-10-20",
    targetDay: "2026-10-22",
    weekStart: "2026-10-19",
    createdAt: "2026-10-20T12:00:00Z",
    revision: 2,
  };
  rpc.mockResolvedValue({
    ...state(),
    reschedules: [],
    weeklyRescheduleLimit: 2,
  });
  const a = renderHook(() => useTrainingPlan("schedule-swap"));
  await waitFor(() => expect(a.result.current.busy).toBe(false));
  rpc.mockResolvedValueOnce({
    ...state(2),
    reschedules: [swap],
    weeklyRescheduleLimit: 2,
  });
  await act(async () => {
    expect(
      await a.result.current.reschedule(swap.originalDay, swap.targetDay),
    ).toBe(true);
  });
  expect(rpc).toHaveBeenLastCalledWith("reschedule_training", {
    p_original_day: swap.originalDay,
    p_target_day: swap.targetDay,
    p_revision: 1,
    p_timezone: "America/Sao_Paulo",
  });
  expect(JSON.parse(localStorage.getItem(key)!).reschedules).toEqual([swap]);
  a.unmount();
  rpc.mockRejectedValue(new Error("Sem conexão"));
  const b = renderHook(() => useTrainingPlan("schedule-swap"));
  await waitFor(() => expect(b.result.current.error).toBe("Sem conexão"));
  expect(b.result.current.state?.reschedules).toEqual([swap]);
});
