import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { shouldPrecache } from "./offline-assets.mjs";

test("all themed installation icons exist at new physical URLs and are cached offline", () => {
  for (const name of [
    "manifest.webmanifest",
    "manifest-light.webmanifest",
    "manifest-dark.webmanifest",
  ]) {
    const manifest = JSON.parse(
      readFileSync(new URL(`../public/${name}`, import.meta.url), "utf8"),
    );
    for (const { src } of manifest.icons) {
      assert.match(src, /^icons\/capibora-orange-v3-.+\.png$/);
      assert.ok(existsSync(new URL(`../public/${src}`, import.meta.url)), src);
      assert.equal(shouldPrecache(src), true);
    }
  }
});

test("keeps the complete offline shell, including lazy chunks and installation metadata", () => {
  for (const name of [
    "index.html",
    "assets/main.js",
    "assets/arena.js",
    "assets/app.css",
    "manifest.webmanifest",
    "manifest-light.webmanifest",
    "icons/icon-192.png",
    "icons/capibora-orange-v3-192.png",
    "icons/capibora-orange-v3-512.png",
    "icons/capibora-orange-v3-maskable.png",
    "icons/capibora-orange-v3-apple.png",
    "icons/capibora-orange-v3.svg",
    "icons/notification-badge.png",
    "brand/web/logo-capibora-sem-fundo.webp",
  ])
    assert.equal(shouldPrecache(name), true, name);
});
test("includes delivery copies of cosmetics, economy icons and mascot expressions", () => {
  for (const name of [
    "images/web/capiwhey.webp",
    "images/shop/frames/web/onda-aquatica.webp",
    "images/shop/banners/web/noite.webp",
    "mascot/web/julgando.webp",
    "mascot/web/capi-sosa.webp",
    "images/web/capi-group.webp",
  ])
    assert.equal(shouldPrecache(name), true, name);
});
test("does not eagerly download originals, unused medals, or legacy assets", () => {
  for (const name of [
    "images/achievements/medalha.png",
    "images/capiwhey.png",
    "images/shop/frames/onda-aquatica.png",
    "images/shop/frames/beast.webp",
    "mascot/neutro.png",
    "brand/capibora-app-icon.png",
    "thunder.png",
    "sw.js",
    "brand/README.md",
  ])
    assert.equal(shouldPrecache(name), false, name);
});
