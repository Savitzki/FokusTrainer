import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { isProtectionHour, useHomeProtection } from "./useHomeProtection";

beforeEach(() => sessionStorage.clear());
it.each([
  ["2026-10-20T01:59:00Z", "2026-10-19", "America/Sao_Paulo", false],
  ["2026-10-20T02:00:00Z", "2026-10-19", "America/Sao_Paulo", true],
  ["2026-10-20T02:59:59Z", "2026-10-19", "America/Sao_Paulo", true],
  ["2026-10-20T03:00:00Z", "2026-10-19", "America/Sao_Paulo", false],
  ["2026-10-20T03:00:00Z", "2026-10-20", "America/Sao_Paulo", false],
  ["2026-10-20T02:00:00Z", "2026-10-20", "UTC", false],
  ["2026-10-19T10:00:00Z", "2026-10-19", "Pacific/Kiritimati", false],
])(
  "respeita 23h e a virada do dia no fuso fixado: %s %s %s",
  (now, day, zone, expected) => {
    expect(isProtectionHour(new Date(now), day, zone)).toBe(expected);
  },
);
const options = () => ({
  userId: "a",
  today: "2026-10-19",
  eligible: true,
  available: true,
  refresh: vi.fn().mockResolvedValue(true),
});
it("só oferece após atualizar o servidor, sem consumir ou repetir ao reabrir", async () => {
  let resolve!: (ok: boolean) => void;
  const props = options();
  props.refresh.mockReturnValue(
    new Promise<boolean>((done) => {
      resolve = done;
    }),
  );
  const view = renderHook(() => useHomeProtection(props));
  expect(view.result.current.offer).toBe(false);
  await act(async () => resolve(true));
  expect(view.result.current.offer).toBe(true);
  act(() => view.result.current.dismiss());
  expect(view.result.current.offer).toBe(false);
  view.unmount();
  const reopened = renderHook(() => useHomeProtection(props));
  expect(reopened.result.current.offer).toBe(false);
  expect(props.refresh).toHaveBeenCalledOnce();
});
it.each([false, true])(
  "não oferece se a atualização falha (exceção=%s)",
  async (throws) => {
    const props = options();
    if (throws) props.refresh.mockRejectedValue(new Error("offline"));
    else props.refresh.mockResolvedValue(false);
    const { result } = renderHook(() => useHomeProtection(props));
    await act(async () => {});
    expect(result.current.offer).toBe(false);
  },
);
it("ignora respostas atrasadas após mudança de conta ou perda da elegibilidade", async () => {
  let resolve!: (ok: boolean) => void;
  const props = options();
  props.refresh.mockReturnValue(
    new Promise<boolean>((done) => {
      resolve = done;
    }),
  );
  const view = renderHook((p) => useHomeProtection(p), { initialProps: props });
  view.rerender({ ...props, userId: "b", eligible: false });
  await act(async () => resolve(true));
  expect(view.result.current.offer).toBe(false);
});
it("aguarda área disponível e permite nova sugestão somente em outro dia elegível", async () => {
  const props = options();
  const view = renderHook((p) => useHomeProtection(p), {
    initialProps: { ...props, available: false },
  });
  expect(props.refresh).not.toHaveBeenCalled();
  view.rerender(props);
  await waitFor(() => expect(view.result.current.offer).toBe(true));
  act(() => view.result.current.dismiss());
  view.rerender({ ...props, today: "2026-10-20" });
  await waitFor(() => expect(view.result.current.offer).toBe(true));
  expect(props.refresh).toHaveBeenCalledTimes(2);
});
it("remove a oferta ao confirmar o treino em outro aparelho", async () => {
  const props = options();
  const view = renderHook((p) => useHomeProtection(p), { initialProps: props });
  await waitFor(() => expect(view.result.current.offer).toBe(true));
  view.rerender({ ...props, eligible: false });
  expect(view.result.current.offer).toBe(false);
});

it("retoma a verificação se outra janela interromper a consulta, sem aceitar a resposta antiga", async () => {
  let resolveOld!: (ok: boolean) => void;
  const props = options();
  props.refresh.mockReturnValueOnce(
    new Promise<boolean>((done) => {
      resolveOld = done;
    }),
  );
  const view = renderHook((p) => useHomeProtection(p), { initialProps: props });
  view.rerender({ ...props, available: false });
  await act(async () => resolveOld(true));
  expect(view.result.current.offer).toBe(false);
  view.rerender(props);
  await waitFor(() => expect(view.result.current.offer).toBe(true));
  expect(props.refresh).toHaveBeenCalledTimes(2);
});
