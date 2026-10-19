import { useState } from "react";
import Modal from "./Modal";
import PageHeading from "./PageHeading";
import {
  ChevronLeft,
  ChevronRight,
  Moon,
  BriefcaseMedical,
  ArrowRightLeft,
  Coffee,
  BarChart3,
  Dumbbell,
} from "lucide-react";
import { calendarDays, shiftMonth } from "./calendar";
import { formatDay, type Workout } from "./model";
import RescheduleTraining from "./RescheduleTraining";
import TrainingScheduleSettings from "./TrainingScheduleSettings";
import WorkoutHistory, { WorkoutRow } from "./WorkoutHistory";
import type { TrainingController } from "./useTrainingPlan";
import type { TrainingCalendarMonth } from "./useTrainingCalendar";
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
  training,
  schedule,
  onLogin = () => {},
  onRescheduled,
  onKits,
  kits,
  onRest,
  restBusy = false,
  onReports,
  calendar,
}: {
  workouts: Workout[];
  today: string;
  view: CalendarView;
  onView: (view: CalendarView) => void;
  onRegister?: () => void;
  training?: TrainingState | null;
  schedule?: TrainingController;
  onLogin?: () => void;
  onRescheduled?: (target: string) => void;
  onKits?: () => void;
  kits?: number;
  onRest?: () => void;
  restBusy?: boolean;
  onReports?: () => void;
  calendar?: {
    state: TrainingCalendarMonth | null;
    error: string;
    busy: boolean;
    refresh: () => Promise<unknown>;
  };
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { month, day } = view,
    days = calendarDays(month);
  const state = calendar?.state?.month === month ? calendar.state : null;
  const snapshots = new Map(state?.days.map((d) => [d.day, d]));
  const kindFor = (date: string) =>
    snapshots.get(date)?.kind ??
    (training ? trainingDayKind(training, date) : "unplanned");
  const selected = workouts.filter((w) => w.date === day),
    trained = workouts.some((w) => w.date === today);
  const selectedKind = kindFor(day),
    selectedSnapshot = snapshots.get(day),
    selectedSwap = rescheduleFor(training, day);
  const monthLabel = formatDay(`${month}-01`, {
    month: "long",
    year: "numeric",
  });
  function move(delta: number) {
    setDetailsOpen(false);
    const next = shiftMonth(month, delta);
    onView({
      month: next,
      day: next === today.slice(0, 7) ? today : `${next}-01`,
    });
  }
  function description(date: string) {
    const snapshot = snapshots.get(date),
      kind = kindFor(date),
      record = workouts.some((w) => w.date === date);
    const label =
      kind === "unplanned"
        ? "sem plano de treino"
        : kind === "rescheduled-rest"
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
      label +
      (record
        ? isTrainingDay(kind) || kind === "unplanned"
          ? ", treino registrado"
          : ", treino voluntário sem pontos extras"
        : date > today
          ? ", dia futuro"
          : snapshot &&
              date < today &&
              isTrainingDay(kind) &&
              !snapshot.completed
            ? ", treino não realizado"
            : ", sem treino") +
      (snapshot?.active ? ", ofensiva ativa" : "")
    );
  }
  return (
    <div className="workouts-page">
      <PageHeading title="Treinos" icon={Dumbbell} />
      {schedule && (
        <TrainingScheduleSettings training={schedule} onLogin={onLogin} />
      )}
      <section
        className="card month-card streak-calendar"
        aria-label="Calendário da ofensiva"
      >
        <div className="section-heading">
          <h2>Calendário da ofensiva</h2>
          <button
            className="text-button"
            onClick={() => onView({ month: today.slice(0, 7), day: today })}
          >
            Hoje
          </button>
        </div>
        <div className="month-heading">
          <button
            className="icon-button"
            aria-label="Mês anterior"
            disabled={month <= "2000-01"}
            onClick={() => move(-1)}
          >
            <ChevronLeft size={21} />
          </button>
          <h3 aria-live="polite">{monthLabel}</h3>
          <button
            className="icon-button"
            aria-label="Próximo mês"
            disabled={month >= "9998-12"}
            onClick={() => move(1)}
          >
            <ChevronRight size={21} />
          </button>
        </div>
        {calendar?.busy && !state && (
          <small role="status">Consultando a ofensiva…</small>
        )}
        {calendar?.error && (
          <p className="field-hint">
            Não foi possível atualizar a ofensiva{" "}
            <button
              className="text-button"
              onClick={() => void calendar.refresh()}
            >
              Tentar novamente
            </button>
          </p>
        )}
        <table className="month-grid">
          <caption className="sr-only">Ofensiva de {monthLabel}</caption>
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
                        className={`month-day ${snapshots.get(date)?.active ? "has-streak" : ""} ${date === today ? "is-today" : ""} ${date === day ? "is-selected" : ""}`}
                        data-day={date}
                        data-streak={
                          snapshots.has(date)
                            ? snapshots.get(date)!.active
                              ? "active"
                              : "inactive"
                            : "unknown"
                        }
                        aria-label={`${formatDay(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${description(date)}`}
                        aria-pressed={date === day}
                        aria-current={date === today ? "date" : undefined}
                        onClick={() => {
                          onView({ month, day: date });
                          setDetailsOpen(true);
                        }}
                      >
                        {Number(date.slice(-2))}
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
        {detailsOpen && (
          <Modal
            title={formatDay(day, { day: "numeric", month: "long" })}
            compactHeader
            onClose={() => setDetailsOpen(false)}
          >
            <div
              className="day-detail"
              role="region"
              aria-label="Treinos do dia selecionado"
            >
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
                selectedKind !== "rescheduled-rest" &&
                selectedKind !== "unplanned" && (
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
                  </p>
                )}
              {selected.length ? (
                <ul className="day-workouts">
                  {selected.map((w) => (
                    <WorkoutRow
                      key={w.id}
                      workout={w}
                      timezone={training?.timezone}
                    />
                  ))}
                </ul>
              ) : (
                <p className="calendar-empty">
                  {selectedKind === "unplanned"
                    ? training?.planRequired
                      ? "Crie seu plano para começar"
                      : "Nenhum plano em vigor nesta data"
                    : !isTrainingDay(selectedKind)
                      ? selectedSnapshot?.active
                        ? "Ofensiva preservada neste descanso"
                        : "Dia de descanso"
                      : day === today
                        ? "Treino programado"
                        : "Sem treino registrado neste dia"}
                </p>
              )}
              {selectedKind !== "unplanned" &&
                (onKits || onRest || schedule?.enabled) && (
                  <div className="day-actions">
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
                              restBusy ||
                              extraRestsRemaining(training, today) === 0
                            }
                            onClick={() => {
                              setDetailsOpen(false);
                              onRest();
                            }}
                          >
                            <Moon size={17} /> Descansar hoje
                          </button>
                          <small>
                            {extraRestsRemaining(training, today)}/
                            {training.weeklyExtraLimit} extras disponíveis nesta
                            semana
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
                      <button
                        className="outline-button calendar-kits"
                        onClick={() => {
                          setDetailsOpen(false);
                          onKits();
                        }}
                      >
                        <BriefcaseMedical size={17} /> Kits Médicos{" "}
                        <span>{kits ?? "—"}</span>
                      </button>
                    )}
                  </div>
                )}
            </div>
          </Modal>
        )}
      </section>
      {onReports && (
        <button
          className="outline-button workout-reports-link"
          onClick={onReports}
        >
          <BarChart3 size={19} aria-hidden="true" /> Relatórios de evolução
        </button>
      )}
      <WorkoutHistory workouts={workouts} timezone={training?.timezone} />
    </div>
  );
}
