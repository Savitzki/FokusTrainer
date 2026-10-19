import {
  Dumbbell,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  Trophy,
} from "lucide-react";
import BodyScale from "./BodyScale";
import { isGuestPage, pageHref, type Page } from "./navigation";

const ITEMS = [
  ["overview", LayoutDashboard, "Início"],
  ["workouts", Dumbbell, "Treinos"],
  ["social", Trophy, "Arena"],
  ["weight", BodyScale, "Peso"],
  ["shop", ShoppingBag, "Loja"],
  ["settings", Settings, "Configurações"],
] as const;

export default function AppNavigation({
  page,
  authenticated,
  onNavigate,
}: {
  page: Page;
  authenticated: boolean;
  onNavigate: (page: Page) => void;
}) {
  return (
    <aside className="sidebar">
      <nav aria-label="Menu principal">
        {ITEMS.filter(([id]) => authenticated || isGuestPage(id)).map(
          ([id, Icon, label]) => (
            <a
              key={id}
              href={pageHref(id)}
              className={`nav-item ${page === id ? "active" : ""}`}
              aria-label={label}
              title={label}
              aria-current={page === id ? "page" : undefined}
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                event.preventDefault();
                onNavigate(id);
              }}
            >
              <Icon size={24} aria-hidden="true" />
              {(page === id || !authenticated) && (
                <span className="nav-label" aria-hidden="true">
                  {id === "settings" ? "Ajustes" : label}
                </span>
              )}
            </a>
          ),
        )}
      </nav>
    </aside>
  );
}
