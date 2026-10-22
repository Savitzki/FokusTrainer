import { describe, expect, it, vi } from "vitest";
import { loginWithNickname } from "../supabase/functions/login-with-nickname/core";
const request = (body: unknown = { nickname: "@Dani", password: "password" }) =>
  new Request("https://example.invalid/login-with-nickname", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
function deps() {
  return {
    allow: vi.fn().mockResolvedValue(true),
    resolve: vi
      .fn()
      .mockResolvedValue({ allowed: true, email: "private@example.invalid" }),
    authenticate: vi
      .fn()
      .mockResolvedValue({
        ok: true,
        access_token: "access",
        refresh_token: "refresh",
      }),
  };
}
describe("autenticação de nick no servidor", () => {
  it("só devolve tokens depois de validar senha no Auth e nunca devolve o e-mail resolvido", async () => {
    const services = deps();
    const response = await loginWithNickname(request(), services);
    expect(services.resolve).toHaveBeenCalledExactlyOnceWith("Dani");
    expect(services.authenticate).toHaveBeenCalledExactlyOnceWith(
      "private@example.invalid",
      "password",
    );
    expect(await response.json()).toEqual({
      access_token: "access",
      refresh_token: "refresh",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each(["unknown", "wrong-password"])(
    "%s não revela e-mail nem detalhes do provedor",
    async (kind) => {
      const services = deps();
      if (kind === "unknown")
        services.resolve.mockResolvedValue({ allowed: true, email: null });
      else
        services.authenticate.mockResolvedValue({
          ok: false,
          code: "raw_private_error",
          email: "private@example.invalid",
        });
      const response = await loginWithNickname(request(), services);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ code: "invalid_credentials" });
      if (kind === "unknown")
        expect(services.authenticate).not.toHaveBeenCalled();
    },
  );
  it("respeita a cota compartilhada antes de chamar o Auth", async () => {
    const services = deps();
    services.resolve.mockResolvedValue({ allowed: false, email: null });
    const response = await loginWithNickname(request(), services);
    expect(response.status).toBe(429);
    expect(services.authenticate).not.toHaveBeenCalled();
  });
  it.each([
    "email_not_confirmed",
    "user_banned",
    "captcha_failed",
    "over_request_rate_limit",
  ])("preserva a restrição de Auth %s", async (code) => {
    const services = deps();
    services.authenticate.mockResolvedValue({ ok: false, code });
    const response = await loginWithNickname(request(), services);
    expect(await response.json()).toEqual({ code });
    expect(response.status).toBe(
      code === "over_request_rate_limit" ? 429 : 401,
    );
  });
  it.each([
    { nickname: "bad name", password: "x" },
    { nickname: "@aa", password: "x" },
    { nickname: "Dani", password: "" },
    { nickname: "Dani", password: "x".repeat(129) },
    null,
  ])("recusa entrada inválida sem consultar contas: %j", async (body) => {
    const services = deps();
    expect((await loginWithNickname(request(body), services)).status).toBe(400);
    expect(services.resolve).not.toHaveBeenCalled();
  });
  it("trata CORS, método, JSON e indisponibilidade sem devolver segredos", async () => {
    const services = deps();
    expect(
      (
        await loginWithNickname(
          new Request("https://example.invalid", { method: "OPTIONS" }),
          services,
        )
      ).status,
    ).toBe(204);
    expect(
      (
        await loginWithNickname(
          new Request("https://example.invalid"),
          services,
        )
      ).status,
    ).toBe(405);
    expect(
      (
        await loginWithNickname(
          new Request("https://example.invalid", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{",
          }),
          services,
        )
      ).status,
    ).toBe(400);
    services.resolve.mockRejectedValue(
      new Error("secret-service-key-private@example.invalid"),
    );
    const response = await loginWithNickname(request(), services);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: "nickname_login_unavailable",
    });
  });
});
