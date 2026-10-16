import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  CalendarDays,
  LockKeyhole,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  CheckCheck,
  CircleHelp,
  Dumbbell,
  Flame,
  LayoutDashboard,
  Plus,
  Scale,
  Trash2,
  Trophy,
  Share2,
  UserRound,
  X,
} from "lucide-react";
import {
  bestStreak,
  confirmWorkout,
  dueReminders,
  formatDay,
  formatKg,
  freshData,
  localDate,
  parseData,
  shiftDate,
  STORAGE_KEY,
  streak,
  validDate,
  type Data,
} from "./model";
import { notificationSupported, notify } from "./notifications";
import InstallApp from "./InstallApp";
import { useAccount, type Account } from "./account";
import ProfilePanel, { Avatar } from "./ProfilePanel";
import SharePanel from "./SharePanel";

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
  const [data, setData] = useState(initial.data);
  const [storageError, setStorageError] = useState(initial.error);
  const [now, setNow] = useState(() => new Date());
  const [modal, setModal] = useState<
    "workout" | "weight" | "help" | "profile" | "share" | null
  >(null);
  const [toast, setToast] = useState("");
  const [permission, setPermission] = useState(() =>
    notificationSupported() ? Notification.permission : "unsupported",
  );
  const [active, setActive] = useState("overview");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const today = localDate(now);
  const trained = data.workouts.some((w) => w.date === today);
  const currentStreak = streak(data.workouts, today);
  const profile = account.user
    ? (account.profile ?? data.profile)
    : data.profile;
  const weights = [...data.weights].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const latestWeight = weights.at(-1);
  const weightChange =
    weights.length > 1 ? weights.at(-1)!.kg - weights[0].kg : null;
  const monday = shiftDate(
    today,
    -((new Date(`${today}T12:00:00`).getDay() + 6) % 7),
  );
  const week = Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
  const trainedDays = new Set(data.workouts.map((w) => w.date));
  const weekCount = week.filter((d) => trainedDays.has(d)).length;
  const totalMinutes = data.workouts.reduce((sum, w) => sum + w.minutes, 0);
  const lastData = useRef(data);
  lastData.current = data;

  useEffect(() => {
    if (account.user && account.profile)
      setData((prev) =>
        prev.profile === account.profile
          ? prev
          : { ...prev, profile: account.profile },
      );
  }, [account.user, account.profile]);

  useEffect(() => {
    if (initial.error) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
      setStorageError("");
    } catch {
      setStorageError(
        "Não foi possível salvar no navegador. Seus registros podem ser perdidos ao fechar esta página.",
      );
    }
  }, [data, initial.error, storageKey]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const checkReminders = () => {
      const time = new Date();
      setNow(time);
      if (notificationSupported()) setPermission(Notification.permission);
      const due = dueReminders(lastData.current, time);
      if (!due.length) return;
      // Mark before delivery so interval/visibility events cannot send duplicates.
      const ids = new Set(due.map((r) => r.id));
      const next = {
        ...lastData.current,
        reminders: lastData.current.reminders.map((r) =>
          ids.has(r.id) ? { ...r, lastSent: localDate(time) } : r,
        ),
      };
      lastData.current = next;
      setData(next);
      setToast(due.map((r) => reminderText[r.id].body).join(" "));
      due.forEach((r) => {
        void notify(reminderText[r.id].title, reminderText[r.id].body);
      });
    };
    checkReminders();
    const timer = window.setInterval(checkReminders, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") checkReminders();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

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
          ? "Notificações ativadas! Configure seus horários abaixo."
          : "Notificações não autorizadas. Você ainda receberá alertas dentro do app.",
      );
    } catch {
      setToast(
        "Não foi possível ativar notificações. Os alertas dentro do app continuam disponíveis.",
      );
    }
  }

  function navigate(section: string) {
    setActive(section);
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const behavior = reducedMotion ? "instant" : "smooth";
    if (section === "overview") {
      window.scrollTo({ top: 0, behavior });
      return;
    }
    document.getElementById(section)?.scrollIntoView({
      behavior,
      block: "start",
    });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          href="#overview"
          className="brand"
          onClick={() => navigate("overview")}
          aria-label="FokusTrainer, início"
        >
          <span className="brand-icon">
            <Flame size={26} fill="currentColor" />
          </span>
          <span>
            fokus<span className="brand-light">trainer</span>
          </span>
        </a>
        <button
          className="profile-button"
          aria-label={
            profile ? `Editar perfil de ${profile.nickname}` : "Criar perfil"
          }
          onClick={() => setModal("profile")}
        >
          {profile ? <Avatar profile={profile} /> : <UserRound size={22} />}
        </button>
      </header>
      <aside className="sidebar">
        <nav aria-label="Menu principal">
          {[
            ["overview", LayoutDashboard, "Início"],
            ["workouts", Dumbbell, "Treinos"],
            ["weight", Scale, "Peso"],
            ["reminders", Bell, "Avisos"],
          ].map(([id, Icon, label]) => {
            const ItemIcon = Icon as typeof Flame;
            return (
              <button
                key={String(id)}
                className={`nav-item ${active === id ? "active" : ""}`}
                aria-current={active === id ? "location" : undefined}
                onClick={() => navigate(String(id))}
              >
                <ItemIcon size={22} />
                <span>{String(label)}</span>
              </button>
            );
          })}
        </nav>
      </aside>
      <main id="overview">
        <div className="page-content">
          {storageError && (
            <div className="storage-warning" role="alert">
              {storageError}
            </div>
          )}
          <div className="page-heading">
            <div>
              <span className="today-label">
                {profile && (
                  <span className="nickname-label">@{profile.nickname}</span>
                )}
                {formatDay(today, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </span>
              <h1>Seu próximo passo.</h1>
            </div>
            <button
              className="icon-button bell-button"
              aria-label="Ver lembretes"
              onClick={() => navigate("reminders")}
            >
              <Bell size={23} />
            </button>
          </div>
          {account.user && !profile && !account.profileLoading && (
            <button
              className="complete-profile"
              onClick={() => setModal("profile")}
            >
              <UserRound size={18} /> Complete seu nick e avatar{" "}
              <ArrowRight size={17} />
            </button>
          )}
          <section
            className={`hero ${trained ? "hero-done" : ""}`}
            aria-label="Sua ofensiva"
          >
            <div className="hero-top">
              <span className="hero-tag">SUA OFENSIVA</span>
              <span className="streak-best">
                <Trophy size={15} /> Recorde {bestStreak(data.workouts)}
              </span>
            </div>
            <div className="hero-body">
              <div className="hero-content">
                <div className="streak-number">
                  {currentStreak}
                  <span>
                    {currentStreak === 1
                      ? "dia de ofensiva"
                      : "dias de ofensiva"}
                  </span>
                </div>
                <p>
                  {trained
                    ? "Treino confirmado. Chama acesa."
                    : "Confirme o treino de hoje para acender."}
                </p>
              </div>
              <StreakFlame lit={trained} />
            </div>
            <div className="hero-actions">
              <button
                className="primary-button hero-button"
                aria-label={
                  trained ? "Treino de hoje concluído" : "Registrar treino"
                }
                disabled={trained}
                onClick={() => {
                  if (!trained) setModal("workout");
                }}
              >
                {trained ? <CheckCheck size={21} /> : <Plus size={21} />}
                {trained ? "Treino de hoje concluído" : "Registrar treino"}
                {trained ? <LockKeyhole size={18} /> : <ArrowRight size={20} />}
              </button>
              <button
                className="share-streak-button"
                disabled={currentStreak < 1}
                onClick={() => setModal("share")}
              >
                <Share2 size={18} /> Compartilhar ofensiva
              </button>
            </div>
          </section>
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
              icon={<Scale size={21} />}
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
          <div className="main-grid">
            <section className="card week-card" id="workouts">
              <div className="section-heading">
                <h2>
                  <CalendarDays size={20} /> Sua semana
                </h2>
                <span className="subtle-badge">
                  {formatDay(week[0])} – {formatDay(week[6])}
                </span>
              </div>
              <div className="week-days">
                {week.map((day, i) => (
                  <div
                    className={`week-day ${day === today ? "is-today" : ""} ${trainedDays.has(day) ? "is-done" : ""}`}
                    key={day}
                    aria-label={`${formatDay(day)}${trainedDays.has(day) ? ", treino registrado" : ", sem treino"}${day === today ? ", hoje" : ""}`}
                  >
                    <span>{["S", "T", "Q", "Q", "S", "S", "D"][i]}</span>
                    <div>
                      {trainedDays.has(day) ? (
                        <Check size={20} strokeWidth={3} />
                      ) : (
                        <span>{Number(day.slice(-2))}</span>
                      )}
                    </div>
                    <small>{day === today ? "hoje" : ""}</small>
                  </div>
                ))}
              </div>
              <div className="week-footer">
                <span>
                  {weekCount} {weekCount === 1 ? "dia ativo" : "dias ativos"}
                </span>
                <span>Um dia de cada vez</span>
              </div>
              <div className="workout-history">
                <div className="history-heading">
                  <h3>Últimos treinos</h3>
                  <span>
                    {data.workouts.length}{" "}
                    {data.workouts.length === 1 ? "treino" : "treinos"} no total
                  </span>
                </div>
                {data.workouts.length === 0 ? (
                  <div className="empty-inline">
                    <span>Seu primeiro treino te espera.</span>
                    <button
                      className="text-button"
                      onClick={() => setModal("workout")}
                    >
                      Vamos lá <ArrowRight size={17} />
                    </button>
                  </div>
                ) : (
                  [...data.workouts]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 5)
                    .map((w) => (
                      <div className="history-row" key={w.id}>
                        <span className="activity-icon">
                          <Dumbbell size={19} />
                        </span>
                        <div>
                          <strong>{w.activity}</strong>
                          <small>
                            {formatDay(w.date)} · {w.minutes} min
                          </small>
                        </div>
                        <span
                          className="locked-record"
                          aria-label="Treino confirmado, sem edição"
                          title="Confirmação permanente"
                        >
                          <LockKeyhole size={17} />
                        </span>
                      </div>
                    ))
                )}
              </div>
            </section>
            <section className="card weight-card" id="weight">
              <div className="section-heading">
                <h2>
                  <Scale size={20} /> Meu peso
                </h2>
                <button
                  className="outline-button"
                  aria-label="Registrar peso"
                  onClick={() => setModal("weight")}
                >
                  <Plus size={18} /> Registrar
                </button>
              </div>
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
                      <div className="history-row" key={w.date}>
                        <span>
                          {formatDay(w.date, {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <strong>{formatKg(w.kg)} kg</strong>
                        <button
                          className="icon-button delete-button"
                          aria-label={`Excluir peso de ${formatDay(w.date)}`}
                          onClick={() => setDeleteTarget(w.date)}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </section>
            <section className="card reminders-card" id="reminders">
              <div className="section-heading">
                <h2>
                  <Bell size={20} /> Lembretes
                </h2>
                <span className="subtle-badge">Todo dia</span>
              </div>
              {data.reminders.map((r) => (
                <div className="reminder-row" key={r.id}>
                  <span
                    className={`stat-icon ${r.id === "workout" ? "green" : "purple"}`}
                  >
                    {r.id === "workout" ? (
                      <Dumbbell size={22} />
                    ) : (
                      <Scale size={22} />
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
              <div className="notification-box">
                <strong>
                  {permission === "granted"
                    ? "Avisos autorizados"
                    : "Avisos do navegador"}
                </strong>
                <p>
                  {permission === "denied"
                    ? "Libere a permissão nas configurações do navegador."
                    : "Deixe o app aberto. Abas em segundo plano podem atrasar os avisos."}
                </p>
                {permission !== "granted" ? (
                  <button className="text-button" onClick={enableNotifications}>
                    Ativar notificações <ArrowRight size={17} />
                  </button>
                ) : (
                  <button
                    className="text-button"
                    onClick={async () => {
                      const ok = await notify(
                        "FokusTrainer",
                        "Tudo certo! Seus avisos estão funcionando.",
                      );
                      setToast(
                        ok
                          ? "Notificação de teste enviada."
                          : "O aviso do sistema falhou. Os alertas no app continuam ativos.",
                      );
                    }}
                  >
                    Testar notificação <ArrowRight size={17} />
                  </button>
                )}
              </div>
            </section>
          </div>
          <InstallApp />
          <footer className="page-footer">
            <span>Seu ritmo. Sua jornada.</span>
            <button onClick={() => setModal("help")}>
              Salvo neste navegador <CircleHelp size={15} />
            </button>
          </footer>
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
            modal === "profile"
              ? "Seu perfil"
              : modal === "share"
                ? "Sua conquista em destaque"
                : modal === "workout"
                  ? "Confirmar treino"
                  : modal === "weight"
                    ? "Meu peso"
                    : "Sobre o FokusTrainer"
          }
          wide={modal === "share"}
          onClose={() => setModal(null)}
        >
          {modal === "profile" ? (
            <ProfilePanel
              profile={profile}
              account={account}
              onSaveLocal={(profile) =>
                setData((prev) => ({ ...prev, profile }))
              }
              onSaved={(message) => {
                setModal(null);
                setToast(message);
              }}
            />
          ) : modal === "share" ? (
            <SharePanel profile={profile} days={currentStreak} date={today} />
          ) : modal === "help" ? (
            <div className="help-content">
              <p>
                O FokusTrainer ajuda você a construir uma rotina de movimento
                com uma ofensiva por dia treinado, registros de peso e lembretes
                diários.
              </p>
              <p>
                Confirme um treino por dia. Depois de confirmar, ele não pode
                ser editado nem excluído. Só é possível registrar o dia atual.
                Se um dia inteiro passar sem confirmação, a ofensiva zera; o
                recorde e o histórico permanecem.
              </p>
              <p>
                Treinos e peso ficam neste dispositivo, separados por conta
                quando você faz login. O perfil local também fica aqui; com o
                Supabase configurado, nick e avatar podem sincronizar com sua
                conta. Limpar os dados do navegador apaga os registros locais.
              </p>
              <p>
                Os avisos usam o horário local do dispositivo. Mantenha o app
                aberto: avisos com ele fechado precisam de um servidor de push,
                ainda não incluído nesta versão.
              </p>
              <button className="primary-button" onClick={() => setModal(null)}>
                Vamos começar <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <EntryForm
              kind={modal}
              today={today}
              data={data}
              onSave={(next) => {
                // Recheck against the latest state, including fast repeated submissions.
                if (modal === "workout") {
                  const entry = next.workouts.at(-1)!;
                  try {
                    const confirmed = confirmWorkout(lastData.current, entry);
                    lastData.current = confirmed;
                    setData(confirmed);
                  } catch (error) {
                    setToast((error as Error).message);
                    return;
                  }
                } else {
                  setData(next);
                }
                setModal(null);
                setToast(
                  modal === "workout"
                    ? "Treino confirmado. Sua chama está acesa."
                    : "Peso salvo.",
                );
              }}
            />
          )}
        </Modal>
      )}
      {deleteTarget && (
        <Modal
          title="Excluir este registro?"
          onClose={() => setDeleteTarget(null)}
        >
          <p className="modal-description">Esse registro será removido.</p>
          <div className="form-actions">
            <button
              className="outline-button"
              onClick={() => setDeleteTarget(null)}
            >
              Cancelar
            </button>
            <button
              className="danger-button"
              onClick={() => {
                setData((prev) => ({
                  ...prev,
                  weights: prev.weights.filter((w) => w.date !== deleteTarget),
                }));
                setDeleteTarget(null);
                setToast("Registro excluído.");
              }}
            >
              Excluir registro
            </button>
          </div>
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
          <Scale size={23} />
        </span>
        <strong>Seu gráfico começa aqui</strong>
        <p>Registre seu primeiro peso.</p>
      </div>
    );
  const min = Math.min(...weights.map((w) => w.kg)) - 0.5;
  const max = Math.max(...weights.map((w) => w.kg)) + 0.5;
  const start = Date.parse(`${weights[0].date}T12:00:00Z`);
  const span = Date.parse(`${weights.at(-1)!.date}T12:00:00Z`) - start;
  const points = weights.map((w) => [
    span === 0
      ? 310
      : 55 + ((Date.parse(`${w.date}T12:00:00Z`) - start) / span) * 510,
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
              stroke="#eadfd6"
              strokeDasharray="3 4"
            />
            <text x="4" y={29 + i * 42} fill="#786b61" fontSize="11">
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
          stroke="#d64a0c"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {points.map(([x, y], i) => (
          <circle
            key={weights[i].date}
            cx={x}
            cy={y}
            r="4"
            fill="#d64a0c"
            stroke="white"
            strokeWidth="2"
          >
            <title>
              {formatDay(weights[i].date)}: {formatKg(weights[i].kg)} kg
            </title>
          </circle>
        ))}
        <text x="55" y="189" fill="#786b61" fontSize="11">
          {formatDay(weights[0].date)}
        </text>
        {weights.length > 1 && (
          <text x="565" y="189" textAnchor="end" fill="#786b61" fontSize="11">
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
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
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
      className={`modal ${wide ? "modal-share" : ""}`}
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="modal-heading">
        <span className="eyebrow">VAMOS NESSA</span>
        <button
          className="icon-button"
          aria-label="Fechar janela"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      <h2 id="modal-title">{title}</h2>
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
  onSave: (next: Data) => void;
}) {
  const [date, setDate] = useState(today);
  const [activity, setActivity] = useState("Musculação");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const replacing =
    kind === "weight" && data.weights.some((w) => w.date === date);
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
    onSave({
      ...data,
      weights: [
        ...data.weights.filter((w) => w.date !== date),
        { date, kg: amount },
      ],
    });
  }
  return (
    <form onSubmit={submit}>
      <p className="modal-description">
        {kind === "workout"
          ? "Uma confirmação por dia, sem edição depois."
          : "Um check-in, sem pressão."}
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
      {replacing && (
        <p className="field-hint">
          Já existe um peso nesta data. Ao salvar, ele será atualizado.
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="primary-button form-submit" type="submit">
        <Check size={18} />
        {kind === "workout"
          ? "Confirmar treino"
          : replacing
            ? "Atualizar peso"
            : "Salvar peso"}
      </button>
      <p className="privacy-note">Salvo só neste navegador.</p>
    </form>
  );
}
