import { useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { DAY_NAMES, readProgressReport } from "./gamification";
import { useGameResource } from "./useGamification";
import { weekStart } from "./training";
import { formatDay, shiftDate } from "./model";
import { shiftMonth } from "./calendar";

export function Sparkline({
  values,
  label,
  percent = false,
}: {
  values: number[];
  label: string;
  percent?: boolean;
}) {
  if (values.length < 2)
    return (
      <p className="field-hint">Mais registros vão revelar sua evolução</p>
    );
  const min = percent ? 0 : Math.min(...values),
    span = percent ? 100 : Math.max(...values) - min || 1;
  return (
    <svg
      className="progress-chart"
      viewBox="0 0 300 80"
      role="img"
      aria-label={label}
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
        points={values
          .map(
            (v, i) =>
              `${5 + (i * 290) / (values.length - 1)},${70 - ((v - min) * 60) / span}`,
          )
          .join(" ")}
      />
    </svg>
  );
}
export default function ProgressReports({
  userId,
  today,
  timezone,
  onClose,
}: {
  userId: string;
  today: string;
  timezone: string;
  onClose: () => void;
}) {
  const [period, setPeriod] = useState<"week" | "month">("week"),
    [start, setStart] = useState(weekStart(today));
  const report = useGameResource(
    userId,
    "get_progress_report",
    { p_period: period, p_start: start, p_timezone: timezone },
    readProgressReport,
  );
  const r = report.state,
    s = r?.summary;
  function move(delta: number) {
    setStart(
      period === "week"
        ? shiftDate(start, delta * 7)
        : `${shiftMonth(start.slice(0, 7), delta)}-01`,
    );
  }
  const end =
    period === "week"
      ? shiftDate(start, 6)
      : `${shiftMonth(start.slice(0, 7), 1)}-01`;
  return (
    <section className="progress-reports" aria-labelledby="reports-title">
      <div className="section-heading">
        <h2 id="reports-title">
          <BarChart3 size={20} /> Sua evolução
        </h2>
        <button className="text-button" onClick={onClose}>
          Voltar ao calendário
        </button>
      </div>
      <div className="segmented-control">
        {(["week", "month"] as const).map((p) => (
          <button
            key={p}
            aria-pressed={period === p}
            onClick={() => {
              setPeriod(p);
              setStart(
                p === "week" ? weekStart(today) : today.slice(0, 7) + "-01",
              );
            }}
          >
            {p === "week" ? "Semanal" : "Mensal"}
          </button>
        ))}
      </div>
      <div className="report-period">
        <button
          className="icon-button"
          aria-label="Período anterior"
          disabled={start <= "2000-02-01"}
          onClick={() => move(-1)}
        >
          <ChevronLeft />
        </button>
        <strong>
          {formatDay(start, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </strong>
        <button
          className="icon-button"
          aria-label="Próximo período"
          disabled={end >= today}
          onClick={() => move(1)}
        >
          <ChevronRight />
        </button>
      </div>
      {report.busy && <p role="status">Atualizando relatório…</p>}
      {report.error && (
        <p className="form-error" role="alert">
          {report.error}
          <button className="text-button" onClick={() => void report.refresh()}>
            Tentar novamente
          </button>
        </p>
      )}
      {r && s && (
        <>
          <p className="field-hint">
            {r.partial
              ? "Período em andamento · percentual só dos dias já devidos"
              : "Período encerrado"}{" "}
            · Horários de {r.timezone}
          </p>
          <div className="report-stats">
            {[
              [s.completed, "treinos"],
              [s.planned, "programados"],
              [
                s.compliance === null
                  ? "—"
                  : `${s.compliance.toLocaleString("pt-BR")}%`,
                "cumprimento",
              ],
              [s.minutes, "minutos"],
              [
                s.average === null
                  ? "—"
                  : `${s.average.toLocaleString("pt-BR")} min`,
                "duração média",
              ],
              [r.streak.current, "ofensiva atual"],
              [r.streak.best, "recorde"],
            ].map(([v, label]) => (
              <div key={label}>
                <strong>{v}</strong>
                <small>{label}</small>
              </div>
            ))}
          </div>
          <p className="field-hint">
            {s.mandatory_completed}/{s.due} obrigações cumpridas · {s.missed}{" "}
            faltas sem proteção
          </p>
          {s.completed === 1 && (
            <p className="field-hint">
              A duração média ainda reflete apenas um treino
            </p>
          )}
          <div className="report-days">
            {r.days.map((d) => (
              <span
                key={d.day}
                className={`report-day ${d.kind} ${d.completed ? "done" : d.day < r.today && ["training", "compensatory"].includes(d.kind) ? "missed" : ""}`}
                title={`${formatDay(d.day)}: ${DAY_NAMES[d.kind]}${d.completed ? " · concluído" : ""}`}
                aria-label={`${formatDay(d.day)}: ${DAY_NAMES[d.kind]}${d.completed ? " · concluído" : d.day < r.today && ["training", "compensatory"].includes(d.kind) ? " · falta" : ""}`}
              >
                {Number(d.day.slice(-2))}
              </span>
            ))}
          </div>
          <div className="report-legend">
            <span>● Concluído</span>
            <span>☾ Descanso</span>
            <span>↔ Reagendado</span>
            <span>☕ Extra</span>
            <span>✚ Kit</span>
            <span>× Falta</span>
          </div>
          <h3>Consistência entre semanas</h3>
          <Sparkline
            values={r.weeks
              .filter((w) => w.planned > 0)
              .filter((w) => !w.partial)
              .map((w) => (100 * w.completed) / w.planned)}
            label="Percentual de cumprimento em semanas encerradas"
            percent
          />
          <ul className="compact-history">
            {r.weeks.map((w) => (
              <li key={w.week_start}>
                <span>
                  {formatDay(w.week_start, { day: "numeric", month: "short" })}
                </span>
                <strong>
                  {w.planned
                    ? `${Math.round((100 * w.completed) / w.planned)}%`
                    : "Sem obrigação"}{" "}
                  {w.fulfilled ? "✓" : ""}
                  {w.partial ? " · parcial" : ""}
                </strong>
              </li>
            ))}
          </ul>
          <h3>Missões por semana</h3>
          {r.goals.length ? (
            <ul className="compact-history">
              {r.goals.map((g) => (
                <li key={g.weekStart}>
                  <span>
                    {formatDay(g.weekStart, { day: "numeric", month: "short" })}
                  </span>
                  <strong>
                    {g.completed}/{g.total}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="field-hint">As próximas missões entram aqui</p>
          )}
          <h3>Peso · só você vê</h3>
          <Sparkline
            values={r.weights.map((w) => w.kg)}
            label="Evolução privada do peso no período"
          />
          {r.weights.length > 0 && (
            <p className="field-hint">
              {r.weights[0].kg.toLocaleString("pt-BR")} →{" "}
              {r.weights.at(-1)!.kg.toLocaleString("pt-BR")} kg ·{" "}
              {r.weights.length} registros
            </p>
          )}
        </>
      )}
    </section>
  );
}
