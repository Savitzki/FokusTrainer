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
afterEach(() => {
  nodes.forEach((node) => node.remove());
  document.documentElement.removeAttribute("data-capibora-opening");
});

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

it("os manifestos mantêm todos os fundos nativos na cor do tema, sem laranja", () => {
  const light = JSON.parse(lightManifest);
  const dark = JSON.parse(darkManifest);
  expect(dark).toEqual({
    ...light,
    theme_color: "#121212",
    background_color: "#121212",
  });
  expect(JSON.parse(defaultManifest)).toEqual(dark);
  expect(dark.display).toBe("standalone");
  expect(dark.background_color).toBe(dark.theme_color);
  expect(light.background_color).toBe(light.theme_color);
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

it.each(["dark", "light"] as const)(
  "preserva as barras do tema %s durante e depois do carregamento",
  (theme) => {
    for (const opening of [true, false]) {
      document.documentElement.toggleAttribute(
        "data-capibora-opening",
        opening,
      );
      applyTheme(theme);
      expect(document.documentElement.dataset.theme).toBe(theme);
      expect(document.documentElement.style.colorScheme).toBe(theme);
      expect(document.documentElement.style.backgroundColor).toBe(
        theme === "dark" ? "rgb(18, 18, 18)" : "rgb(250, 248, 245)",
      );
      expect(
        document.querySelector('meta[name="theme-color"]'),
      ).toHaveAttribute("content", theme === "dark" ? "#121212" : "#faf8f5");
    }
  },
);
