import { useMemo, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { formatDay, type Workout } from "./model";
import {
  METHOD_NAMES,
  FEELING_NAMES,
  COMPLETION_NAMES,
} from "./workoutRecording";
export const HISTORY_PAGE_SIZE = 20;
export default function WorkoutHistory({
  workouts,
  timezone,
}: {
  workouts: Workout[];
  timezone?: string;
}) {
  const [limit, setLimit] = useState(HISTORY_PAGE_SIZE);
  const sorted = useMemo(
    () =>
      [...workouts].sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          (b.confirmedAt ?? b.recordedAt ?? "").localeCompare(
            a.confirmedAt ?? a.recordedAt ?? "",
          ) ||
          a.id.localeCompare(b.id),
      ),
    [workouts],
  );
  return (
    <section className="card workout-history" aria-label="Histórico de treinos">
      <div className="section-heading">
        <h2>Histórico de treinos</h2>
        <small>{sorted.length}</small>
      </div>
      {sorted.length ? (
        <>
          <ul className="day-workouts">
            {sorted.slice(0, limit).map((w) => (
              <WorkoutRow key={w.id} workout={w} showDate timezone={timezone} />
            ))}
          </ul>
          {limit < sorted.length && (
            <button
              className="outline-button history-more"
              onClick={() => setLimit((n) => n + HISTORY_PAGE_SIZE)}
            >
              Carregar mais treinos{" "}
              <span>
                ({Math.min(limit, sorted.length)}/{sorted.length})
              </span>
            </button>
          )}
        </>
      ) : (
        <p className="calendar-empty">Seus treinos confirmados aparecem aqui</p>
      )}
    </section>
  );
}
export function WorkoutRow({
  workout: w,
  showDate = false,
  timezone,
}: {
  workout: Workout;
  showDate?: boolean;
  timezone?: string;
}) {
  const time = w.confirmedAt ?? w.recordedAt;
  const pending =
    (w.method === "manual" || w.method === "timed") && !w.confirmedAt;
  return (
    <li className="history-row workout-history-row">
      <div>
        <strong>{w.activity}</strong>
        <small>
          {showDate &&
            `${formatDay(w.date, { day: "numeric", month: "short", year: "numeric" })} · `}
          {w.minutes} min
          {time && (
            <>
              {" "}
              ·{" "}
              <time dateTime={time}>
                {new Date(time).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: timezone,
                })}
              </time>
            </>
          )}
        </small>
        <div className="workout-row-status">
          <span>{METHOD_NAMES[w.method ?? "legacy"]}</span>
          {(pending || w.confirmedAt) && (
            <span>{pending ? "Aguardando sincronização" : "Confirmado"}</span>
          )}
        </div>
        {w.review && (
          <details className="workout-record-detail">
            <summary>Ver avaliação</summary>
            <p>
              Intensidade {w.review.intensity}/5 ·{" "}
              {FEELING_NAMES[w.review.feeling]}
              <br />
              {COMPLETION_NAMES[w.review.completion]}
            </p>
          </details>
        )}
      </div>
      {!pending && w.confirmedAt && (
        <span
          className="locked-record"
          aria-label="Treino confirmado, sem edição"
        >
          <LockKeyhole size={15} />
        </span>
      )}
    </li>
  );
}
