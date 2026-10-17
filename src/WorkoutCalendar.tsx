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
} from "lucide-react";
import { calendarDays, shiftMonth } from "./calendar";
import { formatDay, type Workout } from "./model";
export type CalendarView = { month: string; day: string };
export default function WorkoutCalendar({
  workouts,
  today,
  view,
  onView,
  onRegister,
}: {
  workouts: Workout[];
  today: string;
  view: CalendarView;
  onView: (view: CalendarView) => void;
  onRegister: () => void;
}) {
  const { month, day } = view;
  const days = calendarDays(month);
  const monthWorkouts = workouts
    .filter((w) => w.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
  const activeDays = new Set(monthWorkouts.map((w) => w.date));
  const selected = workouts.filter((w) => w.date === day);
  const trained = workouts.some((w) => w.date === today);
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
        <button
          className="outline-button"
          aria-label={trained ? "Treino de hoje concluído" : "Registrar treino"}
          disabled={trained}
          onClick={onRegister}
        >
          {trained ? <Check size={18} /> : <Plus size={18} />}
          {trained ? "Hoje tá pago" : "Registrar hoje"}
        </button>
      </div>
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
            disabled={month >= today.slice(0, 7)}
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
                        className={`month-day ${activeDays.has(date) ? "has-workout" : ""} ${date === today ? "is-today" : ""} ${date === day ? "is-selected" : ""}`}
                        data-day={date}
                        aria-label={`${formatDay(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${date > today ? "dia futuro" : activeDays.has(date) ? "treino registrado" : "sem treino"}`}
                        aria-pressed={date === day}
                        aria-current={date === today ? "date" : undefined}
                        disabled={date > today}
                        onClick={() => onView({ month, day: date })}
                      >
                        <span>{Number(date.slice(-2))}</span>
                        <span className="day-mark" aria-hidden="true">
                          {activeDays.has(date) && (
                            <Flame size={12} fill="currentColor" />
                          )}
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
        {selected.length ? (
          <ul className="day-workouts">
            {selected.map((w) => (
              <WorkoutRow key={w.id} workout={w} />
            ))}
          </ul>
        ) : (
          <p className="calendar-empty">
            {day === today
              ? "Sua chama ainda está esperando por você"
              : "Sem treino registrado neste dia"}
          </p>
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
