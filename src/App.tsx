import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type MouseEvent,
} from "react";
import {
  Activity,
  Clock3,
  LockKeyhole,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Settings,
  ShoppingBag,
  Palette,
  Moon,
  BriefcaseMedical,
  Check,
  CheckCheck,
  Dumbbell,
  Flame,
  LayoutDashboard,
  Plus,
  Trophy,
  Share2,
  UserRound,
  X,
} from "lucide-react";
import {
  confirmWorkout,
  dueReminders,
  formatDay,
  formatKg,
  freshData,
  localDate,
  parseData,
  shiftDate,
  STORAGE_KEY,
  validDate,
  type Data,
  type Weight,
} from "./model";
import { notificationSupported, notify } from "./notifications";
import InstallApp from "./InstallApp";
import { useAccount, type Account } from "./account";
import ProfilePanel, { Avatar } from "./ProfilePanel";
import SharePanel from "./SharePanel";
import { useSocial } from "./social";
import SocialPanel from "./SocialPanel";
import PushPanel from "./PushPanel";
import { motivationFor, MOTIVATIONAL_PHRASES } from "./motivation";
import { useWeightSync } from "./useWeightSync";
import WeightSyncStatus from "./WeightSyncStatus";
import { weightOrder } from "./weightSync";
import FlameCelebration from "./FlameCelebration";
import WorkoutCalendar, { type CalendarView } from "./WorkoutCalendar";
import WeeklyTrainingProgress from "./WeeklyTrainingProgress";
import { pageHref, usePageNavigation, type Page } from "./navigation";
import { accountStorageGeneration } from "./accountStorage";
import GroupWorkoutPrompt from "./GroupWorkoutPrompt";
import { useDialogViewport } from "./useDialogViewport";
import { useTrainingPlan } from "./useTrainingPlan";
import { useEconomy } from "./useEconomy";
import EconomyPanel from "./EconomyPanel";
import ProteinToken from "./ProteinToken";
import BodyScale from "./BodyScale";
import { currencyAmount } from "./currency";
import { kitUsesRemaining } from "./economy";
import MedicalKitConfirmation from "./MedicalKitConfirmation";
import AppearanceSettings from "./AppearanceSettings";
import NotificationOptIn from "./NotificationOptIn";
import { useGamification } from "./useGamification";
import {
  AchievementsPanel,
  CosmeticShop,
  MissionPanel,
  WeeklyGoals,
  equippedItem,
} from "./GamificationPanels";
import ProgressReports from "./ProgressReports";
import ChallengesPanel from "./ChallengesPanel";
import {
  extraRestsRemaining,
  trainingDayKind,
  isTrainingDay,
  trainingStreak,
} from "./training";

const reminderText = {
  workout: {
    title: "Sua ofensiva está esperando por você 🔥",
    body: "Separe um tempo para se movimentar e registre seu treino de hoje.",
  },
  weight: {
    title: "Seu check-in do dia",
    body: "Que tal registrar seu peso? Acompanhe sua evolução, um dia de cada vez.",
  },
};

function readInitial(storageKey = STORAGE_KEY): { data: Data; error: string } {
  try {
    const raw = localStorage.getItem(storageKey);
    return { data: raw ? parseData(raw) : freshData(), error: "" };
  } catch {
    return {
      data: freshData(),
      error:
        "Não foi possível ler seus dados. O armazenamento não será sobrescrito. Verifique as permissões do navegador ou faça uma cópia dos dados antes de continuar.",
    };
  }
}

export default function App() {
  const account = useAccount();
  if (account.initializing)
    return (
      <div className="app-loading" role="status">
        Abrindo seu espaço…
      </div>
    );
  return <TrainerApp key={account.user?.id ?? "local"} account={account} />;
}

