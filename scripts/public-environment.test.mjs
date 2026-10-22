import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPublicEnvironment } from "./public-environment.mjs";

const jwt = (role) => `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
test("public configuration accepts publishable keys, anon JWTs and public VAPID", () => {
  assertPublicEnvironment({ VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example", VITE_VAPID_PUBLIC_KEY: "public", VITE_OTHER: jwt("anon"), DATABASE_PASSWORD: "server-only" });
});
test("private credentials are rejected in every VITE variable without disclosing values", () => {
  for (const [name, value] of Object.entries({
    VITE_SUPABASE_SERVICE_ROLE_KEY: "server-only",
    VITE_VAPID_PRIVATE_KEY: "server-only",
    VITE_DATABASE_URL: "postgres://private",
    VITE_ACCESS_TOKEN: "server-only",
    VITE_OTHER: jwt("service_role"),
    VITE_WRONG_PUBLIC_KEY: "sb_secret_server-only",
  })) {
    assert.throws(() => assertPublicEnvironment({ [name]: value }), (error) => error.message.includes(name) && !error.message.includes(value));
  }
});
