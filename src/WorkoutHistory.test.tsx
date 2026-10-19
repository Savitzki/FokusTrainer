import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import WorkoutHistory from "./WorkoutHistory";
import { shiftDate, type Workout } from "./model";
it("renderiza vinte registros por vez, recentes primeiro, e permite consultar todos", async () => {
  const workouts: Workout[] = Array.from({ length: 45 }, (_, i) => ({
    id: String(i),
    date: shiftDate("2026-08-01", i),
    activity: `Atividade ${i}`,
    minutes: 35,
    method: "manual",
    confirmedAt: `${shiftDate("2026-08-01", i)}T12:00:00Z`,
  }));
  render(<WorkoutHistory workouts={workouts} timezone="UTC" />);
  const region = screen.getByRole("region", { name: "Histórico de treinos" });
  expect(within(region).getAllByRole("listitem")).toHaveLength(20);
  expect(within(region).getAllByRole("listitem")[0]).toHaveTextContent(
    "Atividade 44",
  );
  await userEvent.click(
    screen.getByRole("button", { name: /Carregar mais treinos/ }),
  );
  expect(within(region).getAllByRole("listitem")).toHaveLength(40);
  await userEvent.click(
    screen.getByRole("button", { name: /Carregar mais treinos/ }),
  );
  expect(within(region).getAllByRole("listitem")).toHaveLength(45);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("distingue confirmação, fila offline e registro anterior sem inventar avaliação", async () => {
  render(
    <WorkoutHistory
      workouts={[
        {
          id: "one",
          date: "2026-10-19",
          activity: "Confirmada",
          minutes: 35,
          method: "timed",
          confirmedAt: "2026-10-19T15:00:00Z",
          review: { intensity: 3, feeling: "great", completion: "partial" },
        },
        {
          id: "two",
          date: "2026-10-18",
          activity: "Offline",
          minutes: 35,
          method: "manual",
        },
        { id: "old", date: "2020-02-02", activity: "Antiga", minutes: 20 },
      ]}
      timezone="America/Sao_Paulo"
    />,
  );
  expect(screen.getByText("Confirmado")).toBeVisible();
  expect(screen.getByText("Aguardando sincronização")).toBeVisible();
  expect(screen.getAllByText("Registro anterior")).toHaveLength(1);
  expect(screen.getByText("12:00")).toBeVisible();
  await userEvent.click(screen.getByText("Ver avaliação"));
  expect(screen.getByText(/Intensidade 3\/5/)).toBeVisible();
  expect(
    screen.queryByText("Avaliação não preenchida"),
  ).not.toBeInTheDocument();
});
