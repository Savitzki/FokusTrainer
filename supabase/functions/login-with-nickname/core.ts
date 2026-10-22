import { readLimitedJson } from "../_shared/request-json.ts";

type Dependencies = {
  allow: () => Promise<boolean>;
  resolve: (
    nickname: string,
  ) => Promise<{ allowed: boolean; email: string | null }>;
  authenticate: (
    email: string,
    password: string,
  ) => Promise<{
    ok: boolean;
    code?: string;
    access_token?: string;
    refresh_token?: string;
  }>;
};
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
export async function loginWithNickname(
  request: Request,
  deps: Dependencies,
): Promise<Response> {
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: cors });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return reply({ code: "invalid_request" }, 405);
  try {
    if (
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    )
      return reply({ code: "invalid_request" }, 400);
    let body;
    try {
      body = await readLimitedJson(request, 4096) as {
        nickname?: unknown;
        password?: unknown;
      } | null;
    } catch {
      return reply({ code: "invalid_request" }, 400);
    }
    if (
      typeof body?.nickname !== "string" ||
      typeof body?.password !== "string"
    )
      return reply({ code: "invalid_request" }, 400);
    const nickname = body.nickname.normalize("NFKC").trim().replace(/^@/, "");
    if (
      !/^[\p{L}\p{N}_.-]{3,24}$/u.test(nickname) ||
      body.password.length < 1 ||
      body.password.length > 128
    )
      return reply({ code: "invalid_request" }, 400);
    if (!(await deps.allow()))
      return Response.json({ code: "over_request_rate_limit" }, {
        status: 429, headers: { ...cors, "Retry-After": "60" },
      });
    const resolved = await deps.resolve(nickname);
    if (!resolved.allowed)
      return reply({ code: "over_request_rate_limit" }, 429);
    if (!resolved.email) return reply({ code: "invalid_credentials" }, 401);
    const result = await deps.authenticate(resolved.email, body.password);
    if (!result.ok) {
      const code = [
        "email_not_confirmed",
        "user_banned",
        "captcha_failed",
        "over_request_rate_limit",
      ].includes(result.code ?? "")
        ? result.code!
        : "invalid_credentials";
      return reply({ code }, code === "over_request_rate_limit" ? 429 : 401);
    }
    if (
      typeof result.access_token !== "string" ||
      !result.access_token ||
      typeof result.refresh_token !== "string" ||
      !result.refresh_token
    )
      return reply({ code: "nickname_login_unavailable" }, 503);
    // Only a verified password can produce tokens. Never return the resolved email.
    return reply({
      access_token: result.access_token,
      refresh_token: result.refresh_token,
    });
  } catch {
    // Do not log request bodies, passwords, tokens or raw Auth/backend errors.
    return reply({ code: "nickname_login_unavailable" }, 503);
  }
}
