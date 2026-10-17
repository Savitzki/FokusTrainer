import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import GroupWorkoutPrompt from "./GroupWorkoutPrompt";
import type { SocialState } from "./social";
const send = vi.hoisted(() => vi.fn());
vi.mock("./groupNotifications", () => ({ sendGroupWorkoutNotice: send }));
const groups = [
  { id: "one", name: "Chama das nove" },
  { id: "two", name: "Bora treinar" },
] as SocialState["groups"];
beforeEach(() => send.mockReset());
it("não envia ao abrir ou escolher Agora não", async () => {
  const skip = vi.fn();
  render(
    <GroupWorkoutPrompt
      groups={groups}
      workoutId="workout"
      nickname="Dani"
      onSkip={skip}
      onSent={vi.fn()}
      onSync={vi.fn()}
    />,
  );
  expect(send).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Agora não" }));
  expect(skip).toHaveBeenCalledOnce();
  expect(send).not.toHaveBeenCalled();
});
it("envia apenas aos grupos escolhidos e permite tentar de novo após falha", async () => {
  const user = userEvent.setup(),
    sent = vi.fn();
  send
    .mockRejectedValueOnce(new Error("Serviço indisponível"))
    .mockResolvedValueOnce({
      queued: 1,
      already_sent: 0,
      recipients: 1,
      sent: 1,
    });
  render(
    <GroupWorkoutPrompt
      groups={groups}
      workoutId="workout"
      nickname="Dani"
      onSkip={vi.fn()}
      onSent={sent}
      onSync={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("checkbox", { name: "Bora treinar" }));
  await user.click(screen.getByRole("button", { name: "Avisar o grupo" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Serviço indisponível",
  );
  expect(sent).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Avisar o grupo" }));
  expect(send).toHaveBeenLastCalledWith("workout", ["one"]);
  expect(sent).toHaveBeenCalledWith(
    "Aviso enviado aos aparelhos com notificações ativas",
  );
});
it("aguarda confirmação online e permite sincronizar sem notificar", async () => {
  const sync = vi.fn().mockResolvedValue(undefined);
  render(
    <GroupWorkoutPrompt
      groups={groups}
      nickname="Dani"
      onSkip={vi.fn()}
      onSent={vi.fn()}
      onSync={sync}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Avisar os grupos" }),
  ).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Sincronizar" }));
  expect(sync).toHaveBeenCalledOnce();
  expect(send).not.toHaveBeenCalled();
});