function TrainerApp({ account }: { account: Account }) {
  const storageKey = account.user
    ? `${STORAGE_KEY}:account:${account.user.id}`
    : STORAGE_KEY;
  const [initial] = useState(() => readInitial(storageKey));
  const [storageGeneration] = useState(() =>
    account.user ? accountStorageGeneration(account.user.id) : 0,
  );
  const [data, setData] = useState(initial.data);
  const [storageError, setStorageError] = useState(initial.error);
  const [now, setNow] = useState(() => new Date());
  const [phraseOffset] = useState(() =>
    Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length),
  );
  const [modal, setModal] = useState<
    | "workout"
    | "weight"
    | "profile"
    | "auth"
    | "share"
    | "group-notify"
    | "rest"
    | "notification-opt-in"
    | "kit"
    | "missions"
    | null
  >(null);
  const [toast, setToast] = useState("");
  const [reportsOpen, setReportsOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [newWorkoutDay, setNewWorkoutDay] = useState<string | null>(null);
  const [guestWeights] = useState(() =>
    account.user ? readInitial().data.weights : [],
  );
  const [permission, setPermission] = useState(() =>
    notificationSupported() ? Notification.permission : "unsupported",
  );
  const { page: active, navigate } = usePageNavigation();
  const mainRef = useRef<HTMLElement>(null);
  const [calendarView, setCalendarView] = useState<CalendarView>(() => ({
    month: localDate().slice(0, 7),
    day: localDate(),
  }));
  useEffect(() => {
    setModal(null);
    setNewWorkoutDay(null);
    window.scrollTo({ top: 0, behavior: "instant" });
    mainRef.current
      ?.querySelector<HTMLElement>("h1")
      ?.focus({ preventScroll: true });
  }, [active]);
  const training = useTrainingPlan(
    account.user?.id ?? null,
    Boolean(initial.error),
  );
  const economy = useEconomy(account.user?.id ?? null, Boolean(initial.error));
  // The account's server day is authoritative; device clock changes cannot reopen a day.
  const today = training.state?.today ?? localDate(now);
  const previousServerDay = useRef(localDate());
  useEffect(() => {
    if (!training.state) return;
    const next = training.state.today,
      previous = previousServerDay.current;
    setCalendarView((view) =>
      view.day === previous ? { month: next.slice(0, 7), day: next } : view,
    );
    previousServerDay.current = next;
  }, [training.state?.today]);
  const phraseIndex =
    (phraseOffset + Math.floor(Date.parse(`${today}T00:00:00Z`) / 86400000)) %
    MOTIVATIONAL_PHRASES.length;
  // Old guest records remain stored for recovery, but cannot become an account streak.
  const workouts = account.user ? data.workouts : [];
  const trained = workouts.some((w) => w.date === today);
  const todayWorkout = workouts.find((w) => w.date === today);
  const workoutTime = todayWorkout?.confirmedAt ?? todayWorkout?.recordedAt;
  const { current: currentStreak, best: recordStreak } = trainingStreak(
    workouts,
    training.state,
    today,
  );
  const todayKind = trainingDayKind(training.state, today);
  const canProtectToday = Boolean(
    account.user &&
      training.state &&
      isTrainingDay(todayKind) &&
      !trained &&
      !economy.state?.protections.some((p) => p.day === today),
  );
  const extraAvailable = training.state
    ? extraRestsRemaining(training.state, today)
    : 0;
  const kitUsesAvailable = economy.state
    ? kitUsesRemaining(economy.state)
    : null;
  const profile = account.user
    ? account.profileChecked
      ? account.profile
      : (account.profile ?? data.profile)
    : data.profile;
  const motivation = motivationFor(
    trained,
    phraseIndex,
    account.phrasePreferences
      ? { ...account.phrasePreferences, fallbackName: profile?.nickname }
      : undefined,
  );
  const weights = [...data.weights].sort(weightOrder);
  const latestWeight = weights.at(-1);
  const weightChange =
    weights.length > 1 ? weights.at(-1)!.kg - weights[0].kg : null;
  const monday = shiftDate(
    today,
    -((new Date(`${today}T12:00:00`).getDay() + 6) % 7),
  );
  const week = Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
  const trainedDays = new Set(workouts.map((w) => w.date));
  const weekCount = week.filter((d) => trainedDays.has(d)).length;
  const totalMinutes = workouts.reduce((sum, w) => sum + w.minutes, 0);
  const lastData = useRef(data);
  lastData.current = data;
  const social = useSocial(
    Boolean(account.user && account.profile),
    data.workouts,
    (remote) => {
      if (initial.error) return;
      void economy.refresh();
      setData((prev) => {
        const byDay = new Map(prev.workouts.map((w) => [w.date, w]));
        remote.forEach((w) =>
          byDay.set(w.date, { ...byDay.get(w.date), ...w }),
        );
        const workouts = [...byDay.values()].sort((a, b) =>
          a.date.localeCompare(b.date),
        );
        return JSON.stringify(workouts) === JSON.stringify(prev.workouts)
          ? prev
          : { ...prev, workouts };
      });
    },
    training.state?.timezone,
    training.state?.today,
  );
  const notifyGroups =
    social.state?.groups.filter(
      (g) =>
        g.status === "active" &&
        g.members.some((m) => m.id === account.user?.id && m.accepted),
    ) ?? [];
  const notifyWorkout = social.state?.workouts.find(
    (w) => w.date === newWorkoutDay,
  );
  useEffect(() => {
    if (!newWorkoutDay || !social.state || modal) return;
    if (notifyGroups.length) setModal("group-notify");
    else setNewWorkoutDay(null);
  }, [newWorkoutDay, social.state, modal]);
  const weightSync = useWeightSync(
    account.user?.id ?? null,
    data.weights,
    (weights) => {
      void economy.refresh();
      setData((prev) =>
        JSON.stringify(prev.weights) === JSON.stringify(weights)
          ? prev
          : { ...prev, weights },
      );
    },
    Boolean(initial.error),
    training.state?.timezone,
  );
  const game = useGamification(
    account.user?.id ?? null,
    JSON.stringify([
      training.state?.revision,
      data.workouts.map((w) => w.confirmedAt ?? w.id),
      data.weights.map((w) => [w.id ?? `${w.date}:${w.kg}`, w.confirmedAt]),
      social.state?.friends.length,
      social.state?.groups.map((g) => [g.id, g.status]),
    ]),
    Boolean(account.profile && account.profileChecked),
  );
  const frameId = equippedItem(game.state, "frame");
  const shareStyle = equippedItem(game.state, "share");
  const cosmeticTheme = equippedItem(game.state, "theme");
  useEffect(() => {
    document.documentElement.dataset.cosmeticTheme = cosmeticTheme ?? "";
    return () => {
      delete document.documentElement.dataset.cosmeticTheme;
    };
  }, [cosmeticTheme]);
  useEffect(() => {
    if (
      game.state?.economyRevision != null &&
      game.state.economyRevision > (economy.state?.revision ?? -1)
    )
      void economy.refresh();
  }, [game.state?.economyRevision, economy.state?.revision, economy.refresh]);
  useEffect(() => {
    if (active === "weight" && account.user) void weightSync.refresh();
  }, [active, account.user?.id, weightSync.refresh]);
  useEffect(() => {
    if (economy.notice && active !== "shop") {
      setToast(economy.notice);
      economy.clearNotice();
    }
  }, [economy.notice, active]);

  useEffect(() => {
    if (!celebrating) return;
    const timer = window.setTimeout(() => setCelebrating(false), 2600);
    return () => window.clearTimeout(timer);
  }, [celebrating]);

  useEffect(() => {
    if (account.user && account.profileChecked)
      setData((prev) =>
        prev.profile === account.profile
          ? prev
          : { ...prev, profile: account.profile },
      );
  }, [account.user, account.profile, account.profileChecked]);

  useEffect(() => {
    if (initial.error) return;
    if (
      account.user &&
      accountStorageGeneration(account.user.id) !== storageGeneration
    )
      return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
      setStorageError("");
    } catch {
      setStorageError(
        "Não foi possível salvar no navegador. Seus registros podem ser perdidos ao fechar esta página.",
      );
    }
  }, [data, initial.error, storageKey, storageGeneration, account.user]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let cancelled = false,
      checking = false;
    const checkReminders = async () => {
      if (checking) return;
      checking = true;
      try {
        let time = new Date(),
          state = training.getCurrent();
        let reminderDay = state?.today ?? localDate(time);
        const candidates = dueReminders(
          lastData.current,
          time,
          false,
          reminderDay,
        );
        let fresh = true;
        // A second device may have moved today's workout. Recheck before charging it.
        if (training.enabled && candidates.some((r) => r.id === "workout")) {
          fresh = await training.refresh();
          state = training.getCurrent();
          time = new Date();
          reminderDay = state?.today ?? localDate(time);
        }
        if (
          cancelled ||
          (account.user &&
            accountStorageGeneration(account.user.id) !== storageGeneration)
        )
          return;
        setNow(time);
        if (notificationSupported()) setPermission(Notification.permission);
        const due = dueReminders(
          lastData.current,
          time,
          !fresh || !isTrainingDay(trainingDayKind(state, reminderDay)),
          reminderDay,
        );
        if (!due.length) return;
        const ids = new Set(due.map((r) => r.id));
        const next = {
          ...lastData.current,
          reminders: lastData.current.reminders.map((r) =>
            ids.has(r.id) ? { ...r, lastSent: reminderDay } : r,
          ),
        };
        lastData.current = next;
        setData(next);
        setToast(due.map((r) => reminderText[r.id].body).join(" "));
        due.forEach((r) => {
          void notify(reminderText[r.id].title, reminderText[r.id].body);
        });
      } finally {
        checking = false;
      }
    };
    void checkReminders();
    const timer = window.setInterval(() => void checkReminders(), 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void checkReminders();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [
    training.enabled,
    training.refresh,
    training.getCurrent,
    account.user?.id,
    storageGeneration,
  ]);

  async function enableNotifications() {
    if (!notificationSupported()) {
      setToast(
        "Este navegador não oferece notificações neste contexto. Use HTTPS e um navegador compatível. Os alertas no app continuam disponíveis.",
      );
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      setToast(
        result === "granted"
          ? "Notificações ativadas! Ajuste os lembretes em Configurações."
          : "Notificações não autorizadas. Você ainda receberá alertas dentro do app.",
      );
    } catch {
      setToast(
        "Não foi possível ativar notificações. Os alertas dentro do app continuam disponíveis.",
      );
    }
  }

  function followPage(event: MouseEvent<HTMLAnchorElement>, page: Page) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    navigate(page);
  }
  function requestWorkout() {
    if (training.enabled && !training.state) {
      setToast(
        training.error ||
          "Aguarde carregar sua programação antes de registrar o treino",
      );
      void training.refresh();
      return;
    }
    setModal(account.user ? "workout" : "auth");
  }
  async function protectToday() {
    if (!canProtectToday) return false;
    const protectedDay = await economy.useKit(today);
    if (protectedDay) {
      await training.refresh();
      void social.refresh();
    }
    return protectedDay;
  }

  return (
    <div className="app-shell" data-page={active}>
      {celebrating && <FlameCelebration />}
      <header className="topbar">
        <a
          href={pageHref("overview")}
          className="brand"
          onClick={(event) => followPage(event, "overview")}
          aria-label="FokusTrainer, início"
        >
          <span className="brand-icon">
            <Flame size={26} fill="currentColor" />
          </span>
          <span>
            fokus<span className="brand-light">trainer</span>
          </span>
        </a>
        <div className="topbar-actions">
          {account.user ? (
            <button
              className="coin-balance"
              aria-label={
                economy.state
                  ? `${currencyAmount(economy.state.balance)} de proteína · Ver loja e kits`
                  : "Ver loja e kits"
              }
              onClick={() => navigate("shop")}
            >
              <ProteinToken size={21} />
              <span>
                {economy.state
                  ? new Intl.NumberFormat("pt-BR", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    }).format(economy.state.balance)
                  : "—"}
              </span>
            </button>
          ) : (
            <button
              className="icon-button bell-button"
              aria-label="Ver lembretes"
              onClick={() => navigate("settings")}
            >
              <Bell size={21} />
            </button>
          )}
          <button
            className="profile-button"
            aria-label={
              profile ? `Editar perfil de ${profile.nickname}` : "Criar perfil"
            }
            onClick={() => setModal("profile")}
          >
            {profile ? (
              <Avatar profile={profile} frame={frameId} />
            ) : (
              <UserRound size={22} />
            )}
          </button>
        </div>
      </header>
      <aside className="sidebar">
        <nav aria-label="Menu principal">
          {(
            [
              ["overview", LayoutDashboard, "Início"],
              ["workouts", Dumbbell, "Treinos"],
              ["social", Trophy, "Arena"],
              ["weight", BodyScale, "Peso"],
              ["shop", ShoppingBag, "Loja"],
              ["settings", Settings, "Configurações"],
            ] as const
          ).map(([id, Icon, label]) => {
            const ItemIcon = Icon as typeof Flame;
            return (
              <a
                key={id}
                href={pageHref(id)}
                className={`nav-item ${active === id ? "active" : ""}`}
                aria-label={label}
                title={label}
                aria-current={active === id ? "page" : undefined}
                onClick={(event) => followPage(event, id)}
              >
                <ItemIcon size={24} aria-hidden="true" />
              </a>
            );
          })}
        </nav>
      </aside>
      <main id="main-content" ref={mainRef} aria-labelledby="page-title">
        <div className="page-content">
          {!account.user && (
            <div className="guest-banner">
              <span>
                <UserRound size={15} /> Visitante
              </span>
              <button
                className="primary-button guest-login"
                aria-label="Entrar na conta"
                onClick={() => setModal("auth")}
              >
                Entrar <ArrowRight size={16} />
              </button>
            </div>
          )}
          {storageError && (
            <div className="storage-warning" role="alert">
              {storageError}
            </div>
          )}
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
          {account.user && !profile && account.profileChecked && (
            <button
              className="complete-profile"
              onClick={() => setModal("profile")}
            >
              <UserRound size={18} /> Complete seu nick e avatar{" "}
              <ArrowRight size={17} />
            </button>
          )}
          {active === "overview" && (
            <>
              <section
                className={`hero ${trained ? "hero-done" : ""}`}
                aria-label="Sua ofensiva"
              >
                <h1 className="hero-message" id="page-title" tabIndex={-1}>
                  {isTrainingDay(todayKind)
                    ? motivation
                    : todayKind === "medical-kit"
                      ? "Kit em ação, chama protegida"
                      : todayKind === "rescheduled-rest"
                        ? "Treino transferido, chama protegida"
                        : todayKind === "extra-rest"
                          ? "Pausa autorizada, chama protegida"
                          : "Descansa, a chama tá segura"}
                </h1>
                <div className="hero-body">
                  <StreakFlame lit={trained} />
                  <div className="hero-content">
                    <div
                      className="streak-number"
                      aria-label={`${currentStreak} ${currentStreak === 1 ? "dia" : "dias"} de ofensiva`}
                    >
                      {currentStreak}
                      <span>{currentStreak === 1 ? "dia" : "dias"}</span>
                    </div>
                    {workoutTime && (
                      <time
                        className="workout-time"
                        dateTime={workoutTime}
                        title={
                          todayWorkout?.confirmedAt
                            ? "Confirmado online neste horário"
                            : "Registrado neste aparelho; a confirmação do grupo depende da sincronização"
                        }
                      >
                        <Clock3 size={13} />
                        {new Date(workoutTime).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    )}
                  </div>
                </div>
                {!isTrainingDay(todayKind) && (
                  <p className="rest-status">
                    {todayKind === "medical-kit" ? (
                      <BriefcaseMedical size={16} />
                    ) : (
                      <Moon size={16} />
                    )}
                    {todayKind === "medical-kit"
                      ? "Kit Médico usado"
                      : todayKind === "rescheduled-rest"
                        ? "Descanso por reagendamento"
                        : todayKind === "extra-rest"
                          ? "Descanso extra"
                          : "Descanso programado"}
                    <span>Sem somar pontos</span>
                  </p>
                )}
                <div className="hero-actions">
                  <button
                    className="primary-button hero-button"
                    aria-label={
                      trained ? "Treino de hoje concluído" : "Registrar treino"
                    }
                    disabled={trained}
                    onClick={() => {
                      if (!trained) requestWorkout();
                    }}
                  >
                    {trained ? <CheckCheck size={21} /> : <Plus size={21} />}
                    {trained
                      ? "Treino registrado"
                      : isTrainingDay(todayKind)
                        ? "Registrar treino"
                        : "Treinar mesmo assim"}
                    {trained ? (
                      <LockKeyhole size={18} />
                    ) : (
                      <ArrowRight size={20} />
                    )}
                  </button>
                  <button
                    className="share-streak-button"
                    aria-label="Compartilhar ofensiva"
                    title="Compartilhar ofensiva"
                    disabled={currentStreak < 1}
                    onClick={() => setModal("share")}
                  >
                    <Share2 size={19} />
                  </button>
                </div>
                {canProtectToday && (
                  <div
                    className="hero-protection-actions"
                    aria-label="Proteger a ofensiva de hoje"
                  >
                    <button
                      disabled={training.busy || !extraAvailable}
                      className="hero-protection-button"
                      onClick={() => setModal("rest")}
                    >
                      <Moon size={16} />
                      <span>Descansar hoje</span>
                      <small>
                        {extraAvailable}/{training.state!.weeklyExtraLimit}
                      </small>
                    </button>
                    <button
                      disabled={
                        economy.busy ||
                        Boolean(economy.state?.kits && kitUsesAvailable === 0)
                      }
                      className="hero-protection-button"
                      onClick={() => {
                        if (economy.state?.kits) setModal("kit");
                        else navigate("shop");
                        void economy.refresh();
                        void training.refresh();
                      }}
                    >
                      <BriefcaseMedical size={16} />
                      <span>Usar kit</span>
                      <small>{economy.state?.kits ?? "—"}</small>
                    </button>
                  </div>
                )}
              </section>
              <WeeklyTrainingProgress
                workouts={workouts}
                training={account.user ? training.state : null}
              />
              <section className="stats-grid" aria-label="Resumo do progresso">
                <Stat
                  icon={<Dumbbell size={21} />}
                  label="Semana"
                  value={String(weekCount)}
                  suffix={weekCount === 1 ? "dia" : "dias"}
                  detail=""
                  color="green"
                />
                <Stat
                  icon={<BodyScale size={21} />}
                  label="Peso"
                  value={latestWeight ? formatKg(latestWeight.kg) : "—"}
                  suffix="kg"
                  detail=""
                  color="purple"
                />
                <Stat
                  icon={<Activity size={21} />}
                  label="Movimento"
                  value={String(totalMinutes)}
                  suffix="min"
                  detail=""
                  color="orange"
                />
              </section>
              <WeeklyGoals game={game} onOpen={() => setModal("missions")} />
            </>
          )}
          {active === "workouts" && reportsOpen && account.user ? (
            <div className="workouts-page">
              <div className="screen-heading">
                <h1 id="page-title" tabIndex={-1}>
                  Treinos
                </h1>
              </div>
              <ProgressReports
                userId={account.user.id}
                today={today}
                timezone={training.state?.timezone ?? "UTC"}
                onClose={() => setReportsOpen(false)}
              />
            </div>
          ) : (
            active === "workouts" && (
              <WorkoutCalendar
                workouts={workouts}
                today={today}
                view={calendarView}
                onView={setCalendarView}
                onRegister={requestWorkout}
                training={training.state}
                schedule={training}
                onRescheduled={(target) => {
                  setToast(
                    `Treino transferido para ${formatDay(target, { weekday: "long", day: "numeric", month: "short" })}`,
                  );
                  void social.refresh();
                }}
                onLogin={() => setModal("auth")}
                onKits={account.user ? () => navigate("shop") : undefined}
                kits={economy.state?.kits}
                onRest={
                  training.enabled && training.state
                    ? () => setModal("rest")
                    : undefined
                }
                restBusy={training.busy}
                onReports={
                  game.state?.features?.reports
                    ? () => setReportsOpen(true)
                    : undefined
                }
              />
            )
          )}
          {active === "weight" && (
            <section className="card weight-card" id="weight">
              <div className="section-heading">
                <h1 className="page-title" id="page-title" tabIndex={-1}>
                  <BodyScale size={20} /> Meu peso
                </h1>
                <button
                  className="outline-button"
                  aria-label="Registrar peso"
                  onClick={() => setModal(account.user ? "weight" : "auth")}
                >
                  <Plus size={18} /> Registrar
                </button>
              </div>
              {account.user && (
                <WeightSyncStatus
                  sync={weightSync}
                  guest={guestWeights}
                  onError={setToast}
                />
              )}
              <div className="weight-summary">
                <strong>
                  {latestWeight ? formatKg(latestWeight.kg) : "—"}
                  <span> kg</span>
                </strong>
                {latestWeight && (
                  <span className="weight-date">
                    {formatDay(latestWeight.date)}
                  </span>
                )}
              </div>
              {weightChange !== null && (
                <span className="weight-delta">
                  {weightChange < 0 ? (
                    <ArrowDownRight size={16} />
                  ) : (
                    <ArrowUpRight size={16} />
                  )}
                  {weightChange > 0 ? "+" : ""}
                  {formatKg(weightChange)} kg desde o início
                </span>
              )}
              <WeightChart weights={weights.slice(-30)} />
              {weights.length > 0 && (
                <details className="weight-history">
                  <summary>Ver registros de peso ({weights.length})</summary>
                  <div className="weight-list">
                    {[...weights].reverse().map((w) => (
                      <div
                        className="history-row weight-entry-row"
                        key={w.id ?? w.date}
                      >
                        <span>
                          {formatDay(w.date, {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                          {w.recordedAt && (
                            <time
                              dateTime={w.recordedAt}
                              title="Horário do registro"
                            >
                              <Clock3 size={12} />
                              {new Date(w.recordedAt).toLocaleTimeString(
                                "pt-BR",
                                {
                                  timeZone: training.state?.timezone,
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                },
                              )}
                            </time>
                          )}
                        </span>
                        <strong>{formatKg(w.kg)} kg</strong>
                        <LockKeyhole
                          size={15}
                          className="weight-entry-lock"
                          aria-label="Registro imutável"
                        />
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </section>
          )}
          {active === "shop" && (
            <section className="shop-page" aria-labelledby="page-title">
              <div className="screen-heading">
                <h1 id="page-title" tabIndex={-1}>
                  <ShoppingBag size={22} /> Loja
                </h1>
              </div>
              {account.user ? (
                <EconomyPanel
                  economy={economy}
                  canProtect={canProtectToday}
                  onProtect={protectToday}
                >
                  <CosmeticShop
                    game={game}
                    profile={profile}
                    balance={economy.state?.balance ?? 0}
                    onChanged={() => void economy.refresh()}
                  />
                </EconomyPanel>
              ) : (
                <div className="shop-guest">
                  <ProteinToken size={44} />
                  <p>Seus potes e kits ficam aqui</p>
                  <button
                    className="primary-button"
                    onClick={() => setModal("auth")}
                  >
                    Entrar na conta <ArrowRight size={18} />
                  </button>
                </div>
              )}
            </section>
          )}
          {active === "settings" && (
            <div className="settings-page">
              <div className="screen-heading">
                <h1 id="page-title" tabIndex={-1}>
                  <Settings size={22} /> Configurações
                </h1>
              </div>
              <section
                className="settings-section"
                id="reminders"
                aria-labelledby="notifications-title"
              >
                <div className="section-heading">
                  <h2 id="notifications-title">
                    <Bell size={20} /> Notificações
                  </h2>
                </div>
                {data.reminders.map((r) => (
                  <div className="reminder-row" key={r.id}>
                    <span
                      className={`stat-icon ${r.id === "workout" ? "green" : "purple"}`}
                    >
                      {r.id === "workout" ? (
                        <Dumbbell size={22} />
                      ) : (
                        <BodyScale size={22} />
                      )}
                    </span>
                    <div>
                      <strong>
                        {r.id === "workout"
                          ? "Hora do treino"
                          : "Anotar meu peso"}
                      </strong>
                      <input
                        className="time-input"
                        type="time"
                        aria-label={`Horário: ${r.id === "workout" ? "treino" : "peso"}`}
                        value={r.time}
                        required
                        onChange={(e) => {
                          const time = e.target.value;
                          if (time)
                            setData((prev) => ({
                              ...prev,
                              reminders: prev.reminders.map((item) =>
                                item.id === r.id ? { ...item, time } : item,
                              ),
                            }));
                        }}
                      />
                    </div>
                    <button
                      role="switch"
                      aria-checked={r.enabled}
                      aria-label={`Lembrete de ${r.id === "workout" ? "treino" : "peso"}`}
                      className={`toggle ${r.enabled ? "enabled" : ""}`}
                      onClick={() => {
                        setData((prev) => ({
                          ...prev,
                          reminders: prev.reminders.map((item) =>
                            item.id === r.id
                              ? { ...item, enabled: !item.enabled }
                              : item,
                          ),
                        }));
                        setToast(
                          r.enabled
                            ? "Lembrete desativado."
                            : "Lembrete ativado. Deixe o app aberto.",
                        );
                      }}
                    >
                      <span />
                    </button>
                  </div>
                ))}
                {permission === "denied" && (
                  <p className="field-hint">
                    Libere as notificações nas configurações do navegador
                  </p>
                )}
                {permission !== "granted" && permission !== "unsupported" && (
                  <button
                    className="text-button settings-notification-action"
                    onClick={enableNotifications}
                  >
                    Ativar notificações <ArrowRight size={17} />
                  </button>
                )}
                <PushPanel account={account} />
              </section>
              <AppearanceSettings />
              <InstallApp />
            </div>
          )}
          {active === "social" && (
            <>
              <SocialPanel
                account={account}
                social={social}
                onProfile={() => setModal(account.user ? "profile" : "auth")}
                showMedals={Boolean(game.state?.achievements)}
              />
              {account.user && game.state?.features?.challenges && (
                <ChallengesPanel
                  userId={account.user.id}
                  friends={social.state?.friends ?? []}
                  onChanged={() => {
                    void game.refresh();
                    void economy.refresh();
                  }}
                />
              )}
            </>
          )}
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Check size={19} />
          <span>{toast}</span>
          <button aria-label="Fechar aviso" onClick={() => setToast("")}>
            <X size={17} />
          </button>
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal === "missions"
              ? "Missões da semana"
              : modal === "kit"
                ? "Kit Médico"
                : modal === "notification-opt-in"
                  ? "Bora manter a chama acesa?"
                  : modal === "group-notify"
                    ? "Avisar o time?"
                    : modal === "auth"
                      ? "Sua chama começa com uma conta"
                      : modal === "profile"
                        ? "Seu perfil"
                        : modal === "share"
                          ? "Sua conquista em destaque"
                          : modal === "workout"
                            ? "Confirmar treino"
                            : modal === "rest"
                              ? "Descansar hoje?"
                              : "Meu peso"
          }
          wide={modal === "share"}
          compactHeader={modal === "profile"}
          onClose={() => {
            if (modal === "group-notify") setNewWorkoutDay(null);
            setModal(null);
          }}
        >
          {modal === "missions" ? (
            <MissionPanel game={game} />
          ) : modal === "kit" ? (
            economy.state ? (
              <MedicalKitConfirmation
                state={economy.state}
                today={today}
                canProtect={canProtectToday}
                busy={economy.busy || training.busy}
                error={economy.error}
                onConfirm={protectToday}
                onCancel={() => setModal(null)}
              />
            ) : (
              <p role="status">Atualizando seus kits…</p>
            )
          ) : modal === "notification-opt-in" ? (
            <NotificationOptIn
              onEnable={enableNotifications}
              onDismiss={() => setModal(null)}
            />
          ) : modal === "group-notify" ? (
            <GroupWorkoutPrompt
              groups={notifyGroups}
              workoutId={notifyWorkout?.id}
              nickname={profile?.nickname ?? "Alguém do time"}
              onSync={social.refresh}
              onSkip={() => {
                setNewWorkoutDay(null);
                setModal(null);
              }}
              onSent={(message) => {
                setNewWorkoutDay(null);
                setModal(null);
                setToast(message);
              }}
            />
          ) : modal === "profile" || modal === "auth" ? (
            <ProfilePanel
              key={modal}
              initialTab={modal === "auth" ? "account" : "profile"}
              profile={profile}
              account={account}
              cosmeticFrame={frameId}
              stats={{
                workouts: trainedDays.size,
                streak: currentStreak,
                bestStreak: recordStreak,
              }}
              onSaveLocal={(profile) =>
                setData((prev) => ({ ...prev, profile }))
              }
              onSaved={(message) => {
                setModal(null);
                setToast(message);
              }}
              onRegistrationCompleted={() => {
                if (
                  notificationSupported() &&
                  Notification.permission === "default"
                ) {
                  setModal("notification-opt-in");
                }
              }}
            >
              <AchievementsPanel game={game} compact />
              {game.state?.cosmetics && (
                <button
                  type="button"
                  className="profile-shop-link"
                  onClick={() => navigate("shop")}
                >
                  <Palette size={22} aria-hidden="true" />
                  <span>
                    Personalizar na loja
                    <small>Molduras, cards e temas</small>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              )}
            </ProfilePanel>
          ) : modal === "share" ? (
            <SharePanel
              profile={profile}
              days={currentStreak}
              date={today}
              styleId={shareStyle}
              frameId={frameId}
            />
          ) : modal === "rest" ? (
            <div className="rest-confirmation">
              <Moon size={36} />
              <p>A chama fica protegida hoje, sem somar pontos</p>
              <p className="field-hint">
                {training.state
                  ? extraRestsRemaining(training.state, today)
                  : 0}{" "}
                descansos extras disponíveis nesta semana
              </p>
              {training.error && (
                <p className="form-error" role="alert">
                  {training.error}
                </p>
              )}
              <button
                className="primary-button"
                disabled={training.busy}
                onClick={async () => {
                  if (await training.rest()) {
                    setModal(null);
                    setToast("Descanso autorizado. Sua chama está protegida");
                    void social.refresh();
                  }
                }}
              >
                {training.busy ? "Confirmando…" : "Autorizar descanso"}
              </button>
            </div>
          ) : (
            <EntryForm
              kind={modal}
              today={today}
              data={data}
              onSave={(next, weight) => {
                // Recheck against the latest state, including fast repeated submissions.
                if (modal === "workout") {
                  if (
                    !account.user ||
                    accountStorageGeneration(account.user.id) !==
                      storageGeneration
                  ) {
                    setModal("auth");
                    return;
                  }
                  const entry = next.workouts.at(-1)!;
                  try {
                    const confirmed = confirmWorkout(
                      lastData.current,
                      entry,
                      today,
                    );
                    lastData.current = confirmed;
                    setData(confirmed);
                    setNewWorkoutDay(entry.date);
                    if (active === "workouts")
                      setCalendarView({ month: today.slice(0, 7), day: today });
                    if (
                      !window.matchMedia?.("(prefers-reduced-motion: reduce)")
                        .matches
                    )
                      setCelebrating(true);
                  } catch (error) {
                    setToast((error as Error).message);
                    return;
                  }
                } else if (weight) {
                  if (
                    !account.user ||
                    accountStorageGeneration(account.user.id) !==
                      storageGeneration
                  ) {
                    setModal("auth");
                    return;
                  }
                  weightSync.save(weight.date, weight.kg);
                }
                setModal(null);
                setToast(
                  modal === "workout"
                    ? account.user && account.profile
                      ? "Treino salvo. Sincronizando sua chama…"
                      : "Treino confirmado. Sua chama está acesa."
                    : account.user
                      ? "Peso salvo. Sincronizando…"
                      : "Peso salvo.",
                );
              }}
            />
          )}
        </Modal>
      )}
    </div>
  );
}

function StreakFlame({ lit }: { lit: boolean }) {
  return (
    <svg
      className={`streak-flame ${lit ? "is-lit" : ""}`}
      viewBox="0 0 120 145"
      role="img"
      aria-label={
        lit
          ? "Chama acesa: treino confirmado hoje"
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

function Stat({
  icon,
  label,
  value,
  suffix,
  detail,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  suffix: string;
  detail: string;
  color: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${color}`}>{icon}</span>
      </div>
      <div className="stat-value">
        {value}
        <span>{suffix}</span>
      </div>
      {detail && <p>{detail}</p>}
    </div>
  );
}

function WeightChart({ weights }: { weights: Data["weights"] }) {
  if (!weights.length)
    return (
      <div className="chart-empty">
        <div className="chart-grid" />
        <span className="empty-chart-icon">
          <BodyScale size={23} />
        </span>
        <strong>Seu gráfico começa aqui</strong>
        <p>Registre seu primeiro peso.</p>
      </div>
    );
  const min = Math.min(...weights.map((w) => w.kg)) - 0.5;
  const max = Math.max(...weights.map((w) => w.kg)) + 0.5;
  const points = weights.map((w, i) => [
    weights.length === 1 ? 310 : 55 + (i / (weights.length - 1)) * 510,
    150 - ((w.kg - min) / (max - min)) * 125,
  ]);
  const line = points.map(([x, y]) => `${x},${y}`).join(" ");
  return (
    <div className="weight-chart">
      <svg
        viewBox="0 0 600 200"
        role="img"
        aria-label={`Evolução de peso: ${weights.length} registros, de ${formatKg(weights[0].kg)} a ${formatKg(weights.at(-1)!.kg)} quilos. Valores detalhados em Ver registros de peso.`}
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f16b28" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#f16b28" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="50"
              x2="575"
              y1={25 + i * 42}
              y2={25 + i * 42}
              stroke="var(--border)"
              strokeDasharray="3 4"
            />
            <text x="4" y={29 + i * 42} fill="var(--muted)" fontSize="11">
              {formatKg(max - ((max - min) / 3) * i)}
            </text>
          </g>
        ))}
        <polygon
          points={`${points[0][0]},160 ${line} ${points.at(-1)![0]},160`}
          fill="url(#chart-fill)"
        />
        <polyline
          points={line}
          fill="none"
          stroke="var(--accent-text)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {points.map(([x, y], i) => (
          <circle
            key={weights[i].id ?? weights[i].date}
            cx={x}
            cy={y}
            r="4"
            fill="var(--accent-text)"
            stroke="var(--surface)"
            strokeWidth="2"
          >
            <title>
              {formatDay(weights[i].date)}: {formatKg(weights[i].kg)} kg
            </title>
          </circle>
        ))}
        <text x="55" y="189" fill="var(--muted)" fontSize="11">
          {formatDay(weights[0].date)}
        </text>
        {weights.length > 1 && (
          <text
            x="565"
            y="189"
            textAnchor="end"
            fill="var(--muted)"
            fontSize="11"
          >
            {formatDay(weights.at(-1)!.date)}
          </text>
        )}
      </svg>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide = false,
  compactHeader = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  compactHeader?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogViewport(dialogRef);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = dialogRef.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const cancel = (event: Event) => {
      event.preventDefault();
      closeRef.current();
    };
    dialog.addEventListener("cancel", cancel);
    return () => {
      dialog.removeEventListener("cancel", cancel);
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className={`modal ${wide ? "modal-share" : ""} ${compactHeader ? "modal-profile" : ""}`}
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="modal-heading">
        {compactHeader ? (
          <h2 id="modal-title">{title}</h2>
        ) : (
          <span className="eyebrow">VAMOS NESSA</span>
        )}
        <button
          className="icon-button"
          aria-label="Fechar janela"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {!compactHeader && <h2 id="modal-title">{title}</h2>}
      {children}
    </dialog>
  );
}

function EntryForm({
  kind,
  today,
  data,
  onSave,
}: {
  kind: "workout" | "weight";
  today: string;
  data: Data;
  onSave: (next: Data, weight?: Weight) => void;
}) {
  const [date, setDate] = useState(today);
  const [activity, setActivity] = useState("Musculação");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!validDate(date) || date > today || date < "2000-01-01") {
      setError("Escolha uma data válida entre 01/01/2000 e hoje.");
      return;
    }
    const amount = Number(value.replace(",", "."));
    if (
      !value.trim() ||
      !Number.isFinite(amount) ||
      (kind === "workout"
        ? !Number.isInteger(amount) || amount < 1 || amount > 1440
        : amount < 20 ||
          amount > 500 ||
          Math.abs(amount * 10 - Math.round(amount * 10)) > 0.00001)
    ) {
      setError(
        kind === "workout"
          ? "Informe a duração em minutos inteiros, entre 1 e 1440."
          : "Informe um peso entre 20 e 500 kg, com até uma casa decimal.",
      );
      return;
    }
    if (kind === "workout") {
      try {
        onSave(
          confirmWorkout(data, {
            id: crypto.randomUUID(),
            date,
            activity,
            minutes: amount,
          }),
        );
      } catch (error) {
        setError((error as Error).message);
      }
      return;
    }
    try {
      onSave(
        {
          ...data,
          weights: [...data.weights, { date, kg: amount }],
        },
        { date, kg: amount },
      );
    } catch (error) {
      setError((error as Error).message);
    }
  }
  return (
    <form onSubmit={submit}>
      <p className="modal-description">
        {kind === "workout"
          ? "Uma confirmação por dia, sem edição depois."
          : "Cada pesagem é um novo registro, sem edição depois"}
      </p>
      <label className="form-label">
        Data
        <input
          type="date"
          min="2000-01-01"
          max={today}
          readOnly={kind === "workout"}
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      {kind === "workout" && (
        <label className="form-label">
          Atividade
          <select
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
          >
            {[
              "Musculação",
              "Caminhada",
              "Corrida",
              "Ciclismo",
              "Natação",
              "Yoga",
              "Pilates",
              "Funcional",
              "Outro treino",
            ].map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      )}
      <label className="form-label">
        {kind === "workout" ? "Duração (minutos)" : "Peso (kg)"}
        <input
          type="text"
          inputMode={kind === "workout" ? "numeric" : "decimal"}
          placeholder={kind === "workout" ? "Ex.: 45" : "Ex.: 72,5"}
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="primary-button form-submit" type="submit">
        <Check size={18} />
        {kind === "workout" ? "Confirmar treino" : "Salvar peso"}
      </button>
      <p className="privacy-note">Salvo na conta após sincronizar.</p>
    </form>
  );
}
