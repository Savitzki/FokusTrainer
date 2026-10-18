import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import ProfilePanel from "./ProfilePanel";
import { NicknameConflictError } from "./nickname";
import type { Account } from "./account";
import type { Profile } from "./profile";
const profile: Profile = {
  nickname: "Dani",
  color: "orange",
  style: "initials",
  photo: null,
};
function account(): Account {
  return {
    configured: true,
    initializing: false,
    user: { id: "user", email: "me@example.invalid" } as Account["user"],
    phrasePreferences: { displayName: "Dani", treatment: "neutral" },
    profile: null,
    profileLoading: false,
    profileChecked: true,
    profileError: "",
    error: "",
    authNotice: "",
    dismissAuthNotice: vi.fn(),
    retry: vi.fn(),
    checkEmail: vi.fn(),
    checkNickname: vi
      .fn()
      .mockResolvedValue({ valid: true, available: true, suggestions: [] }),
    signUp: vi.fn(),
    resendConfirmation: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    signInWithGoogle: vi.fn(),
    saveProfile: vi.fn().mockResolvedValue(undefined),
  };
}
it("bloqueia o nick salvo, mas permite mudar avatar e nome das frases", async () => {
  const auth = account(),
    user = userEvent.setup();
  auth.profile = profile;
  render(
    <ProfilePanel
      profile={profile}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Editar perfil" }));
  expect(screen.getByLabelText("Seu nick")).toHaveAttribute("readonly");
  await user.type(screen.getByLabelText("Seu nick"), "alterado");
  expect(screen.getByLabelText("Seu nick")).toHaveValue("Dani");
  await user.clear(screen.getByLabelText("Seu nome"));
  await user.type(screen.getByLabelText("Seu nome"), "Daniela");
  await user.click(screen.getByRole("radio", { name: "Azul" }));
  await user.click(screen.getByRole("button", { name: "Salvar perfil" }));
  expect(auth.saveProfile).toHaveBeenCalledWith(
    expect.objectContaining({ nickname: "Dani", color: "blue" }),
    expect.objectContaining({ displayName: "Daniela" }),
  );
  expect(auth.checkNickname).not.toHaveBeenCalled();
});
it("mostra sugestões livres para nick ocupado e salva a escolhida", async () => {
  const auth = account(),
    user = userEvent.setup(),
    onSaved = vi.fn();
  vi.mocked(auth.checkNickname).mockImplementation(async (n) => ({
    valid: true,
    available: n !== "Dani",
    suggestions: n === "Dani" ? ["Dani_1", "Dani_2", "Dani_3"] : [],
  }));
  render(
    <ProfilePanel
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={onSaved}
    />,
  );
  await user.type(screen.getByLabelText("Seu nick"), "Dani");
  await screen.findByText("Esse nick já está em uso");
  expect(screen.getByRole("button", { name: "Salvar perfil" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "@Dani_2" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Salvar perfil" })).toBeEnabled(),
  );
  await user.click(screen.getByRole("button", { name: "Salvar perfil" }));
  expect(auth.saveProfile).toHaveBeenCalledWith(
    expect.objectContaining({ nickname: "Dani_2" }),
    expect.anything(),
  );
  expect(onSaved).toHaveBeenCalledOnce();
});
it("um conflito entre a consulta e o salvamento oferece outras sugestões e não anuncia sucesso", async () => {
  const auth = account(),
    user = userEvent.setup(),
    onSaved = vi.fn();
  vi.mocked(auth.saveProfile).mockRejectedValue(
    new NicknameConflictError(["Dani_8"]),
  );
  render(
    <ProfilePanel
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={onSaved}
    />,
  );
  await user.type(screen.getByLabelText("Seu nick"), "Dani");
  await user.click(screen.getByRole("button", { name: "Salvar perfil" }));
  await screen.findByRole("button", { name: "@Dani_8" });
  expect(onSaved).not.toHaveBeenCalled();
});

it("o perfil reúne os dados e o botão de sair, sem abas de conta ou configurações", async () => {
  const auth = account(),
    user = userEvent.setup();
  auth.profile = profile;
  render(
    <ProfilePanel
      profile={profile}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  expect(screen.getByText("me@example.invalid")).toBeInTheDocument();
  expect(screen.getByText("@Dani")).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Dados da conta" })).toHaveTextContent("Sexo");
  expect(screen.queryByRole("form", { name: "Editar perfil" })).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Minha conta" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Configurações" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Sair da conta" }));
  expect(auth.signOut).toHaveBeenCalledOnce();
});
it("uma falha ao sair mantém o perfil e explica o motivo", async () => {
  const auth = account(),
    user = userEvent.setup();
  vi.mocked(auth.signOut).mockRejectedValue(
    new Error("Aguarde os pesos sincronizarem"),
  );
  render(
    <ProfilePanel
      profile={profile}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Sair da conta" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Aguarde os pesos sincronizarem",
  );
  expect(screen.getByText("@Dani")).toBeInTheDocument();
});

it("descarta a edição sem salvar e restaura a prévia do avatar e o nome", async () => {
  const auth = account(), user = userEvent.setup();
  render(
    <ProfilePanel profile={profile} account={auth} onSaveLocal={vi.fn()} onSaved={vi.fn()} />,
  );
  await user.click(screen.getByRole("button", { name: "Editar perfil" }));
  await user.clear(screen.getByLabelText("Seu nome"));
  await user.type(screen.getByLabelText("Seu nome"), "Daniela");
  await user.click(screen.getByRole("radio", { name: "Azul" }));
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.getByRole("heading", { name: "Dani" })).toBeInTheDocument();
  expect(screen.queryByRole("form", { name: "Editar perfil" })).not.toBeInTheDocument();
  expect(auth.saveProfile).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Editar perfil" }));
  expect(screen.getByLabelText("Seu nome")).toHaveValue("Dani");
  expect(screen.getByRole("radio", { name: "Laranja" })).toHaveAttribute("aria-checked", "true");
});

it("mostra a trajetória sem expor dados de peso e separa a customização", () => {
  render(
    <ProfilePanel profile={profile} account={account()} onSaveLocal={vi.fn()} onSaved={vi.fn()} stats={{workouts: 30, streak: 4, bestStreak: 10}}>
      <p>Conquistas da conta</p>
    </ProfilePanel>,
  );
  const journey = screen.getByRole("region", { name: "Sua trajetória" });
  expect(journey).toHaveTextContent(/Treinos30\s*Ofensiva4 dias\s*Recorde10 dias/);
  expect(screen.getByText("Conquistas da conta")).toBeInTheDocument();
  expect(screen.queryByLabelText("Peso (kg)")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Salvar perfil" })).not.toBeInTheDocument();
});

it("só anuncia cadastro completo após salvar todas as informações, inclusive numa nova tentativa", async () => {
  const auth = account(),
    user = userEvent.setup(),
    completed = vi.fn(),
    saved = vi.fn();
  vi.mocked(auth.saveProfile)
    .mockRejectedValueOnce(
      new Error("Perfil salvo, mas as preferências falharam"),
    )
    .mockResolvedValueOnce(undefined);
  const view = render(
    <ProfilePanel
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={saved}
      onRegistrationCompleted={completed}
    />,
  );
  await user.type(screen.getByLabelText("Seu nick"), "Dani");
  await user.click(screen.getByRole("button", { name: "Salvar perfil" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "as preferências falharam",
  );
  expect(completed).not.toHaveBeenCalled();
  expect(saved).not.toHaveBeenCalled();
  auth.profile = profile;
  view.rerender(
    <ProfilePanel
      profile={profile}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={saved}
      onRegistrationCompleted={completed}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Salvar perfil" }));
  expect(completed).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button", { name: "Salvar perfil" }));
  expect(completed).toHaveBeenCalledOnce();
});
