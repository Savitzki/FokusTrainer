import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { secureHtml } from "./security-policy.mjs";

test("policy hashes exact startup scripts and narrowly allows stylesheet handlers", () => {
  const code = '\nwindow.boot = true;\n';
  const html = secureHtml(`<meta charset="UTF-8" /><script>${code}</script><script src="./app.js"></script><link onload="this.media='all'">`, "https://example.supabase.co/");
  assert.ok(html.includes(createHash("sha256").update(code).digest("base64")));
  assert.match(html, /script-src 'self' 'sha256-[^;]+;/);
  assert.doesNotMatch(html, /script-src[^;]*'unsafe-(inline|eval)'/);
  assert.match(html, /script-src-attr 'unsafe-hashes' 'sha256-/);
  assert.match(html, /https:\/\/example.supabase.co wss:\/\/example.supabase.co/);
  assert.match(html, /img-src 'self' data: blob:/);
  assert.match(html, /object-src 'none'/);
  assert.match(html, /name="referrer" content="no-referrer"/);
});
test("relative hosting works without backend and insecure backend config fails", () => {
  assert.match(secureHtml('<meta charset="UTF-8" />'), /connect-src 'self';/);
  assert.throws(() => secureHtml('<meta charset="UTF-8" />', 'http://untrusted.invalid'), /HTTPS/);
});
