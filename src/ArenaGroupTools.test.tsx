import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import ArenaGroupTools, { GroupWeeklyGoal } from "./ArenaGroupTools";
import FriendOptions from "./FriendOptions";
import type { SocialState } from "./social";
const group: SocialState["groups"][number] = {
  id: "g",
  adminId: "me",
  name: "Time",
  timezone: "UTC",
  status: "active",
  invited: false,
  today: "2026-10-20",
  streak: 2,
  best: 4,
  completed: false,
  members: [
    { id: "me", nickname: "Dani", accepted: true, trained: false },
    { id: "bia", nickname: "Bia", accepted: true, trained: true },
  ],
};
it("mostra meta real, histórico e zero como sem meta, nunca conclusão automática", () => {
  const { rerender } = render(
    <GroupWeeklyGoal
      goals={[
        {
          weekStart: "2026-10-19",
          startsOn: "2026-10-19",
          timezone: "UTC",
          target: 8,
          completed: 3,
          closed: false,
        },
        {
          weekStart: "2026-10-12",
          startsOn: "2026-10-12",
          timezone: "UTC",
          target: 8,
          completed: 8,
          closed: true,
        },
      ]}
    />,
  );
  expect(screen.getByRole("progressbar")).toHaveAttribute("max", "8");
  expect(screen.getByText("5 restantes")).toBeVisible();
  rerender(
    <GroupWeeklyGoal
      goals={[
        {
          weekStart: "2026-10-19",
          startsOn: "2026-10-19",
          timezone: "UTC",
          target: 0,
          completed: 0,
          closed: false,
        },
      ]}
    />,
  );
  expect(screen.getByText("Sem meta elegível")).toBeVisible();
  expect(screen.queryByText("Concluída")).not.toBeInTheDocument();
});
it("confirma transferência com integrante aceito e operação idempotente", async () => {
  const act = vi.fn().mockResolvedValue(true),
    user = userEvent.setup();
  render(
    <ArenaGroupTools
      group={group}
      userId="me"
      friends={[]}
      busy={false}
      act={act}
    />,
  );
  await user.click(screen.getByText("Gerenciar grupo"));
  await user.click(
    screen.getByRole("button", { name: "Transferir administração" }),
  );
  await user.selectOptions(screen.getByLabelText("Integrante"), "bia");
  await user.click(screen.getByRole("button", { name: "Confirmar" }));
  expect(act).toHaveBeenCalledWith(
    "arena_group_command",
    expect.objectContaining({
      p_id: "g",
      p_action: "transfer",
      p_target: "bia",
      p_request: expect.any(String),
    }),
  );
});
it("integrante convida e sai mas não recebe controles administrativos", async () => {
  const user = userEvent.setup();
  render(
    <ArenaGroupTools
      group={group}
      userId="bia"
      friends={[]}
      busy={false}
      act={vi.fn()}
    />,
  );
  await user.click(screen.getByText("Gerenciar grupo"));
  expect(screen.getByRole("button", { name: "Convidar amigo" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Sair do grupo" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Encerrar grupo" }),
  ).not.toBeInTheDocument();
});
it("remover amizade exige confirmação explícita e cancelar não escreve", async () => {
  const act = vi.fn().mockResolvedValue(true),
    user = userEvent.setup();
  render(
    <FriendOptions
      friend={{ id: "bia", nickname: "Bia" }}
      busy={false}
      act={act}
    />,
  );
  await user.click(screen.getByLabelText("Opções de Bia"));
  await user.click(screen.getByRole("button", { name: "Remover amizade" }));
  expect(act).not.toHaveBeenCalled();
  expect(
    within(screen.getByRole("dialog")).getByText(/Remover amizade com Bia/),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Voltar" }));
  expect(act).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Remover amizade" }));
  await user.click(screen.getByRole("button", { name: "Remover amizade" }));
  expect(act).toHaveBeenCalledWith("remove_friend", { p_user: "bia" });
});
