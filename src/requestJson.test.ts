import { describe, expect, it, vi } from "vitest";
import { InvalidJsonRequest, readLimitedJson } from "../supabase/functions/_shared/request-json";
import { loginWithNickname } from "../supabase/functions/login-with-nickname/core";
import { notify } from "../supabase/functions/group-notify/core";

const encoder = new TextEncoder();
function streamed(chunks: Uint8Array[], headers: Record<string, string> = {}) {
  const cancel = vi.fn();
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(chunks[index++]);
      else controller.close();
    },
    cancel,
  });
  const request = new Request("https://example.invalid", Object.assign({
    method: "POST", headers: { "content-type": "application/json", ...headers }, body,
  }, { duplex: "half" }));
  return { request, cancel, readCount: () => index };
}
describe("bounded Edge JSON requests", () => {
  it("decodes valid UTF-8 split across chunks and accepts the exact byte limit", async () => {
    const bytes = encoder.encode('{"name":"João"}');
    const { request } = streamed(Array.from(bytes, (byte) => Uint8Array.of(byte)));
    await expect(readLimitedJson(request, bytes.length)).resolves.toEqual({ name: "João" });
  });
  it("stops a chunked upload as soon as its byte limit is exceeded", async () => {
    const { request, cancel, readCount } = streamed(Array.from({ length: 100 }, () => encoder.encode("áááá")));
    await expect(readLimitedJson(request, 12)).rejects.toBeInstanceOf(InvalidJsonRequest);
    expect(cancel).toHaveBeenCalledOnce();
    expect(readCount()).toBeLessThan(5);
  });
  it("rejects oversized declared length before reading the body", async () => {
    const { request, cancel } = streamed([encoder.encode("{}")], { "content-length": "99999" });
    await expect(readLimitedJson(request, 12)).rejects.toBeInstanceOf(InvalidJsonRequest);
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("cancels a stalled upload at the deadline", async () => {
    vi.useFakeTimers();
    try {
      const cancel = vi.fn();
      const request = new Request("https://example.invalid", Object.assign({
        method: "POST", body: new ReadableStream({ cancel }),
      }, { duplex: "half" }));
      const result = expect(readLimitedJson(request, 12, 50)).rejects.toBeInstanceOf(InvalidJsonRequest);
      await vi.advanceTimersByTimeAsync(50);
      await result;
      expect(cancel).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });
  it.each([encoder.encode("{"), Uint8Array.of(0xff), encoder.encode("")])("rejects malformed or empty JSON without returning input", async (bytes) => {
    await expect(readLimitedJson(streamed([bytes]).request, 100)).rejects.toThrow("Invalid JSON request");
  });
  it("does not resolve credentials or enqueue notifications for oversized uploads", async () => {
    const resolve = vi.fn(), authorize = vi.fn(async () => "user"), enqueue = vi.fn(), deliver = vi.fn();
    const oversized = () => streamed([encoder.encode(" ".repeat(5000))], { authorization: "Bearer test" }).request;
    expect((await loginWithNickname(oversized(), { allow: vi.fn(), resolve, authenticate: vi.fn() })).status).toBe(400);
    expect((await notify(oversized(), { authorize, enqueue, deliver })).status).toBe(400);
    expect(resolve).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
  });
});
