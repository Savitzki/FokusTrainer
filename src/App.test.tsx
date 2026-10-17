import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { freshData, localDate, STORAGE_KEY } from "./model";
import { COMPLETED_PHRASES, MOTIVATIONAL_PHRASES } from "./motivation";

const account = vi.hoisted(() => ({
  user: null as null | { id: string },
  configured: true,
  initializing: false,
  profile: null,
  profileLoading: false,
  profileChecked: false,
  profileError: "",
  homeState: null,
  saveProfile: vi.fn(),
  signUp: vi.fn(),
  signIn: vi.fn(),
  signInWithGoogle: vi.fn(),
}));
vi.mock("./account", () => ({ useAccount: () => account }));
beforeEach(() => {
  account.user = null;
});
const dataKey = () =>
  account.user ? `${STORAGE_KEY}:account:${account.user.id}` : STORAGE_KEY;

describe("registro e persistência", () => {
  it("pede login nas duas entradas de treino e mantém o visitante sem ofensiva", async () => {
    const user = userEvent.setup();
    const data = freshData();
    data.workouts = [
      { id: "legacy", date: localDate(), activity: "Corrida", minutes: 30 },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    render(<App />);
    expect(screen.getByText("Visitante")).toBeInTheDocument();
    expect(screen.getByText("0 treinos no total")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Compartilhar ofensiva" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Registrar treino" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "Sua chama começa com uma conta",
    );
    expect(
      screen.getByRole("button", { name: "Continuar" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Duração (minutos)"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fechar janela" }));
    await user.click(screen.getByRole("link", { name: "Treinos" }));
    await user.click(screen.getByRole("button", { name: "Registrar treino" }));
    expect(
      screen.getByRole("button", { name: "Já tenho conta" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirmar treino" }),
    ).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).workouts).toEqual(
      data.workouts,
    );
    expect(document.querySelector("[data-celebration]")).toBeNull();
  });
  it("celebra somente a nova confirmação e preserva o horário ao reabrir", async () => {
    account.user = { id: "test-user" };
    const user = userEvent.setup();
    const view = render(<App />);
    expect(document.querySelector("[data-celebration]")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Registrar treino" }));
    await user.type(screen.getByLabelText("Duração (minutos)"), "30");
    const before = Date.now();
    await user.click(screen.getByRole("button", { name: "Confirmar treino" }));
    const saved = JSON.parse(localStorage.getItem(dataKey())!).workouts[0];
    expect(Date.parse(saved.recordedAt)).toBeGreaterThanOrEqual(before);
    expect(document.querySelectorAll(".fire-particle")).toHaveLength(24);
    view.unmount();
    render(<App />);
    expect(document.querySelector("[data-celebration]")).toBeNull();
    expect(
      JSON.parse(localStorage.getItem(dataKey())!).workouts[0].recordedAt,
    ).toBe(saved.recordedAt);
  });
  it("mantém a frase durante a visita e retira nick, data e teste de notificação da tela inicial", async () => {
    account.user = { id: "test-user" };
    const data = freshData();
    data.profile = {
      nickname: "dani.treina",
      style: "initials",
      color: "orange",
      photo: null,
    };
    localStorage.setItem(dataKey(), JSON.stringify(data));
    const user = userEvent.setup();
    render(<App />);
    const headline = screen.getByRole("heading", { level: 1 }).textContent;
    expect(MOTIVATIONAL_PHRASES).toContain(headline);
    expect(
      screen.getByRole("region", { name: "Sua ofensiva" }),
    ).toContainElement(screen.getByRole("heading", { level: 1 }));
    expect(document.querySelector(".today-label")).toBeNull();
    expect(screen.queryByText("@dani.treina")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Testar notificação" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Registrar treino" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      headline!,
    );
    await user.type(screen.getByLabelText("Duração (minutos)"), "30");
    await user.click(screen.getByRole("button", { name: "Confirmar treino" }));
    expect(COMPLETED_PHRASES).toContain(
      screen.getByRole("heading", { level: 1 }).textContent,
    );
  });
  it("salva nick e avatar sem alterar a confirmação do treino", async () => {
    const data = freshData();
    data.workouts.push({
      id: "confirmed",
      date: localDate(),
      activity: "Corrida",
      minutes: 30,
    });
    localStorage.setItem(dataKey(), JSON.stringify(data));
    const user = userEvent.setup();
    const view = render(<App />);
    await user.click(screen.getByRole("button", { name: "Criar perfil" }));
    await user.type(screen.getByLabelText("Seu nick"), "@Dani.treina");
    await user.click(screen.getByRole("radio", { name: "Montanha" }));
    await user.click(screen.getByRole("radio", { name: "Verde" }));
    await user.click(screen.getByRole("button", { name: "Salvar perfil" }));
    expect(JSON.parse(localStorage.getItem(dataKey())!).profile).toEqual({
      nickname: "Dani.treina",
      style: "mountain",
      color: "forest",
      photo: null,
    });
    expect(
      screen.getByRole("button", { name: "Registrar treino" }),
    ).toBeEnabled();
    view.unmount();
    render(<App />);
    expect(
      screen.getByRole("button", { name: "Editar perfil de Dani.treina" }),
    ).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(dataKey())!).workouts).toEqual(
      data.workouts,
    );
  });
  it("confirma o treino uma vez, bloqueia alterações e restaura ao reabrir", async () => {
    account.user = { id: "test-user" };
    const user = userEvent.setup();
    const view = render(<App />);
    expect(
      screen.getByRole("img", { name: /Chama apagada/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Registrar treino" }));
    expect(screen.getByLabelText("Data")).toHaveAttribute("readonly");
    await user.type(screen.getByLabelText("Duração (minutos)"), "45");
    await user.click(screen.getByRole("button", { name: "Confirmar treino" }));
    expect(screen.getByLabelText("1 dia de ofensiva")).toBeInTheDocument();
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
    expect(JSON.parse(localStorage.getItem(dataKey())!).workouts).toHaveLength(
      1,
    );
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
    await user.click(screen.getByRole("link", { name: "Peso" }));
    await user.click(screen.getByRole("button", { name: "Registrar peso" }));
    await user.type(screen.getByLabelText("Peso (kg)"), "72,5");
    await user.click(screen.getByRole("button", { name: "Salvar peso" }));
    await user.click(screen.getByRole("button", { name: "Registrar peso" }));
    expect(
      screen.getByText(/Já existe um peso nesta data/),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Peso (kg)"), "72,8");
    await user.click(screen.getByRole("button", { name: "Atualizar peso" }));
    expect(JSON.parse(localStorage.getItem(dataKey())!).weights).toEqual([
      { date: localDate(), kg: 72.8 },
    ]);
  });
  it("recusa peso inválido e confirma antes de excluir registros", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("link", { name: "Peso" }));
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
    expect(JSON.parse(localStorage.getItem(dataKey())!).weights).toHaveLength(
      1,
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Excluir registro",
      }),
    );
    expect(JSON.parse(localStorage.getItem(dataKey())!).weights).toHaveLength(
      0,
    );
  });
  it("preserva o conteúdo corrompido sem sobrescrevê-lo", () => {
    localStorage.setItem(dataKey(), "dados quebrados");
    render(<App />);
    expect(screen.getByRole("alert")).toHaveTextContent("não será sobrescrito");
    expect(localStorage.getItem(dataKey())).toBe("dados quebrados");
  });
  it("persiste o horário e o estado dos lembretes", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("link", { name: "Avisos" }));
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
      JSON.parse(localStorage.getItem(dataKey())!).reminders[0],
    ).toMatchObject({ time: "23:59", enabled: true });
  });
});
