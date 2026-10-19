import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import WorkoutCalendar from "./WorkoutCalendar";
import type { TrainingState } from "./training";
import type { TrainingCalendarMonth } from "./useTrainingCalendar";
const training: TrainingState = {
  revision: 2,
  today: "2026-10-17",
  timezone: "UTC",
  startedOn: "2026-10-12",
  weeklyExtraLimit: 2,
  plans: [
    { revision: 1, effectiveFrom: "2026-10-12", trainingDays: [1, 3, 5, 6] },
  ],
  extraRests: ["2026-10-14"],
};
const calendar: TrainingCalendarMonth = {
  month: "2026-10",
  today: training.today,
  timezone: "UTC",
  revision: 2,
  days: [
    {
      day: "2026-10-12",
      kind: "training",
      completed: true,
      active: true,
      streak: 1,
    },
    {
      day: "2026-10-13",
      kind: "scheduled-rest",
      completed: false,
      active: true,
      streak: 1,
    },
    {
      day: "2026-10-14",
      kind: "extra-rest",
      completed: false,
      active: true,
      streak: 1,
    },
    {
      day: "2026-10-15",
      kind: "scheduled-rest",
      completed: false,
      active: true,
      streak: 1,
    },
    {
      day: "2026-10-16",
      kind: "training",
      completed: false,
      active: false,
      streak: 0,
    },
    {
      day: "2026-10-17",
      kind: "training",
      completed: false,
      active: false,
      streak: 0,
    },
  ],
};
it("usa snapshots para pintar descansos preservados, sem ícones nas datas nem legenda extensa", async () => {
  const onRest = vi.fn(),
    user = userEvent.setup();
  render(
    <WorkoutCalendar
      workouts={[
        {
          id: "w",
          date: "2026-10-12",
          activity: "Corrida",
          minutes: 35,
          confirmedAt: "2026-10-12T12:00:00Z",
        },
      ]}
      today={training.today}
      view={{ month: "2026-10", day: training.today }}
      onView={vi.fn()}
      training={training}
      calendar={{ state: calendar, error: "", busy: false, refresh: vi.fn() }}
      onRest={onRest}
    />,
  );
  expect(document.querySelector('[data-day="2026-10-13"]')).toHaveClass(
    "has-streak",
  );
  expect(document.querySelector('[data-day="2026-10-16"]')).not.toHaveClass(
    "has-streak",
  );
  expect(
    document.querySelector('[data-day="2026-10-16"]'),
  ).toHaveAccessibleName(/treino não realizado/);
  expect(document.querySelectorAll("[data-day] svg")).toHaveLength(0);
  expect(document.querySelector(".calendar-legend")).toBeNull();
  expect(
    screen.queryByRole("region", { name: "Treinos do dia selecionado" }),
  ).not.toBeInTheDocument();
  await user.click(document.querySelector('[data-day="2026-10-17"]')!);
  await user.click(screen.getByRole("button", { name: "Descansar hoje" }));
  expect(onRest).toHaveBeenCalledOnce();
});
it("não inventa uma ofensiva para descansos sem histórico confiável", () => {
  render(
    <WorkoutCalendar
      workouts={[]}
      today={training.today}
      view={{ month: "2026-10", day: "2026-10-13" }}
      onView={vi.fn()}
      training={training}
    />,
  );
  expect(document.querySelector('[data-day="2026-10-13"]')).toHaveAttribute(
    "data-streak",
    "unknown",
  );
  expect(document.querySelectorAll(".has-streak")).toHaveLength(0);
});
it("navega por meses, seleciona datas e deixa o histórico completo expandido", async () => {
  const user = userEvent.setup(),
    entries = [
      {
        id: "one",
        date: "2024-02-01",
        activity: "Caminhada",
        minutes: 35,
        confirmedAt: "2024-02-01T12:15:00Z",
      },
      {
        id: "two",
        date: "2024-02-01",
        activity: "Corrida antiga",
        minutes: 10,
      },
    ];
  function Harness() {
    const [view, onView] = useState({ month: "2024-03", day: "2024-03-17" });
    return (
      <WorkoutCalendar
        workouts={entries}
        today="2024-03-17"
        view={view}
        onView={onView}
      />
    );
  }
  render(<Harness />);
  await user.click(screen.getByRole("button", { name: "Mês anterior" }));
  expect(
    screen.getByRole("heading", { name: "fevereiro de 2024" }),
  ).toBeVisible();
  expect(document.querySelectorAll("[data-day]")).toHaveLength(29);
  await user.click(document.querySelector('[data-day="2024-02-01"]')!);
  const details = screen.getByRole("region", {
    name: "Treinos do dia selecionado",
  });
  expect(within(details).getAllByRole("listitem")).toHaveLength(2);
  const history = screen.getByRole("region", { name: "Histórico de treinos" });
  expect(history).toBeVisible();
  expect(within(history).getAllByRole("listitem")).toHaveLength(2);
  expect(within(history).getByText("Corrida antiga")).toBeVisible();
  expect(within(history).getAllByText("Registro anterior")).toHaveLength(2);
  await user.click(screen.getByRole("button", { name: "Fechar janela" }));
  await user.click(document.querySelector('[data-day="2024-02-29"]')!);
  expect(
    within(screen.getByRole("dialog")).queryByText("Caminhada"),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Fechar janela" }));
  await user.click(screen.getByRole("button", { name: "Hoje" }));
  expect(document.querySelector('[data-day="2024-03-17"]')).toHaveAttribute(
    "aria-current",
    "date",
  );
  expect(
    screen.queryByRole("button", { name: "Registrar treino" }),
  ).not.toBeInTheDocument();
});
it("mantém os dados do mês após erro e permite tentar novamente", () => {
  const refresh = vi.fn();
  render(
    <WorkoutCalendar
      workouts={[]}
      today={training.today}
      view={{ month: "2026-10", day: training.today }}
      onView={vi.fn()}
      calendar={{ state: calendar, error: "Offline", busy: false, refresh }}
    />,
  );
  expect(document.querySelector('[data-day="2026-10-13"]')).toHaveClass(
    "has-streak",
  );
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(refresh).toHaveBeenCalledOnce();
});
it("explica a transferência e compensação sem símbolos nas datas", async () => {
  const user = userEvent.setup(),
    state: TrainingState = {
      ...training,
      today: "2026-10-20",
      plans: [
        {
          revision: 1,
          effectiveFrom: "2026-10-12",
          trainingDays: [1, 2, 3, 5, 6],
        },
      ],
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
  function Harness() {
    const [view, onView] = useState({ month: "2026-10", day: state.today });
    return (
      <WorkoutCalendar
        workouts={[]}
        today={state.today}
        view={view}
        onView={onView}
        training={state}
      />
    );
  }
  render(<Harness />);
  await user.click(document.querySelector('[data-day="2026-10-20"]')!);
  expect(
    screen.getByText(/Treino transferido para quinta-feira/),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Fechar janela" }));
  await user.click(document.querySelector('[data-day="2026-10-22"]')!);
  expect(screen.getByText(/Treino reagendado de terça-feira/)).toBeVisible();
  expect(document.querySelector('[data-day="2026-10-22"] svg')).toBeNull();
});

it("coloca estatísticas depois do calendário e antes do histórico, mantendo a ação", async () => {
  const onReports = vi.fn();
  render(
    <WorkoutCalendar
      workouts={[]}
      today={training.today}
      view={{ month: "2026-10", day: training.today }}
      onView={vi.fn()}
      onReports={onReports}
    />,
  );
  const heading = screen.getByRole("heading", { level: 1, name: "Treinos" });
  expect(heading.querySelector("svg")).not.toBeNull();
  const calendar = screen.getByRole("region", {
    name: "Calendário da ofensiva",
  });
  const reports = screen.getByRole("button", {
    name: "Relatórios de evolução",
  });
  expect(
    calendar.compareDocumentPosition(reports) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(heading.parentElement).not.toContainElement(reports);
  await userEvent.click(reports);
  expect(onReports).toHaveBeenCalledOnce();
});
