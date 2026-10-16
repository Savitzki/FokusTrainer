import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";
import { localDate, STORAGE_KEY } from "./model";

describe("registro e persistência", () => {
  it("confirma o treino uma vez, bloqueia alterações e restaura ao reabrir", async () => {
    const user = userEvent.setup();
    const view = render(<App />);
    expect(
      screen.getByRole("img", { name: /Chama apagada/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Registrar treino" }));
    expect(screen.getByLabelText("Data")).toHaveAttribute("readonly");
    await user.type(screen.getByLabelText("Duração (minutos)"), "45");
    await user.click(screen.getByRole("button", { name: "Confirmar treino" }));
    expect(screen.getByText("dia de ofensiva")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Chama acesa/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Treino de hoje concluído" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /Excluir treino/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("1 treino no total")).toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).workouts,
    ).toHaveLength(1);
    view.unmount();
    render(<App />);
    expect(screen.getByText("1 treino no total")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Treino de hoje concluído" }),
    ).toBeDisabled();
  });
  it("aceita vírgula decimal e atualiza o peso da mesma data sem duplicar", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Registrar peso" }));
    await user.type(screen.getByLabelText("Peso (kg)"), "72,5");
    await user.click(screen.getByRole("button", { name: "Salvar peso" }));
    await user.click(screen.getByRole("button", { name: "Registrar peso" }));
    expect(
      screen.getByText(/Já existe um peso nesta data/),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Peso (kg)"), "72,8");
    await user.click(screen.getByRole("button", { name: "Atualizar peso" }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).weights).toEqual([
      { date: localDate(), kg: 72.8 },
    ]);
  });
  it("recusa peso inválido e confirma antes de excluir registros", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Registrar peso" }));
    await user.type(screen.getByLabelText("Peso (kg)"), "-12");
    await user.click(screen.getByRole("button", { name: "Salvar peso" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Informe um peso entre 20 e 500",
    );
    await user.clear(screen.getByLabelText("Peso (kg)"));
    await user.type(screen.getByLabelText("Peso (kg)"), "80");
    await user.click(screen.getByRole("button", { name: "Salvar peso" }));
    fireEvent.click(screen.getByText("Ver registros de peso (1)"));
    await user.click(screen.getByRole("button", { name: /Excluir peso de/ }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).weights).toHaveLength(
      1,
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Excluir registro",
      }),
    );
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).weights).toHaveLength(
      0,
    );
  });
  it("preserva o conteúdo corrompido sem sobrescrevê-lo", () => {
    localStorage.setItem(STORAGE_KEY, "dados quebrados");
    render(<App />);
    expect(screen.getByRole("alert")).toHaveTextContent("não será sobrescrito");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dados quebrados");
  });
  it("persiste o horário e o estado dos lembretes", async () => {
    const user = userEvent.setup();
    render(<App />);
    fireEvent.change(screen.getByLabelText("Horário: treino"), {
      target: { value: "23:59" },
    });
    await user.click(
      screen.getByRole("switch", { name: "Lembrete de treino" }),
    );
    expect(
      screen.getByRole("switch", { name: "Lembrete de treino" }),
    ).toBeChecked();
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).reminders[0],
    ).toMatchObject({ time: "23:59", enabled: true });
  });
});
