import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Dumbbell,
  Flame,
  Moon,
  X,
} from "lucide-react";
import type { Account } from "./account";
import AccountForm from "./AccountForm";
import AppHeader from "./AppHeader";
import AppNavigation from "./AppNavigation";
import CapiboraMessage from "./CapiboraMessage";
import { capiboraMessage } from "./capiboraVoice";
import Modal from "./Modal";
import PageHeading from "./PageHeading";
import { usePageNavigation } from "./navigation";
import { WEEKDAYS } from "./training";

const DEMO_DAYS = [1, 3, 5];
const SHORT_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Read-only introduction: no personal-data hooks, storage writes or simulated workouts. */
export default function GuestExperience({
  account,
  opening,
  onReady,
}: {
  account: Account;
  opening: boolean;
  onReady: () => void;
}) {
  const { page, navigate } = usePageNavigation(true);
  const [authOpen, setAuthOpen] = useState(false);
  const main = useRef<HTMLElement>(null);
  useEffect(onReady, [onReady]);
  useEffect(() => {
    setAuthOpen(false);
    main.current
      ?.querySelector<HTMLElement>("h1")
      ?.focus({ preventScroll: true });
  }, [page, opening]);
  if (opening) return null;
  return (
    <div className="app-shell" data-mode="guest" data-page={page}>
      <AppHeader
        authenticated={false}
        onHome={() => navigate("overview")}
      />
      <AppNavigation authenticated={false} page={page} onNavigate={navigate} />
      <main id="main-content" ref={main} aria-labelledby="page-title">
        <div className="page-content guest-content">
          {account.authNotice && (
            <div className="auth-return-notice" role="alert">
              <span>{account.authNotice}</span>
              <button
                className="icon-button"
                aria-label="Fechar aviso de entrada"
                onClick={account.dismissAuthNotice}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {page === "overview" ? (
            <>
              <section className="guest-intro" aria-label="Conheça o Capibora">
                <CapiboraMessage
                  message={capiboraMessage("guest-intro")}
                  variant="centered"
                  heading="h1"
                  titleId="page-title"
                  size={230}
                />
                <button
                  className="primary-button guest-primary"
                  onClick={() => setAuthOpen(true)}
                >
                  Começar agora <ArrowRight size={19} aria-hidden="true" />
                </button>
              </section>
              <ul
                className="guest-benefits"
                aria-label="O que você encontra no Capibora"
              >
                {(
                  [
                    [CalendarDays, "Planeje seus treinos"],
                    [Activity, "Registre sua evolução"],
                    [Flame, "Mantenha sua ofensiva"],
                  ] as const
                ).map(([BenefitIcon, label]) => {
                  return (
                    <li key={label}>
                      <BenefitIcon size={23} aria-hidden="true" />
                      <span>{label}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <section className="guest-workouts">
              <PageHeading title="Treinos" icon={Dumbbell} />
              <div
                className="card guest-plan"
                role="region"
                aria-labelledby="guest-plan-heading"
              >
                <div className="guest-plan-heading">
                  <h2 id="guest-plan-heading">Meu plano semanal</h2>
                  <span>Demonstração</span>
                </div>
                <p>Uma semana do seu jeito</p>
                <ol
                  className="guest-training-week"
                  aria-label="Semana de demonstração"
                >
                  {WEEKDAYS.map((day, index) => {
                    const training = DEMO_DAYS.includes(index + 1),
                      Icon = training ? Dumbbell : Moon;
                    return (
                      <li
                        key={day}
                        className={training ? "is-training" : "is-rest"}
                        aria-label={`${day}: ${training ? "treino" : "descanso"}`}
                      >
                        <span>{SHORT_DAYS[index]}</span>
                        <Icon size={19} aria-hidden="true" />
                      </li>
                    );
                  })}
                </ol>
                <p className="guest-plan-summary">
                  3 dias de treino · 4 dias de descanso
                </p>
              </div>
              <button
                className="primary-button guest-primary"
                onClick={() => setAuthOpen(true)}
              >
                Começar agora <ArrowRight size={19} aria-hidden="true" />
              </button>
            </section>
          )}
        </div>
      </main>
      {authOpen && (
        <Modal
          title="Sua conta Capibora"
          compactHeader
          onClose={() => setAuthOpen(false)}
        >
          <AccountForm
            account={account}
            profile={null}
            onSignedIn={() => {
              navigate("overview");
              setAuthOpen(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
