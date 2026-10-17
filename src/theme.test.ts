import lightManifest from "../public/manifest.webmanifest?raw";
import darkManifest from "../public/manifest-dark.webmanifest?raw";
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
    "/FokusTrainer/manifest-dark.webmanifest",
  );
  expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#181411",
  );
  expect(document.querySelector('meta[name="color-scheme"]')).toHaveAttribute(
    "content",
    "dark",
  );
  applyTheme("light");
  expect(new URL(manifest.href).pathname).toBe(
    "/FokusTrainer/manifest.webmanifest",
  );
  expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#faf8f5",
  );
  expect(document.querySelector('meta[name="color-scheme"]')).toHaveAttribute(
    "content",
    "light",
  );
});

it("as duas instalações identificam o mesmo aplicativo e mudam somente as cores", () => {
  const light = JSON.parse(lightManifest);
  const dark = JSON.parse(darkManifest);
  expect(dark).toEqual({
    ...light,
    theme_color: "#181411",
    background_color: "#181411",
  });
  expect(dark.display).toBe("standalone");
  expect(
    new URL(
      dark.id,
      "https://example.invalid/FokusTrainer/manifest-dark.webmanifest",
    ).href,
  ).toBe(
    new URL(
      light.id,
      "https://example.invalid/FokusTrainer/manifest.webmanifest",
    ).href,
  );
});
