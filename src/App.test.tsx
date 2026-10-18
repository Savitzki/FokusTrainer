import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { freshData, localDate, STORAGE_KEY } from "./model";
import { COMPLETED_PHRASES, MOTIVATIONAL_PHRASES } from "./motivation";
import type { WeightEntry } from "./weightSync";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("./backend", () => ({ accountConfigured: false, backendRpc: rpc }));

const account = vi.hoisted(() => ({
  user: null as null | { id: string },
  configured: true,
  initializing: false,
  profile: null,
  profileLoading: false,
  profileChecked: false,
  profileError: "",
  saveProfile: vi.fn(),
  checkEmail: vi.fn().mockResolvedValue(false),
  signUp: vi.fn(),
  signIn: vi.fn(),
  signInWithGoogle: vi.fn(),
}));
vi.mock("./account", () => ({ useAccount: () => account }));
beforeEach(() => {
  account.user = null;
  const records = new Map<string, WeightEntry>();
  rpc.mockReset();
  rpc.mockImplementation(async (name, args) => {
    if (name === "confirm_manual_workout")
      return {
        id: args.p_request_id,
        date: args.p_day,
        activity: args.p_activity,
        minutes: args.p_minutes,
        review: args.p_review,
        method: "manual",
        confirmedAt: new Date().toISOString(),
      };
    if (name !== "sync_weight_entries")
      throw new Error("RPC inesperada no teste");
    for (const entry of args.p_entries)
      if (!records.has(entry.id))
        records.set(entry.id, {
          ...entry,
          confirmedAt: new Date().toISOString(),
        });
    return {
      records: [...records.values()],
      applied: args.p_entries.map((e: { id: string }) => e.id),
    };
  });
});
const dataKey = () =>
  account.user ? `${STORAGE_KEY}:account:${account.user.id}` : STORAGE_KEY;

describe("registro e persistência", () => {
  it("o botão Entrar da página inicial abre diretamente o formulário de login", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Entrar na conta" }));
    expect(screen.getByLabelText(/^E-mail/)).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Quero criar uma conta" }),
    ).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("exige conta para registrar peso e preserva registros antigos do visitante sem edição", async () => {
    const data = freshData(),
      user = userEvent.setup();
    data.weights = [{ date: localDate(), kg: 72.5 }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    render(<App />);
    expect(screen.getByRole("button", { name: "Entrar na conta" })).toHaveClass(
      "primary-button",
    );
    await user.click(screen.getByRole("link", { name: "Peso" }));
    await user.click(screen.getByText("Ver registros de peso (1)"));
    expect(
      screen.queryByRole("button", { name: /Excluir peso de/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Registrar peso" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "Sua chama começa com uma conta",
    );
    expect(screen.queryByLabelText("Peso (kg)")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Quero criar uma conta" }),
    ).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).weights).toEqual(
      data.weights,
    );
    await user.click(screen.getByRole("button", { name: "Fechar janela" }));
    await user.click(screen.getByRole("link", { name: "Arena" }));
    await user.click(screen.getByRole("button", { name: "Entrar na Arena" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "Sua chama começa com uma conta",
    );
    expect(
      screen.getByRole("button", { name: "Quero criar uma conta" }),
    ).toBeInTheDocument();
  });
  it("pede login nas duas entradas de treino e mantém o visitante sem ofensiva", async () => {
    const user = userEvent.setup();
    const data = freshData();
    data.workouts = [
      { id: "legacy", date: localDate(), activity: "Corrida", minutes: 30 },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    render(<App />);
    expect(screen.getByText("Visitante")).toBeInTheDocument();
    expect(screen.getByLabelText("0 dias de ofensiva")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Compartilhar ofensiva" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Registrar treino" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "Sua chama começa com uma conta",
    );
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Duração (minutos)"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fechar janela" }));
    await user.click(screen.getByRole("link", { name: "Treinos" }));
    await user.click(screen.getByRole("button", { name: "Registrar treino" }));
    expect(
      screen.getByRole("button", { name: "Quero criar uma conta" }),
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
    await manualFields(user, "35");
    const before = Date.now();
    await user.click(screen.getByRole("button", { name: "Confirmar treino" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    const saved = JSON.parse(localStorage.getItem(dataKey())!).workouts[0];
    expect(Date.parse(saved.confirmedAt)).toBeGreaterThanOrEqual(before);
    expect(document.querySelectorAll(".fire-particle")).toHaveLength(24);
    view.unmount();
    render(<App />);
    expect(document.querySelector("[data-celebration]")).toBeNull();
    expect(
      JSON.parse(localStorage.getItem(dataKey())!).workouts[0].confirmedAt,
    ).toBe(saved.confirmedAt);
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
    await manualFields(user, "35");
    await user.click(screen.getByRole("button", { name: "Confirmar treino" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
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

    await manualFields(user, "45");
    await user.click(screen.getByRole("button", { name: "Confirmar treino" }));
    expect(
      await screen.findByLabelText("1 dia de ofensiva"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Chama acesa/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Treino de hoje concluído" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /Excluir treino/ }),
    ).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(dataKey())!).workouts).toHaveLength(
      1,
    );
    view.unmount();
    render(<App />);
    expect(
      await screen.findByLabelText("1 dia de ofensiva"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Treino de hoje concluído" }),
    ).toBeDisabled();
  });
  it("aceita vírgula e mantém duas pesagens na mesma data sem alterar a primeira", async () => {
    account.user = { id: "test-user" };
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("link", { name: "Peso" }));
    await user.click(screen.getByRole("button", { name: "Registrar peso" }));
    await user.type(screen.getByLabelText("Peso (kg)"), "72,5");
    await user.click(screen.getByRole("button", { name: "Salvar peso" }));
    await user.click(screen.getByRole("button", { name: "Registrar peso" }));
    expect(screen.queryByText(/será atualizado/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Peso (kg)"), "72,8");
    await user.click(screen.getByRole("button", { name: "Salvar peso" }));
    expect(JSON.parse(localStorage.getItem(dataKey())!).weights).toEqual([
      expect.objectContaining({ date: localDate(), kg: 72.5 }),
      expect.objectContaining({ date: localDate(), kg: 72.8 }),
    ]);
    await user.click(screen.getByText("Ver registros de peso (2)"));
    expect(document.querySelectorAll(".weight-entry-row time")).toHaveLength(2);
    expect(document.querySelectorAll(".weight-chart circle")).toHaveLength(2);
  });
  it("recusa peso inválido e mantém o registro salvo imutável", async () => {
    account.user = { id: "test-user" };
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
    expect(
      screen.queryByRole("button", {
        name: /Excluir peso|Editar peso|Atualizar peso/,
      }),
    ).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(dataKey())!).weights).toHaveLength(
      1,
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
    await user.click(screen.getByRole("link", { name: "Configurações" }));
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

async function manualFields(
  user: ReturnType<typeof userEvent.setup>,
  minutes: string,
) {
  await user.click(
    screen.getByRole("button", { name: /Registrar manualmente/ }),
  );
  await user.type(screen.getByLabelText("Duração (minutos)"), minutes);
  await user.click(screen.getByRole("button", { name: "3 Moderado" }));
  await user.click(screen.getByRole("button", { name: "Normal" }));
  await user.click(
    screen.getByRole("button", { name: "Sim, fiz tudo que pretendia" }),
  );
}
