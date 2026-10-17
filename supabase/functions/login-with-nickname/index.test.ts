import { strict as assert } from "node:assert";
Deno.test(
  "nickname login uses a private resolver and public Auth; only verified tokens leave the Edge function",
  async () => {
    let authCalls = 0;
    const originalServe = Deno.serve;
    const upstream = originalServe(
      { hostname: "127.0.0.1", port: 0, onListen: () => {} },
      async (request) => {
        const path = new URL(request.url).pathname;
        const body = await request.json();
        if (path === "/rest/v1/rpc/begin_nickname_login") {
          assert.equal(request.headers.get("apikey"), "test-service-only");
          assert.equal(
            request.headers.get("authorization"),
            "Bearer test-service-only",
          );
          return Response.json({
            allowed: body.p_nickname !== "Blocked",
            email:
              body.p_nickname === "Missing" ? null : "private@example.invalid",
          });
        }
        assert.equal(path, "/auth/v1/token");
        assert.equal(request.headers.get("apikey"), "test-public-key");
        assert.equal(body.email, "private@example.invalid");
        authCalls++;
        if (body.password !== "correct-password")
          return Response.json(
            {
              error_code: "invalid_credentials",
              message: "private@example.invalid must not leak",
            },
            { status: 400 },
          );
        return Response.json({
          access_token: "verified-access",
          refresh_token: "verified-refresh",
          user: { email: "private@example.invalid" },
        });
      },
    );
    const values = {
      SUPABASE_URL: `http://127.0.0.1:${upstream.addr.port}`,
      SUPABASE_SERVICE_ROLE_KEY: "test-service-only",
      SUPABASE_ANON_KEY: "test-public-key",
    };
    const previous = Object.fromEntries(
      Object.keys(values).map((key) => [key, Deno.env.get(key)]),
    );
    let edge: Deno.HttpServer<Deno.NetAddr> | undefined;
    try {
      for (const [key, value] of Object.entries(values))
        Deno.env.set(key, value);
      Object.assign(Deno, {
        serve: (handler: Deno.ServeHandler) => {
          edge = originalServe(
            { hostname: "127.0.0.1", port: 0, onListen: () => {} },
            handler,
          );
          return edge;
        },
      });
      await import("./index.ts");
      assert.ok(edge);
      const call = (nickname: string, password: string) =>
        fetch(`http://127.0.0.1:${edge!.addr.port}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nickname, password }),
        });
      const success = await call("@Dani", "correct-password");
      assert.equal(success.status, 200);
      assert.equal(success.headers.get("cache-control"), "no-store");
      assert.deepEqual(await success.json(), {
        access_token: "verified-access",
        refresh_token: "verified-refresh",
      });
      const denied = await call("Dani", "wrong-password");
      assert.equal(denied.status, 401);
      assert.deepEqual(await denied.json(), { code: "invalid_credentials" });
      const missing = await call("Missing", "any-password");
      assert.equal(missing.status, 401);
      assert.deepEqual(await missing.json(), { code: "invalid_credentials" });
      const blocked = await call("Blocked", "any-password");
      assert.equal(blocked.status, 429);
      await blocked.body?.cancel();
      assert.equal(authCalls, 2);
    } finally {
      Object.assign(Deno, { serve: originalServe });
      await edge?.shutdown();
      await upstream.shutdown();
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) Deno.env.delete(key);
        else Deno.env.set(key, value);
      }
    }
  },
);
