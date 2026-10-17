import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Flame,
  LockKeyhole,
  Plus,
  Moon,
  BriefcaseMedical,
  ArrowRightLeft,
  CalendarClock,
  Coffee,
  X,
  BarChart3,
} from "lucide-react";
import { calendarDays, shiftMonth } from "./calendar";
import { formatDay, type Workout } from "./model";
import RescheduleTraining from "./RescheduleTraining";
import TrainingScheduleSettings from "./TrainingScheduleSettings";
import type { TrainingController } from "./useTrainingPlan";
import {
  extraRestsRemaining,
  isTrainingDay,
  rescheduleFor,
  trainingDayKind,
  type TrainingState,
} from "./training";
export type CalendarView = { month: string; day: string };
export default function WorkoutCalendar({
  workouts,
  today,
  view,
  onView,
  onRegister,
  training,
  schedule,
  onLogin = () => {},
  onRescheduled,
  onKits,
  kits,
  onRest,
  restBusy = false,
  onReports,
}: {
  workouts: Workout[];
  today: string;
  view: CalendarView;
  onView: (view: CalendarView) => void;
  onRegister: () => void;
  training?: TrainingState | null;
  schedule?: TrainingController;
  onLogin?: () => void;
  onRescheduled?: (target: string) => void;
  onKits?: () => void;
  kits?: number;
  onRest?: () => void;
  restBusy?: boolean;
  onReports?: () => void;
}) {
  const { month, day } = view;
  const days = calendarDays(month);
  const monthWorkouts = workouts
    .filter((w) => w.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
  const activeDays = new Set(monthWorkouts.map((w) => w.date));
  const selected = workouts.filter((w) => w.date === day);
  const trained = workouts.some((w) => w.date === today);
  const selectedKind = trainingDayKind(training, day);
  const selectedSwap = rescheduleFor(training, day);
  const trackingStart =
    [
      ...workouts.map((w) => w.date),
      ...(training ? [training.startedOn] : []),
    ].sort()[0] ?? today;
  const missed = (date: string) =>
    date < today &&
    date >= trackingStart &&
    !activeDays.has(date) &&
    isTrainingDay(trainingDayKind(training, date));
  function description(date: string) {
    const kind = trainingDayKind(training, date);
    const status =
      kind === "rescheduled-rest"
        ? "descanso por reagendamento"
        : kind === "medical-kit"
          ? "protegido por Kit Médico"
          : kind === "extra-rest"
            ? "descanso extra autorizado"
            : kind === "scheduled-rest"
              ? "descanso programado"
              : kind === "compensatory"
                ? "treino compensatório"
                : "treino programado";
    return (
      status +
      (activeDays.has(date)
        ? isTrainingDay(kind)
          ? ", treino registrado"
          : ", treino voluntário sem pontos extras"
        : missed(date)
          ? ", treino não realizado"
          : date > today
            ? ", dia futuro"
            : ", sem treino")
    );
  }
  function mark(date: string) {
    const kind = trainingDayKind(training, date);
    if (kind === "rescheduled-rest") return <ArrowRightLeft size={12} />;
    if (kind === "medical-kit") return <BriefcaseMedical size={12} />;
    if (kind === "extra-rest") return <Coffee size={12} />;
    if (kind === "scheduled-rest") return <Moon size={12} />;
    if (activeDays.has(date)) return <Flame size={12} fill="currentColor" />;
    if (missed(date)) return <X size={12} />;
    return kind === "compensatory" ? (
      <CalendarClock size={12} />
    ) : (
      <Dumbbell size={12} />
    );
  }
  const monthLabel = formatDay(`${month}-01`, {
    month: "long",
    year: "numeric",
  });
  function move(delta: number) {
    const next = shiftMonth(month, delta);
    onView({
      month: next,
      day: next === today.slice(0, 7) ? today : `${next}-01`,
    });
  }
  return (
    <div className="workouts-page">
      <div className="screen-heading">
        <h1 id="page-title" tabIndex={-1}>
          Treinos
        </h1>
        <div className="calendar-actions">
          {onReports && (
            <button
              className="icon-button"
              aria-label="Relatórios de evolução"
              onClick={onReports}
            >
              <BarChart3 size={21} />
            </button>
          )}
          <button
            className="outline-button"
            aria-label={
              trained ? "Treino de hoje concluído" : "Registrar treino"
            }
            disabled={trained}
            onClick={onRegister}
          >
            {trained ? <Check size={18} /> : <Plus size={18} />}
            {trained ? "Hoje tá pago" : "Registrar hoje"}
          </button>
        </div>
      </div>
      {schedule && (
        <TrainingScheduleSettings training={schedule} onLogin={onLogin} />
      )}
      <section className="card month-card" aria-label="Calendário de treinos">
        <div className="month-heading">
          <button
            className="icon-button"
            aria-label="Mês anterior"
            disabled={month <= "2000-01"}
            onClick={() => move(-1)}
          >
            <ChevronLeft size={21} />
          </button>
          <h2 aria-live="polite">{monthLabel}</h2>
          <button
            className="icon-button"
            aria-label="Próximo mês"
            disabled={month >= "9998-12"}
            onClick={() => move(1)}
          >
            <ChevronRight size={21} />
          </button>
        </div>
        <div className="month-summary">
          <span>
            <Flame size={15} />
            <strong>{activeDays.size}</strong>{" "}
            {activeDays.size === 1 ? "dia ativo" : "dias ativos"}
          </span>
          <span>
            <Clock3 size={15} />
            {monthWorkouts.reduce((sum, w) => sum + w.minutes, 0)} min
          </span>
          <button
            className="text-button"
            onClick={() => onView({ month: today.slice(0, 7), day: today })}
          >
            Hoje
          </button>
        </div>
        <table className="month-grid">
          <caption className="sr-only">Treinos de {monthLabel}</caption>
          <thead>
            <tr>
              {[
                "Segunda-feira",
                "Terça-feira",
                "Quarta-feira",
                "Quinta-feira",
                "Sexta-feira",
                "Sábado",
                "Domingo",
              ].map((name) => (
                <th key={name} scope="col">
                  <abbr title={name}>{name[0]}</abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: days.length / 7 }, (_, row) => (
              <tr key={row}>
                {days.slice(row * 7, row * 7 + 7).map((date) => (
                  <td key={date}>
                    {date.startsWith(month) ? (
                      <button
                        className={`month-day ${activeDays.has(date) ? "has-workout" : ""} ${!isTrainingDay(trainingDayKind(training, date)) ? "is-rest" : ""} ${rescheduleFor(training, date) ? "is-rescheduled" : ""} ${missed(date) ? "is-missed" : ""} ${date === today ? "is-today" : ""} ${date === day ? "is-selected" : ""}`}
                        data-day={date}
                        aria-label={`${formatDay(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${description(date)}`}
                        aria-pressed={date === day}
                        aria-current={date === today ? "date" : undefined}
                        onClick={() => onView({ month, day: date })}
                      >
                        <span>{Number(date.slice(-2))}</span>
                        <span className="day-mark" aria-hidden="true">
                          {mark(date)}
                          {!isTrainingDay(trainingDayKind(training, date)) &&
                            activeDays.has(date) && <Check size={10} />}
                        </span>
                      </button>
                    ) : (
                      <span className="month-outside" aria-hidden="true">
                        {Number(date.slice(-2))}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="calendar-legend">
          <span>
            <Flame size={13} fill="currentColor" />
            Treinou
          </span>
          <span className="today-legend">Hoje</span>
          <span className="rest-legend">
            <Moon size={13} /> Descanso
          </span>
          <span className="rest-legend">
            <ArrowRightLeft size={13} /> Reagendado
          </span>
          <span className="rest-legend">
            <BriefcaseMedical size={13} /> Kit
          </span>
          <span className="missed-legend">
            <X size={13} /> Não realizado
          </span>
        </div>
      </section>
      <section
        className="card day-detail"
        aria-label="Treinos do dia selecionado"
      >
        <div className="section-heading">
          <h2>
            <CalendarDays size={18} />
            {formatDay(day, { day: "numeric", month: "long" })}
          </h2>
        </div>
        {selectedSwap && (
          <p className="day-rest-note swap-detail">
            <ArrowRightLeft size={17} />
            {selectedSwap.originalDay === day
              ? `Treino transferido para ${formatDay(selectedSwap.targetDay, { weekday: "long", day: "numeric", month: "short" })}`
              : `Treino reagendado de ${formatDay(selectedSwap.originalDay, { weekday: "long", day: "numeric", month: "short" })}`}
            <small>
              {selectedSwap.originalDay === day
                ? "Descanso por reagendamento, sem pontos extras"
                : "Treino compensatório obrigatório"}
            </small>
          </p>
        )}
        {!isTrainingDay(selectedKind) &&
          selectedKind !== "rescheduled-rest" && (
            <p className="day-rest-note">
              {selectedKind === "medical-kit" ? (
                <BriefcaseMedical size={17} />
              ) : selectedKind === "extra-rest" ? (
                <Coffee size={17} />
              ) : (
                <Moon size={17} />
              )}
              {selectedKind === "medical-kit"
                ? "Protegido por Kit Médico"
                : selectedKind === "extra-rest"
                  ? "Descanso extra autorizado"
                  : "Descanso programado"}
              <small>A chama se mantém, sem pontos extras</small>
            </p>
          )}
        {selected.length ? (
          <ul className="day-workouts">
            {selected.map((w) => (
              <WorkoutRow key={w.id} workout={w} />
            ))}
          </ul>
        ) : (
          <p className="calendar-empty">
            {!isTrainingDay(selectedKind)
              ? "Recupera as energias, sua chama tá segura"
              : day === today
                ? "Sua chama ainda está esperando por você"
                : "Sem treino registrado neste dia"}
          </p>
        )}
        {day === today &&
          !trained &&
          isTrainingDay(selectedKind) &&
          training &&
          onRest && (
            <div className="extra-rest-action">
              <button
                type="button"
                className="outline-button"
                disabled={
                  restBusy || extraRestsRemaining(training, today) === 0
                }
                onClick={onRest}
              >
                <Moon size={17} /> Descansar hoje
              </button>
              <small>
                {extraRestsRemaining(training, today)}/
                {training.weeklyExtraLimit} extras disponíveis nesta semana
              </small>
            </div>
          )}
        {schedule && (
          <RescheduleTraining
            day={day}
            workouts={workouts}
            training={schedule}
            onSaved={(target) => {
              onView({ month: target.slice(0, 7), day: target });
              onRescheduled?.(target);
            }}
          />
        )}
        {onKits && (
          <button className="outline-button calendar-kits" onClick={onKits}>
            <BriefcaseMedical size={17} /> Kits Médicos{" "}
            <span>{kits ?? "—"}</span>
          </button>
        )}
      </section>
      <details className="card month-history">
        <summary>Treinos do mês ({monthWorkouts.length})</summary>
        {monthWorkouts.length ? (
          <ul className="day-workouts">
            {monthWorkouts.map((w) => (
              <WorkoutRow key={w.id} workout={w} showDate />
            ))}
          </ul>
        ) : (
          <p className="calendar-empty">Nenhum treino neste mês</p>
        )}
      </details>
    </div>
  );
}
function WorkoutRow({
  workout: w,
  showDate = false,
}: {
  workout: Workout;
  showDate?: boolean;
}) {
  const time = w.confirmedAt ?? w.recordedAt;
  return (
    <li className="history-row">
      <span className="activity-icon">
        <Dumbbell size={19} />
      </span>
      <div>
        <strong>{w.activity}</strong>
        <small>
          {showDate && `${formatDay(w.date)} · `}
          {w.minutes} min
          {time && (
            <>
              {" "}
              ·{" "}
              <time dateTime={time}>
                {new Date(time).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </>
          )}
        </small>
      </div>
      <span
        className="locked-record"
        aria-label="Treino confirmado, sem edição"
        title="Confirmação permanente"
      >
        <LockKeyhole size={16} />
      </span>
    </li>
  );
}
