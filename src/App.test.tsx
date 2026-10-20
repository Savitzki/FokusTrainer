import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
// The real opening duration is covered in startupScreen.test.tsx.
vi.mock("./useMinimumLoading", () => ({
  useMinimumLoading: (pending: boolean) => pending,
}));
import { freshData, localDate, STORAGE_KEY } from "./model";
import { COMPLETED_PHRASES, MOTIVATIONAL_PHRASES } from "./motivation";
import type { Profile } from "./profile";
import type { WeightEntry } from "./weightSync";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("./backend", () => ({ accountConfigured: false, backendRpc: rpc }));

const account = vi.hoisted(() => ({
  user: null as null | { id: string },
  configured: true,
  initializing: false,
  profile: null as Profile | null,
  profileLoading: false,
  profileChecked: false,
  profileError: "",
  saveProfile: vi.fn(),
  checkNickname: vi
    .fn()
    .mockResolvedValue({ valid: true, available: true, suggestions: [] }),
  checkEmail: vi.fn().mockResolvedValue(false),
  signUp: vi.fn(),
  signIn: vi.fn(),
  signInWithGoogle: vi.fn(),
}));
vi.mock("./account", () => ({ useAccount: () => account }));
beforeEach(() => {
  account.user = null;
  account.profile = null;
  account.profileChecked = false;
  account.saveProfile.mockImplementation(async (next: Profile) => {
    account.profile = next;
  });
  const records = new Map<string, WeightEntry>();
  rpc.mockReset();
  rpc.mockImplementation(async (name, args) => {
    if (name === "confirm_manual_workout")
      return {
        id: args.p_request_id,
        date: args.p_day,
        activity: args.p_activity,
        minutes: args.p_minutes,
        manualConfirmed: true,
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
  it("oculta peso e Arena do visitante e preserva os registros locais antigos", async () => {
    const data = freshData();
    data.weights = [{ date: localDate(), kg: 72.5 }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    render(<App />);
    expect(
      screen.queryByRole("link", { name: "Peso" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Arena" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Registrar peso" }),
    ).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).weights).toEqual(
      data.weights,
    );
    expect(rpc).not.toHaveBeenCalled();
  });
  it("apresenta a demonstração sem ofensiva e abre a autenticação ao criar o plano", async () => {
    const user = userEvent.setup(),
      data = freshData();
    data.workouts = [
      { id: "legacy", date: localDate(), activity: "Corrida", minutes: 30 },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    render(<App />);
    expect(
      screen.queryByLabelText("0 dias de ofensiva"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Registrar treino" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Treinos" }));
    expect(screen.getByText("Demonstração")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Criar meu plano" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "Sua conta Capibora",
    );
    expect(
      screen.queryByLabelText("Duração (minutos)"),
    ).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).workouts).toEqual(
      data.workouts,
    );
    expect(rpc).not.toHaveBeenCalled();
  });
  it("reabre rascunho manual antigo para responder ao novo interrogatório", async () => {
    account.user = { id: "test-user" };
    const data = freshData();
    data.workouts = [
      {
        id: "old-draft",
        date: localDate(),
        activity: "Corrida",
        minutes: 35,
        method: "manual",
        review: { intensity: 3, feeling: "normal", completion: "full" },
      },
    ];
    localStorage.setItem(dataKey(), JSON.stringify(data));
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByLabelText("0 dias de ofensiva")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /Conclua a confirmação do treino/ }),
    );
    expect(screen.getByLabelText("Duração (minutos)")).toHaveValue(35);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("1 de 3")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalledWith(
      "confirm_manual_workout",
      expect.anything(),
    );
    expect(
      JSON.parse(localStorage.getItem(dataKey())!).workouts[0].review.intensity,
    ).toBe(3);
  });
  it("celebra somente a nova confirmação e preserva o horário ao reabrir", async () => {
    account.user = { id: "test-user" };
    const user = userEvent.setup();
    const view = render(<App />);
    expect(document.querySelector("[data-celebration]")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Registrar treino" }));
    await manualFields(user, "35");
    const before = Date.now();
    await user.click(screen.getByRole("button", { name: "Sim, eu confirmo." }));
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
      screen.getByRole("region", { name: "Treino de hoje" }),
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
    await user.click(screen.getByRole("button", { name: "Sim, eu confirmo." }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(COMPLETED_PHRASES).toContain(
      screen.getByRole("heading", { level: 1 }).textContent,
    );
  });
  it("salva nick e avatar sem alterar a confirmação do treino", async () => {
    account.user = { id: "profile-user" };
    account.profileChecked = true;
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
    await user.type(await screen.findByLabelText("Seu nick"), "@Dani.treina");
    await user.click(screen.getByRole("radio", { name: "Montanha" }));
    await user.click(screen.getByRole("radio", { name: "Verde" }));
    await user.click(screen.getByRole("button", { name: "Salvar perfil" }));
    expect(JSON.parse(localStorage.getItem(dataKey())!).profile).toEqual({
      nickname: "Dani.treina",
      style: "mountain",
      color: "forest",
      photo: null,
    });
    expect(window.location.hash).toBe("#/perfil");
    await user.click(screen.getByRole("link", { name: "Início" }));
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
    await user.click(screen.getByRole("button", { name: "Sim, eu confirmo." }));
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
  it.each([false, true])(
    "preserva conteúdo corrompido sem sobrescrever: autenticado %s",
    (authenticated) => {
      if (authenticated) account.user = { id: "corrupt-user" };
      localStorage.setItem(dataKey(), "dados quebrados");
      render(<App />);
      if (authenticated)
        expect(screen.getByRole("alert")).toHaveTextContent(
          "não será sobrescrito",
        );
      else expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(localStorage.getItem(dataKey())).toBe("dados quebrados");
    },
  );
  it("mantém preferências antigas sem expor sua configuração", async () => {
    account.user = { id: "preferences-user" };
    localStorage.setItem(dataKey(), JSON.stringify(freshData()));
    const user = userEvent.setup();
    render(<App />);
    const reminders = JSON.parse(localStorage.getItem(dataKey())!).reminders;
    await user.click(screen.getByRole("link", { name: "Configurações" }));
    expect(screen.queryByLabelText("Horário: treino")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(dataKey())!).reminders).toEqual(
      reminders,
    );
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
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Sim" }));
  await user.click(screen.getByRole("button", { name: "Sim" }));
}
