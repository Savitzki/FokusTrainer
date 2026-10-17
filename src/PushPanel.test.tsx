import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PushPanel from "./PushPanel";
import type { Account } from "./account";

const push = vi.hoisted(() => ({
  enable: vi.fn(),
  disable: vi.fn(),
  supported: vi.fn(),
}));
vi.mock("./push", () => ({
  pushPublicKey: "configured",
  pushSupported: push.supported,
  enablePush: push.enable,
  disablePush: push.disable,
}));
const account = {
  user: { id: "settings-user" },
  profile: { nickname: "Dani" },
  profileLoading: false,
  profileError: "",
} as Account;
beforeEach(() => {
  vi.clearAllMocks();
  push.supported.mockReturnValue(true);
  push.enable.mockResolvedValue(undefined);
  push.disable.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", {
    serviceWorker: {
      getRegistration: vi
        .fn()
        .mockResolvedValue({
          pushManager: { getSubscription: vi.fn().mockResolvedValue(null) },
        }),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

it("não mostra blocos de push para visitantes ou aparelhos sem suporte", () => {
  const view = render(<PushPanel account={{ ...account, user: null }} />);
  expect(view.container).toBeEmptyDOMElement();
  push.supported.mockReturnValue(false);
  view.rerender(<PushPanel account={account} />);
  expect(view.container).toBeEmptyDOMElement();
});

it("preserva a configuração e a desativação quando o push está disponível", async () => {
  const user = userEvent.setup();
  render(<PushPanel account={account} />);
  expect(
    screen.queryByText("Avisos com o app fechado"),
  ).not.toBeInTheDocument();
  await user.selectOptions(
    screen.getByLabelText("Primeiro toque do dia"),
    "19",
  );
  await user.click(
    screen.getByRole("button", { name: "Ativar push neste aparelho" }),
  );
  expect(push.enable).toHaveBeenCalledExactlyOnceWith({
    hour: 19,
    tone: "gentle",
  });
  await user.click(
    await screen.findByRole("button", { name: "Desativar neste aparelho" }),
  );
  expect(push.disable).toHaveBeenCalledOnce();
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Push desativado",
  );
});
