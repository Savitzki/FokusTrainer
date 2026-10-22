import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ArenaTauntPreferences from "./ArenaTauntPreferences";
const fixture = vi.hoisted(() => ({
  state: { muted: false, push: false, messages: [] },
  busy: false,
  error: "",
  act: vi.fn().mockResolvedValue(true),
}));
vi.mock("./useGamification", () => ({ useGameResource: () => fixture }));

it.each([
  [false, false],
  [false, true],
  [true, false],
  [true, true],
])(
  "preserva preferências antigas muted=%s push=%s sem escrever na montagem",
  (muted, push) => {
    fixture.act.mockClear();
    fixture.state = { muted, push, messages: [] };
    render(<ArenaTauntPreferences userId="me" />);
    expect(screen.getAllByRole("switch")).toHaveLength(1);
    expect(screen.getByLabelText("Permitir provocações")).toHaveAttribute(
      "aria-checked",
      String(!muted),
    );
    expect(fixture.act).not.toHaveBeenCalled();
  },
);
it("desliga recebimento/push juntos e só habilita pelo gesto explícito, sem permissão nativa", async () => {
  fixture.state = { muted: false, push: true, messages: [] };
  fixture.act.mockClear();
  const request = vi.fn();
  vi.stubGlobal("Notification", { requestPermission: request });
  const view = render(<ArenaTauntPreferences userId="me" />);
  fireEvent.click(screen.getByLabelText("Permitir provocações"));
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("Preferências salvas"),
  );
  expect(fixture.act).toHaveBeenLastCalledWith("set_arena_social_preferences", {
    p_muted: true,
    p_push: false,
  });
  fixture.state = { muted: true, push: false, messages: [] };
  view.rerender(<ArenaTauntPreferences userId="me" />);
  fireEvent.click(screen.getByLabelText("Permitir provocações"));
  expect(fixture.act).toHaveBeenLastCalledWith("set_arena_social_preferences", {
    p_muted: false,
    p_push: true,
  });
  expect(request).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

it("mantém o estado confirmado e bloqueia novos toques durante o salvamento", async () => {
  fixture.state = { muted: false, push: true, messages: [] };
  fixture.act.mockClear();
  let finish!: (ok: boolean) => void;
  fixture.act.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<ArenaTauntPreferences userId="me" />);
  const control = screen.getByRole("switch", { name: "Permitir provocações" });
  expect(control).toHaveClass("toggle", "enabled");
  expect(control.closest(".appearance-switch-row")).not.toBeNull();
  fireEvent.click(control);
  fireEvent.click(control);
  expect(control).toBeDisabled();
  expect(control).toHaveAttribute("aria-checked", "true");
  expect(fixture.act).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish(false);
  });
  fixture.error = "Não foi possível salvar a preferência";
  view.rerender(<ArenaTauntPreferences userId="me" />);
  expect(screen.getByRole("alert")).toHaveTextContent(fixture.error);
  expect(control).toBeEnabled();
  expect(control).toHaveAttribute("aria-checked", "true");
  expect(screen.queryByText("Preferências salvas")).toBeNull();
  fixture.error = "";
});
