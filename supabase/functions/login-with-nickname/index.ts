import { loginWithNickname } from "./core.ts";
import { loginSourceBucket } from "./limit.ts";
const required = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
const url = required("SUPABASE_URL"),
  serviceKey = required("SUPABASE_SERVICE_ROLE_KEY"),
  anonKey = required("SUPABASE_ANON_KEY");
Deno.serve((request) =>
  loginWithNickname(request, {
    allow: async () => {
      const response = await fetch(`${url}/rest/v1/rpc/claim_nickname_login_budget`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_source: await loginSourceBucket(request, serviceKey) }),
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error("Login protection unavailable");
      return (await response.json()) === true;
    },
    resolve: async (nickname) => {
      const response = await fetch(`${url}/rest/v1/rpc/begin_nickname_login`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_nickname: nickname }),
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error("Nickname lookup unavailable");
      return await response.json();
    },
    authenticate: async (email, password) => {
      const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      });
      if (response.status >= 500) throw new Error("Auth unavailable");
      const result = await response.json();
      return {
        ok: response.ok,
        code: result.error_code ?? result.code,
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      };
    },
  }),
);
