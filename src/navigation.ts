import { useEffect, useState } from "react";
export const PAGE_PATHS = {
  overview: "/",
  workouts: "/treinos",
  weight: "/peso",
  social: "/arena",
  shop: "/loja",
  settings: "/configuracoes",
} as const;
export type Page = keyof typeof PAGE_PATHS;
export const pageHref = (page: Page) => `#${PAGE_PATHS[page]}`;
export function readPage(): Page {
  const path = window.location.hash.slice(1).split("?")[0];
  if (["/avisos", "avisos", "reminders", "/settings"].includes(path))
    return "settings";
  if (["/juntos", "juntos"].includes(path)) return "social";
  const match = (Object.keys(PAGE_PATHS) as Page[]).find(
    (page) => PAGE_PATHS[page] === path || page === path,
  );
  // Auth callbacks use the fragment too. Never rewrite an unknown fragment:
  // Supabase must be able to finish reading its session or error parameters.
  return match ?? "overview";
}
export function usePageNavigation() {
  const [page, setPage] = useState(readPage);
  useEffect(() => {
    const update = () => setPage(readPage());
    window.addEventListener("popstate", update);
    window.addEventListener("hashchange", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("hashchange", update);
    };
  }, []);
  function navigate(next: Page) {
    const url = new URL(window.location.href);
    url.hash = pageHref(next);
    if (url.href !== window.location.href)
      window.history.pushState(null, "", url.href);
    setPage(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  return { page, navigate };
}
