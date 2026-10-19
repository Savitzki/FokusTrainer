import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearAccountStorage } from "./accountStorage";
import { STORAGE_KEY } from "./model";
import { notifySyncWrite } from "./sync";
import {
  readTrainingCalendar,
  useTrainingCalendar,
  type TrainingCalendarMonth,
} from "./useTrainingCalendar";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("./backend", () => ({ accountConfigured: true, backendRpc: rpc }));
function monthFixture(month = "2026-10", revision = 1): TrainingCalendarMonth {
  const count = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0),
  ).getUTCDate();
  return {
    month,
    today: "2026-10-19",
    timezone: "UTC",
    revision,
    days: Array.from({ length: count }, (_, i) => ({
      day: `${month}-${String(i + 1).padStart(2, "0")}`,
      kind: "training",
      completed: false,
      active: false,
      streak: 0,
    })),
  };
}
beforeEach(() => {
  rpc.mockReset().mockResolvedValue(monthFixture());
});
afterEach(() => vi.restoreAllMocks());
it("consulta apenas a área ativa, com o fuso fixado e o mês selecionado", async () => {
  const view = renderHook(
    ({ enabled }) =>
      useTrainingCalendar(
        "calendar-open",
        enabled,
        "2026-10",
        "America/Sao_Paulo",
      ),
    { initialProps: { enabled: false } },
  );
  expect(rpc).not.toHaveBeenCalled();
  view.rerender({ enabled: true });
  await waitFor(() => expect(view.result.current.state?.month).toBe("2026-10"));
  expect(rpc).toHaveBeenCalledExactlyOnceWith("get_training_calendar", {
    p_month: "2026-10-01",
    p_timezone: "America/Sao_Paulo",
  });
});
it("reabre com cache válido sem apagá-lo quando a atualização falha", async () => {
  const cache = monthFixture();
  cache.days[11] = {
    day: "2026-10-12",
    kind: "training",
    completed: true,
    active: true,
    streak: 1,
  };
  localStorage.setItem(
    `${STORAGE_KEY}:account:calendar-cached:calendar:2026-10`,
    JSON.stringify(cache),
  );
  rpc.mockRejectedValue(new Error("Network offline"));
  const view = renderHook(() =>
    useTrainingCalendar("calendar-cached", true, "2026-10", "UTC"),
  );
  expect(view.result.current.state?.days[11].active).toBe(true);
  await waitFor(() =>
    expect(view.result.current.error).toContain("Network offline"),
  );
  expect(view.result.current.state?.days[11].active).toBe(true);
});
it("deduplica duas consultas simultâneas do mesmo mês e conta", async () => {
  let complete!: (v: unknown) => void;
  rpc.mockReturnValue(
    new Promise((r) => {
      complete = r;
    }),
  );
  const a = renderHook(() =>
    useTrainingCalendar("calendar-shared", true, "2026-10", "UTC"),
  );
  const b = renderHook(() =>
    useTrainingCalendar("calendar-shared", true, "2026-10", "UTC"),
  );
  expect(rpc).toHaveBeenCalledOnce();
  await act(async () => complete(monthFixture()));
  expect(a.result.current.state?.days).toHaveLength(31);
  expect(b.result.current.state?.days).toHaveLength(31);
});
it("invalida após treino e Kit Médico, sem consultar após compra que não muda datas", async () => {
  const view = renderHook(() =>
    useTrainingCalendar("calendar-write", true, "2026-10", "UTC"),
  );
  await waitFor(() => expect(view.result.current.state).not.toBeNull());
  rpc.mockResolvedValue(monthFixture("2026-10", 2));
  await act(async () =>
    notifySyncWrite("calendar-write", "confirm_manual_workout"),
  );
  await waitFor(() => expect(view.result.current.state?.revision).toBe(2));
  await act(async () => notifySyncWrite("calendar-write", "buy_medical_kit"));
  expect(rpc).toHaveBeenCalledTimes(2);
  await act(async () => notifySyncWrite("calendar-write", "use_medical_kit"));
  await waitFor(() => expect(rpc).toHaveBeenCalledTimes(3));
});
it("ignora respostas antigas de outro mês", async () => {
  let old!: (v: unknown) => void;
  rpc
    .mockReturnValueOnce(
      new Promise((r) => {
        old = r;
      }),
    )
    .mockResolvedValue(monthFixture("2026-09", 2));
  const view = renderHook(
    ({ month }) => useTrainingCalendar("calendar-month", true, month, "UTC"),
    { initialProps: { month: "2026-10" } },
  );
  view.rerender({ month: "2026-09" });
  await waitFor(() => expect(view.result.current.state?.month).toBe("2026-09"));
  await act(async () => old(monthFixture()));
  expect(view.result.current.state?.month).toBe("2026-09");
});
it("não restaura dados depois do logout nem mistura a próxima conta", async () => {
  let old!: (v: unknown) => void;
  rpc
    .mockReturnValueOnce(
      new Promise((r) => {
        old = r;
      }),
    )
    .mockResolvedValue(monthFixture("2026-10", 2));
  const view = renderHook(
    ({ user }) => useTrainingCalendar(user, true, "2026-10", "UTC"),
    { initialProps: { user: "calendar-old" } },
  );
  act(() => clearAccountStorage("calendar-old"));
  view.rerender({ user: "calendar-new" });
  await waitFor(() => expect(view.result.current.state?.revision).toBe(2));
  await act(async () => old(monthFixture()));
  expect(view.result.current.state?.revision).toBe(2);
  expect(
    localStorage.getItem(
      `${STORAGE_KEY}:account:calendar-old:calendar:2026-10`,
    ),
  ).toBeNull();
});
it.each(["future", "unplanned", "duplicate", "incomplete"])(
  "rejeita um calendário inválido: %s",
  (kind) => {
    const value = monthFixture();
    if (kind === "future")
      value.days[29] = { ...value.days[29], active: true, streak: 1 };
    if (kind === "unplanned")
      value.days[0] = {
        ...value.days[0],
        kind: "unplanned",
        active: true,
        streak: 1,
      };
    if (kind === "duplicate") value.days[1] = value.days[0];
    if (kind === "incomplete") value.days.pop();
    expect(() => readTrainingCalendar(value)).toThrow();
  },
);
