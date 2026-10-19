import lightManifest from "../public/manifest-light.webmanifest?raw";
import darkManifest from "../public/manifest-dark.webmanifest?raw";
import defaultManifest from "../public/manifest.webmanifest?raw";
import { afterEach, beforeEach, expect, it } from "vitest";
import { applyTheme } from "./theme";

let nodes: Element[] = [];
beforeEach(() => {
  window.history.replaceState(null, "", "/FokusTrainer/");
  const manifest = document.createElement("link");
  manifest.rel = "manifest";
  manifest.href = "./manifest.webmanifest";
  nodes = [
    manifest,
    ...["theme-color", "color-scheme"].map((name) => {
      const meta = document.createElement("meta");
      meta.name = name;
      return meta;
    }),
  ];
  document.head.append(...nodes);
});
afterEach(() => nodes.forEach((node) => node.remove()));

it("troca a configuração de instalação junto com a aparência e preserva o diretório do GitHub Pages", () => {
  const manifest = nodes[0] as HTMLLinkElement;
  applyTheme("dark");
  expect(new URL(manifest.href).pathname).toBe(
    "/FokusTrainer/manifest.webmanifest",
  );
  expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#121212",
  );
  expect(document.querySelector('meta[name="color-scheme"]')).toHaveAttribute(
    "content",
    "dark",
  );
  expect(document.documentElement.style.colorScheme).toBe("dark");
  expect(document.documentElement.style.backgroundColor).toBe(
    "rgb(18, 18, 18)",
  );
  applyTheme("light");
  expect(new URL(manifest.href).pathname).toBe(
    "/FokusTrainer/manifest-light.webmanifest",
  );
  expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#faf8f5",
  );
  expect(document.querySelector('meta[name="color-scheme"]')).toHaveAttribute(
    "content",
    "light",
  );
  expect(document.documentElement.style.colorScheme).toBe("light");
  expect(document.documentElement.style.backgroundColor).toBe(
    "rgb(250, 248, 245)",
  );
});

it("os manifestos preservam a identidade, as barras do tema e a abertura laranja nos dois modos", () => {
  const light = JSON.parse(lightManifest);
  const dark = JSON.parse(darkManifest);
  expect(dark).toEqual({
    ...light,
    theme_color: "#121212",
    background_color: "#ee701d",
  });
  expect(JSON.parse(defaultManifest)).toEqual(dark);
  expect(dark.display).toBe("standalone");
  expect(light.background_color).toBe("#ee701d");
  expect(light.theme_color).toBe("#faf8f5");
  expect(
    new URL(
      dark.id,
      "https://example.invalid/FokusTrainer/manifest-dark.webmanifest",
    ).href,
  ).toBe(
    new URL(
      light.id,
      "https://example.invalid/FokusTrainer/manifest-light.webmanifest",
    ).href,
  );
});
