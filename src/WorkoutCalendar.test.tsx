import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import WorkoutCalendar, { type CalendarView } from "./WorkoutCalendar";
import type { Workout } from "./model";
import type { TrainingState } from "./training";

const workouts: Workout[] = Array.from({ length: 8 }, (_, i) => ({
  id: `old-${i}`,
  date: `2024-02-${String(i + 1).padStart(2, "0")}`,
  activity: `Treino ${i + 1}`,
  minutes: 30,
  recordedAt: `2024-02-${String(i + 1).padStart(2, "0")}T12:15:00Z`,
}));
workouts.push({
  id: "legacy",
  date: "2024-02-01",
  activity: "Caminhada extra",
  minutes: 10,
});
function Harness({
  entries = workouts,
  onRegister = vi.fn(),
}: {
  entries?: Workout[];
  onRegister?: () => void;
}) {
  const [view, onView] = useState<CalendarView>({
    month: "2024-03",
    day: "2024-03-17",
  });
  return (
    <WorkoutCalendar
      workouts={entries}
      today="2024-03-17"
      view={view}
      onView={onView}
      onRegister={onRegister}
    />
  );
}
describe("consulta de treinos", () => {
  it("diferencia treino, descanso e falta, e oferece a autorização extra apenas para hoje", async () => {
    const user = userEvent.setup(),
      onRest = vi.fn();
    const training: TrainingState = {
      revision: 2,
      timezone: "UTC",
      today: "2026-10-17",
      startedOn: "2026-10-12",
      weeklyExtraLimit: 2,
      plans: [
        {
          revision: 1,
          effectiveFrom: "2026-10-12",
          trainingDays: [1, 3, 5, 6],
        },
      ],
      extraRests: ["2026-10-14"],
    };
    render(
      <WorkoutCalendar
        workouts={[
          {
            id: "monday",
            date: "2026-10-12",
            activity: "Corrida",
            minutes: 20,
          },
        ]}
        today="2026-10-17"
        view={{ month: "2026-10", day: "2026-10-17" }}
        training={training}
        onView={vi.fn()}
        onRegister={vi.fn()}
        onRest={onRest}
      />,
    );
    expect(document.querySelector('[data-day="2026-10-12"]')).toHaveClass(
      "has-workout",
    );
    expect(
      document.querySelector('[data-day="2026-10-13"]'),
    ).toHaveAccessibleName(/descanso programado/);
    expect(
      document.querySelector('[data-day="2026-10-14"]'),
    ).toHaveAccessibleName(/descanso extra autorizado/);
    expect(
      document.querySelector('[data-day="2026-10-16"]'),
    ).toHaveAccessibleName(/treino não realizado/);
    expect(
      screen.getByText("1/2 extras disponíveis nesta semana"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Descansar hoje" }));
    expect(onRest).toHaveBeenCalledOnce();
  });
  it("consulta meses anteriores e todos os registros, preservando duplicados antigos sem permitir edição", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Próximo mês" })).toBeEnabled();
    expect(document.querySelector('[data-day="2024-03-18"]')).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(
      screen.getByRole("heading", { name: "fevereiro de 2024" }),
    ).toBeInTheDocument();
    expect(screen.getByText("dias ativos")).toHaveTextContent("8 dias ativos");
    expect(screen.getByText("250 min")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-day]")).toHaveLength(29);
    const detail = screen.getByRole("region", {
      name: "Treinos do dia selecionado",
    });
    expect(within(detail).getAllByRole("listitem")).toHaveLength(2);
    expect(within(detail).getByText("Caminhada extra")).toBeInTheDocument();
    expect(detail.querySelector("time")).toHaveAttribute(
      "dateTime",
      "2024-02-01T12:15:00Z",
    );
    await user.click(screen.getByText("Treinos do mês (9)"));
    expect(
      within(
        screen.getByText("Treinos do mês (9)").parentElement!,
      ).getAllByRole("listitem"),
    ).toHaveLength(9);
    await user.click(document.querySelector('[data-day="2024-02-08"]')!);
    expect(within(detail).getByText("Treino 8")).toBeInTheDocument();
    expect(within(detail).queryByText("Treino 1")).not.toBeInTheDocument();
    await user.click(document.querySelector('[data-day="2024-02-29"]')!);
    expect(
      within(detail).getByText("Sem treino registrado neste dia"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Editar|Excluir/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hoje" }));
    expect(
      screen.getByRole("heading", { name: "março de 2024" }),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-day="2024-03-17"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("o botão registra somente hoje mesmo durante a consulta ao passado e bloqueia após a confirmação", async () => {
    const user = userEvent.setup();
    const onRegister = vi.fn();
    const view = render(<Harness onRegister={onRegister} />);
    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    await user.click(screen.getByRole("button", { name: "Registrar treino" }));
    expect(onRegister).toHaveBeenCalledOnce();
    view.rerender(
      <Harness
        entries={[
          ...workouts,
          { id: "today", date: "2024-03-17", activity: "Corrida", minutes: 20 },
        ]}
        onRegister={onRegister}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Treino de hoje concluído" }),
    ).toBeDisabled();
  });
});

it("explica a transferência e a compensação, mantendo os dias futuros consultáveis", async () => {
  const user = userEvent.setup();
  const training: TrainingState = {
    revision: 2,
    timezone: "UTC",
    today: "2026-10-20",
    startedOn: "2026-10-12",
    weeklyExtraLimit: 2,
    weeklyRescheduleLimit: 2,
    plans: [
      {
        revision: 1,
        effectiveFrom: "2026-10-12",
        trainingDays: [1, 2, 3, 5, 6],
      },
    ],
    extraRests: [],
    reschedules: [
      {
        id: "s",
        originalDay: "2026-10-20",
        targetDay: "2026-10-22",
        weekStart: "2026-10-19",
        createdAt: "2026-10-20T10:00:00Z",
        revision: 2,
      },
    ],
  };
  function TransferCalendar() {
    const [view, onView] = useState({ month: "2026-10", day: "2026-10-20" });
    return (
      <WorkoutCalendar
        workouts={[]}
        today={training.today}
        training={training}
        view={view}
        onView={onView}
        onRegister={vi.fn()}
      />
    );
  }
  render(<TransferCalendar />);
  expect(
    document.querySelector('[data-day="2026-10-20"]'),
  ).toHaveAccessibleName(/descanso por reagendamento/);
  expect(
    screen.getByText(/Treino transferido para quinta-feira/),
  ).toBeInTheDocument();
  const compensation = document.querySelector('[data-day="2026-10-22"]')!;
  expect(compensation).toHaveAccessibleName(/treino compensatório.*dia futuro/);
  await user.click(compensation);
  expect(
    screen.getByText(/Treino reagendado de terça-feira/),
  ).toBeInTheDocument();
  expect(screen.queryByText(/Treino transferido para/)).not.toBeInTheDocument();
  expect(
    screen.getByText("Treino compensatório obrigatório"),
  ).toBeInTheDocument();
});
