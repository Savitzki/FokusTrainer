import Brand from "./Brand";
import { UserRound } from "lucide-react";
import { Avatar } from "./ProfilePanel";
import CapiWheyToken from "./CapiWheyToken";
import { pageHref } from "./navigation";
import type { Profile } from "./profile";

const compactNumber = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** The same header and interactions on every destination, including Home. */
export default function AppHeader({
  profile,
  frameId,
  balance,
  authenticated,
  currentStreak,
  recordStreak,
  trained,
  protectedDay,
  onHome,
  onStreak,
  onShop,
  onProfile,
}: {
  profile: Profile | null;
  frameId?: string;
  balance: number | null;
  authenticated: boolean;
  currentStreak: number;
  recordStreak: number;
  trained: boolean;
  protectedDay: boolean;
  onHome: () => void;
  onStreak: () => void;
  onShop: () => void;
  onProfile: () => void;
}) {
  return (
    <header className="topbar">
      <a
        href={pageHref("overview")}
        className="brand"
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
          onHome();
        }}
        aria-label="Capibora, início"
      >
        <Brand />
      </a>
      <div className="topbar-actions">
        <button
          className="header-streak status-chip"
          aria-label={`${currentStreak} ${currentStreak === 1 ? "dia" : "dias"} de ofensiva · Ver calendário`}
          title={`Recorde: ${recordStreak} dias`}
          onClick={onStreak}
        >
          <StreakFlame lit={trained} protectedDay={protectedDay} />
          <span
            aria-label={`${currentStreak} ${currentStreak === 1 ? "dia" : "dias"} de ofensiva`}
          >
            {new Intl.NumberFormat("pt-BR", {
              notation: "compact",
              maximumFractionDigits: 1,
            }).format(currentStreak)}
          </span>
        </button>
        <button
          className="coin-balance status-chip"
          aria-label={
            balance !== null
              ? `${balance.toLocaleString("pt-BR")} CapiWhey · Ver loja e kits`
              : "CapiWhey · Ver loja e kits"
          }
          onClick={onShop}
        >
          <CapiWheyToken />
          <span className="header-balance-value">
            <strong>
              {balance !== null
                ? new Intl.NumberFormat("pt-BR", {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(balance)
                : authenticated
                  ? "—"
                  : "0"}
            </strong>
          </span>
        </button>
        <button
          className="profile-button"
          aria-label={
            profile ? `Editar perfil de ${profile.nickname}` : "Criar perfil"
          }
          onClick={onProfile}
        >
          {profile ? (
            <Avatar profile={profile} frame={frameId} />
          ) : (
            <UserRound size={22} />
          )}
        </button>
      </div>
    </header>
  );
}

function StreakFlame({
  lit,
  protectedDay,
}: {
  lit: boolean;
  protectedDay: boolean;
}) {
  return (
    <svg
      className={`streak-flame ${lit ? "is-lit" : ""}`}
      viewBox="0 0 120 145"
      role="img"
      aria-label={
        lit
          ? "Chama acesa: treino confirmado hoje"
          : protectedDay
            ? "Dia de descanso: sua ofensiva está protegida"
            : "Chama apagada: treino de hoje pendente"
      }
    >
      <path
        className="flame-outer"
        d="M64 6c21 28 6 42 24 53 4-7 5-13 4-21 21 25 28 50 15 74-10 19-28 27-48 27-30 0-50-18-50-44 0-39 43-53 55-89Z"
      />
      <path
        className="flame-inner"
        d="M60 65c13 17 6 24 17 33 2-4 4-7 5-12 13 25 3 40-20 40-25 0-33-25-2-61Z"
      />
    </svg>
  );
}
