import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import ArenaTauntButton from "./ArenaTauntButton";
const allowance = {
  day: "2026-10-20",
  checkedAt: "2026-10-20T15:00:00Z",
  resetsAt: "2026-10-21T03:00:00Z",
  sentTo: [] as string[],
};
const friend = { id: "bia", nickname: "Bia" };
it("cancelar não consome a cota nem revela a mensagem sorteada", async () => {
  const send = vi.fn();
  render(
    <ArenaTauntButton
      friend={friend}
      busy={false}
      act={send}
      allowance={allowance}
    />,
  );
  await userEvent.click(screen.getByLabelText("Provocar Bia"));
  expect(screen.getByRole("dialog", { name: "Provocar @Bia" })).toBeVisible();
  expect(
    screen.queryByRole("group", { name: "Escolher provocação" }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(send).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Provocar Bia")).toHaveFocus();
});
it("bloqueia reenvio simultâneo, espera confirmação real e mantém chave após falha", async () => {
  let resolve!: (v: boolean) => void;
  const send = vi
    .fn()
    .mockImplementation(() => new Promise<boolean>((r) => (resolve = r)));
  render(
    <ArenaTauntButton
      friend={friend}
      busy={false}
      act={send}
      allowance={allowance}
    />,
  );
  await userEvent.click(screen.getByLabelText("Provocar Bia"));
  const confirm = screen.getByRole("button", { name: "Confirmar provocação" });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(send).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  const request = send.mock.calls[0][1].p_request;
  await act(async () => resolve(false));
  expect(screen.getByRole("dialog")).toBeVisible();
  fireEvent.click(confirm);
  expect(send.mock.calls[1][1].p_request).toBe(request);
  await act(async () => resolve(true));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Provocação enviada");
  expect(screen.getByLabelText("Já provocou hoje: @Bia")).toBeDisabled();
});
it("recarregar respeita a cota do servidor e outro amigo ou novo dia são independentes", () => {
  const send = vi.fn();
  const view = render(
    <ArenaTauntButton
      friend={friend}
      busy={false}
      act={send}
      allowance={{ ...allowance, sentTo: ["bia"] }}
    />,
  );
  expect(screen.getByLabelText("Já provocou hoje: @Bia")).toBeDisabled();
  view.rerender(
    <ArenaTauntButton
      friend={{ id: "caio", nickname: "Caio" }}
      busy={false}
      act={send}
      allowance={{ ...allowance, sentTo: ["bia"] }}
    />,
  );
  expect(screen.getByLabelText("Provocar Caio")).toBeEnabled();
  view.rerender(
    <ArenaTauntButton
      friend={friend}
      busy={false}
      act={send}
      allowance={{ ...allowance, day: "2026-10-21" }}
    />,
  );
  expect(screen.getByLabelText("Provocar Bia")).toBeEnabled();
});
it("não libera sem o contrato atualizado do servidor", () => {
  render(<ArenaTauntButton friend={friend} busy={false} act={vi.fn()} />);
  expect(screen.getByLabelText(/indisponíveis/)).toBeDisabled();
});

it("após o envio retorna o foco ao perfil do mesmo amigo, pois o botão de provocar ficou bloqueado", async () => {
  render(
    <div className="friend-row">
      <button className="friend-profile-link">Perfil de Bia</button>
      <ArenaTauntButton
        friend={friend}
        busy={false}
        act={vi.fn().mockResolvedValue(true)}
        allowance={allowance}
      />
    </div>,
  );
  await userEvent.click(screen.getByLabelText("Provocar Bia"));
  await userEvent.click(
    screen.getByRole("button", { name: "Confirmar provocação" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Perfil de Bia" })).toHaveFocus(),
  );
});
