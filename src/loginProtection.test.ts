import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loginSourceBucket } from "../supabase/functions/login-with-nickname/limit";
import { loginWithNickname } from "../supabase/functions/login-with-nickname/core";

beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => vi.unstubAllGlobals());
it("ignores forwarded prefixes and never sends raw addresses to storage", async () => {
  const request = (forwarded: string) => new Request("https://example.invalid", {headers:{"x-forwarded-for":forwarded}});
  const a = await loginSourceBucket(request("203.0.113.4"), "secret-only-on-server");
  expect(a).toMatch(/^[a-f0-9]{64}$/);
  expect(await loginSourceBucket(request("fake, 203.0.113.4"), "secret-only-on-server")).toBe(a);
  expect(await loginSourceBucket(request("203.0.113.5"), "secret-only-on-server")).not.toBe(a);
  expect(await loginSourceBucket(request("203.0.113.4"), "other-server-secret")).not.toBe(a);
  expect(await loginSourceBucket(request("invalid-1"), "secret-only-on-server"))
    .toBe(await loginSourceBucket(request("invalid-2"), "secret-only-on-server"));
});
it.each([false, "failure"])("rate protection %s stops resolution and authentication", async (result) => {
  const resolve = vi.fn(), authenticate = vi.fn();
  const allow = result === false ? vi.fn().mockResolvedValue(false) : vi.fn().mockRejectedValue(Error("private detail"));
  const response = await loginWithNickname(new Request("https://example.invalid", {
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({nickname:"Dani",password:"valid-password"}),
  }), {allow,resolve,authenticate});
  expect(response.status).toBe(result === false ? 429 : 503);
  if(result === false)expect(response.headers.get("retry-after")).toBe("60");
  expect(await response.text()).not.toContain("private detail");
  expect(resolve).not.toHaveBeenCalled();
  expect(authenticate).not.toHaveBeenCalled();
});
