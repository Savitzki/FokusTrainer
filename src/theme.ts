export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "fokus-trainer:theme";

export function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const background = theme === "dark" ? "#181411" : "#faf8f5";
  document.documentElement.style.backgroundColor = background;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", background);
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
