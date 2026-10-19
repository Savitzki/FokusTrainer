import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import WeightSyncStatus from "./WeightSyncStatus";
import type { useWeightSync } from "./useWeightSync";

function controller(
  overrides: Partial<ReturnType<typeof useWeightSync>> = {},
): ReturnType<typeof useWeightSync> {
  return {
    busy: false,
    error: "",
    synced: true,
    cached: true,
    refresh: vi.fn().mockResolvedValue(true),
    save: vi.fn(),
    resolve: vi.fn(),
    importGuest: vi.fn(),
    guestImported: true,
    pending: 0,
    legacyNotice: false,
    conflicts: [],
    ...overrides,
  };
}

it("mantém a sincronização normal silenciosa, inclusive durante consultas de rotina", () => {
  const view = render(
    <WeightSyncStatus sync={controller()} guest={[]} onError={vi.fn()} />,
  );
  expect(view.container).toBeEmptyDOMElement();
  view.rerender(
    <WeightSyncStatus
      sync={controller({ busy: true })}
      guest={[]}
      onError={vi.fn()}
    />,
  );
  expect(view.container).toBeEmptyDOMElement();
});

it("mantém pesos pendentes visíveis e permite reenviar sem esconder a falha", async () => {
  const sync = controller({ pending: 1, error: "Sem conexão" });
  render(<WeightSyncStatus sync={sync} guest={[]} onError={vi.fn()} />);
  expect(screen.getByRole("status")).toHaveTextContent(
    "1 peso pendente · salvo neste aparelho",
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Sem conexão");
  await userEvent.click(
    screen.getByRole("button", { name: "Sincronizar pesos" }),
  );
  expect(sync.refresh).toHaveBeenCalledOnce();
});

it("mantém a resolução de conflitos mesmo sem aviso geral de sincronização", async () => {
  const sync = controller({
    conflicts: [
      {
        id: "conflict",
        date: "2026-10-18",
        kg: 75,
        recordedAt: "2026-10-18T10:00:00Z",
        conflict: true,
        remoteKg: 76,
      },
    ],
  });
  render(<WeightSyncStatus sync={sync} guest={[]} onError={vi.fn()} />);
  await userEvent.click(
    screen.getByRole("button", { name: "Adicionar outra pesagem: 75,0 kg" }),
  );
  expect(sync.resolve).toHaveBeenCalledExactlyOnceWith("conflict", true);
});
