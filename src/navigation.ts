import { useEffect, useState } from "react";
export const PAGE_PATHS = {
  overview: "/",
  workouts: "/treinos",
  weight: "/peso",
  social: "/arena",
  shop: "/loja",
  settings: "/configuracoes",
  session: "/treino-em-andamento",
  profile: "/perfil",
  achievements: "/conquistas",
} as const;
export type Page = keyof typeof PAGE_PATHS;
export type ArenaTab = "groups" | "friends" | "challenges";
export type ShopSection = "kits" | "molduras" | "banners";
type NavigationOptions = {
  tab?: ArenaTab;
  section?: ShopSection;
  group?: string;
  friend?: string;
  replace?: boolean;
  resetHistory?: boolean;
};
export const isGuestPage = (page: Page) =>
  page === "overview" || page === "workouts";
export const pageHref = (page: Page) => `#${PAGE_PATHS[page]}`;
function resolvePage(path: string): Page | null {
  if (path === "") return "overview";
  if (["/avisos", "avisos", "reminders", "/settings"].includes(path))
    return "settings";
  if (["/juntos", "juntos"].includes(path)) return "social";
  const match = (Object.keys(PAGE_PATHS) as Page[]).find(
    (page) => PAGE_PATHS[page] === path || page === path,
  );
  return match ?? null;
}
export function readPage(): Page {
  // Auth callbacks use the fragment too. Never rewrite an unknown fragment:
  // Supabase must be able to finish reading its session or error parameters.
  return resolvePage(window.location.hash.slice(1).split("?")[0]) ?? "overview";
}
export function readDestination() {
  const params = new URLSearchParams(window.location.hash.split("?")[1]);
  const page = readPage(),
    tab = params.get("aba"),
    section = params.get("secao");
  return {
    page,
    arenaTab:
      page === "social" &&
      ["groups", "friends", "challenges"].includes(tab ?? "")
        ? (tab as ArenaTab)
        : null,
    shopSection:
      page === "shop" && ["kits", "molduras", "banners"].includes(section ?? "")
        ? (section as ShopSection)
        : null,
    arenaGroup:
      page === "social" && tab === "groups" ? params.get("grupo") : null,
    arenaFriend:
      page === "social" && tab === "friends" ? params.get("amigo") : null,
  };
}
export function usePageNavigation(guest = false) {
  const [destination, setDestination] = useState(readDestination);
  const requestedPage = destination.page;
  // Resolve before render: a restricted page never mounts for a visitor.
  const page =
    guest && !isGuestPage(requestedPage) ? "overview" : requestedPage;
  useEffect(() => {
    if (page === requestedPage) return;
    const url = new URL(window.location.href);
    url.hash = pageHref(page);
    window.history.replaceState(null, "", url.href);
    setDestination(readDestination());
  }, [page, requestedPage]);
  useEffect(() => {
    const update = () => setDestination(readDestination());
    window.addEventListener("popstate", update);
    window.addEventListener("hashchange", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("hashchange", update);
    };
  }, []);
  function navigate(requested: Page, options: NavigationOptions = {}) {
    const next = guest && !isGuestPage(requested) ? "overview" : requested;
    const url = new URL(window.location.href);
    url.hash = pageHref(next);
    const params = new URLSearchParams();
    if (next === "social" && options.tab) params.set("aba", options.tab);
    if (next === "social" && options.tab === "groups" && options.group)
      params.set("grupo", options.group);
    if (next === "social" && options.tab === "friends" && options.friend)
      params.set("amigo", options.friend);
    if (next === "shop" && options.section)
      params.set("secao", options.section);
    if (params.size) url.hash += `?${params}`;
    if (url.href !== window.location.href) {
      if (options.replace)
        window.history.replaceState(
          !options.resetHistory &&
            window.history.state?.capiboraAt === window.location.href
            ? { ...window.history.state, capiboraAt: url.href }
            : { capiboraAt: url.href },
          "",
          url.href,
        );
      else
        window.history.pushState(
          { capiboraFrom: window.location.href, capiboraAt: url.href },
          "",
          url.href,
        );
    }
    setDestination(readDestination());
    // Friend details are an overlay on the roster, so opening them preserves its scroll.
    if (!(next === "social" && options.friend && destination.page === "social"))
      window.scrollTo({ top: 0, behavior: "instant" });
  }
  function goBack(_fallback: Page = "overview") {
    const from = window.history.state?.capiboraFrom;
    if (
      typeof from === "string" &&
      window.history.state?.capiboraAt === window.location.href
    ) {
      try {
        const url = new URL(from);
        if (
          url.origin === window.location.origin &&
          url.pathname === window.location.pathname &&
          url.search === window.location.search &&
          resolvePage(url.hash.slice(1).split("?")[0]) !== null
        ) {
          window.history.back();
          return;
        }
      } catch {
        /* A direct entry has no trusted in-app predecessor. */
      }
    }
    // Clear provenance: retaining it here would turn a direct-entry fallback into a loop.
    navigate("overview", { replace: true, resetHistory: true });
  }
  return {
    page,
    navigate,
    goBack,
    arenaTab: destination.arenaTab,
    arenaGroup: destination.arenaGroup,
    arenaFriend: destination.arenaFriend,
    shopSection: destination.shopSection,
  };
}
