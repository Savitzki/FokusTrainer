import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { claimReminder } from "./reminders";
import { backendRpc } from "./backend";
vi.mock("./backend", () => ({ backendRpc: vi.fn() }));
const rpc = vi.mocked(backendRpc);
const reminder = {
  id: "workout" as const,
  time: "17:00",
  enabled: true,
  lastSent: null,
};
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());
it("usa o horário retornado pelo servidor, mesmo com o relógio local adulterado", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2040-01-01T03:00:00Z"));
  rpc.mockResolvedValue({
    day: "2026-10-19",
    hour: 9,
    minute: 10,
    selectionKey: "a",
    timezone: "America/Sao_Paulo",
  });
  const copy = await claimReminder(reminder, "Pacific/Kiritimati");
  expect(copy?.period).toBe("morning");
  expect(copy?.day).toBe("2026-10-19");
  expect(rpc).toHaveBeenCalledWith("claim_local_reminder", {
    p_kind: "workout",
    p_time: "17:00",
    p_timezone: "Pacific/Kiritimati",
  });
});
it("não entrega se o servidor negar por descanso, treino, sessão, push ou duplicidade", async () => {
  rpc.mockResolvedValue(null);
  expect(await claimReminder(reminder, "UTC")).toBeNull();
});
it("não usa cache ou frase local quando a validação falha", async () => {
  rpc.mockRejectedValue(new Error("offline"));
  await expect(claimReminder(reminder, "UTC")).rejects.toThrow("offline");
});
it("preserva a preferência independente de peso e usa seu próprio evento", async () => {
  rpc.mockResolvedValue({
    day: "2026-10-19",
    hour: 8,
    minute: 0,
    selectionKey: "a",
    timezone: "UTC",
  });
  const copy = await claimReminder(
    { ...reminder, id: "weight", time: "08:00" },
    "UTC",
  );
  expect(copy?.category).toBe("weight_reminder");
  expect(copy?.tag).toBe("fokus-2026-10-19-weight");
});
