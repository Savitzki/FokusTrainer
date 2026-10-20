import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn(async (name: string) => ({ name })));
vi.mock("./backend", () => ({ accountConfigured: true, backendRpc: rpc }));
import { useGameResource } from "./useGamification";
import { mutationResources, notifySyncWrite } from "./sync";
const parse = (value: unknown) => value as { name: string };

it.each([
  ["acknowledge_arena_taunt", "get_arena_inbox"],
  ["send_arena_taunt", "get_arena_inbox"],
  ["reply_arena_taunt", "get_arena_inbox"],
  ["set_arena_social_preferences", "get_arena_inbox"],
  ["set_group_reaction", "get_group_reactions"],
])(
  "%s atualiza seu recurso sem recalcular toda a Arena",
  async (mutation, query) => {
    rpc.mockClear();
    const view = renderHook(() => {
      useGameResource("selective", "get_social_state", {}, parse);
      useGameResource("selective", "get_arena_inbox", {}, parse);
      useGameResource("selective", "get_group_reactions", {}, parse);
    });
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(3));
    rpc.mockClear();
    await act(async () => {
      notifySyncWrite("selective", mutation);
    });
    await waitFor(() => expect(rpc).toHaveBeenCalledExactlyOnceWith(query, {}));
    view.unmount();
  },
);
it("encerrar a amizade invalida também as provocações que dependiam dela", () => {
  expect(mutationResources("remove_friend")).toContain("inbox");
  expect(mutationResources("remove_friend")).toContain("showcase");
});
