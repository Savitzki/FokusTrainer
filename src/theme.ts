export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "fokus-trainer:theme";
export const MANIFEST_CHANGED_EVENT = "fokus-manifest-changed";

/** Match the native launch surface until the single startup screen is dismissed. */
export function syncBrowserTheme() {
  const root = document.documentElement;
  const background = root.hasAttribute("data-capibora-opening")
    ? "#ee701d"
    : root.dataset.theme === "light"
      ? "#faf8f5"
      : "#121212";
  root.style.backgroundColor = background;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", background);
}

export function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  syncBrowserTheme();
  document
    .querySelector('meta[name="color-scheme"]')
    ?.setAttribute("content", theme);
  const manifest = document.querySelector<HTMLLinkElement>(
    'link[rel="manifest"]',
  );
  if (manifest) {
    const href = new URL(
      theme === "dark" ? "manifest.webmanifest" : "manifest-light.webmanifest",
      manifest.href,
    ).href;
    if (manifest.href !== href) {
      manifest.href = href;
      window.dispatchEvent(new Event(MANIFEST_CHANGED_EVENT));
    }
  }
  document
    .querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
    ?.setAttribute(
      "content",
      theme === "dark" ? "black-translucent" : "default",
    );
}

export function initializeTheme() {
  applyTheme(readTheme());
  window.addEventListener("storage", (event) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null)
      applyTheme(readTheme());
  });
}
