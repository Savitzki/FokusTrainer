import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldPrecache } from "./offline-assets.mjs";

test("keeps the complete offline shell, including lazy chunks and installation metadata", () => {
  for (const name of [
    "index.html",
    "assets/main.js",
    "assets/arena.js",
    "assets/app.css",
    "manifest.webmanifest",
    "manifest-light.webmanifest",
    "icons/icon-192.png",
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
