import { useEffect, useRef, useState } from "react";
import { accountConfigured, backendRpc } from "./backend";
import { STORAGE_KEY } from "./model";
import {
  readCoinHistory,
  readEconomyState,
  type CoinHistory,
  type EconomyState,
} from "./economy";
import { deviceTimezone } from "./social";
import { useSyncedResource } from "./useSyncedResource";
import { syncProblem, withSync, withSyncTimeout } from "./sync";

export type EconomyController = ReturnType<typeof useEconomy>;
export function useEconomy(userId: string | null, disabled = false) {
  const [history, setHistory] = useState<CoinHistory>({
    entries: [],
    hasMore: false,
  });
  const [notice, setNotice] = useState(""),
    [localError, setLocalError] = useState(""),
    [loadingMore, setLoadingMore] = useState(false);
  const [noticeReward, setNoticeReward] = useState<number>();
  const historyOwner = useRef(userId);
  const pageRequest = useRef(0),
    paging = useRef(false);
  const enabled = Boolean(userId && accountConfigured && !disabled);
  const pendingKey = `${STORAGE_KEY}:account:${userId}:kit-purchase`;
  const resource = useSyncedResource<EconomyState>({
    userId,
    resource: "economy",
    queryKey: "economy",
    enabled,
    cacheKey: userId ? `${STORAGE_KEY}:account:${userId}:economy` : undefined,
    parse: readEconomyState,
    accept: (next, previous) => next.revision >= previous.revision,
    read: (): Promise<unknown> =>
      backendRpc("get_economy_state", {
        p_timezone: resource.getCurrent()?.timezone ?? deviceTimezone(),
      }),
    onData(next, previous) {
      if (!previous || next.revision !== previous.revision) {
        pageRequest.current++;
        setHistory(next.history);
      }
      if (previous && next.revision > previous.revision) {
        const lastId = BigInt(previous.history.entries[0]?.id ?? "0");
        const earned = next.history.entries
          .filter((e) => BigInt(e.id) > lastId && e.amount > 0)
          .reduce((sum, e) => sum + e.amount, 0);
        if (earned) {
          setNoticeReward(earned);
          setNotice("Recompensa recebida");
        } else if (
          next.monthlyKits?.freeAvailable &&
          previous.monthlyKits?.month !== next.monthlyKits.month
        ) {
          setNoticeReward(undefined);
          setNotice("Kits gratuitos renovados para este mês");
        }
      }
      try {
        const pending = localStorage.getItem(pendingKey);
        if (
          pending &&
          next.history.entries.some(
            (e) => e.kind === "kit-purchase" && e.requestId === pending,
          )
        )
          localStorage.removeItem(pendingKey);
      } catch {
        /* Retaining the ID only retries the same confirmed purchase. */
      }
      setLocalError("");
    },
  });
  useEffect(() => {
    historyOwner.current = userId;
    setLoadingMore(false);
    setHistory(resource.state?.history ?? { entries: [], hasMore: false });
    setNotice("");
    setNoticeReward(undefined);
    setLocalError("");
    pageRequest.current++;
    paging.current = false;
  }, [userId]);
  async function request(
    name: string,
    args: Record<string, unknown>,
    success: string,
  ) {
    const result = await resource.mutate(
      () =>
        backendRpc(name, {
          p_timezone: resource.getCurrent()?.timezone ?? deviceTimezone(),
          ...args,
        }),
      name,
    );
    if (result.committed && resource.isCurrent()) {
      setNoticeReward(undefined);
      setNotice(success);
      if (name === "buy_medical_kit" && result.value)
        try {
          localStorage.removeItem(pendingKey);
        } catch {
          /* Retry remains idempotent. */
        }
    }
    return result.committed;
  }
  async function buy() {
    if (!enabled || !resource.isCurrent() || resource.sync.writing)
      return false;
    try {
      let id = localStorage.getItem(pendingKey);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(pendingKey, id);
      }
      return await request(
        "buy_medical_kit",
        { p_request_id: id },
        "Compra confirmada · Kit Médico na mochila",
      );
    } catch {
      setLocalError(
        "Permita o armazenamento deste navegador para comprar com segurança",
      );
      return false;
    }
  }
  async function loadMore() {
    if (!enabled || !resource.isCurrent() || paging.current || !history.hasMore)
      return;
    paging.current = true;
    setLoadingMore(true);
    const token = ++pageRequest.current,
      revision = resource.getCurrent()?.revision;
    try {
      const next = readCoinHistory(
        await withSyncTimeout(
          backendRpc("get_economy_history", {
            p_before: history.entries.at(-1)?.id,
          }),
        ),
      );
      if (
        !resource.isCurrent() ||
        token !== pageRequest.current ||
        revision !== resource.getCurrent()?.revision
      )
        return;
      setHistory((prev) => ({
        entries: [
          ...prev.entries,
          ...next.entries.filter(
            (e) => !prev.entries.some((p) => p.id === e.id),
          ),
        ],
        hasMore: next.hasMore,
      }));
      setLocalError("");
    } catch (e) {
      if (resource.isCurrent() && token === pageRequest.current)
        setLocalError(syncProblem(e).message);
    } finally {
      if (resource.isCurrent()) {
        paging.current = false;
        setLoadingMore(false);
      }
    }
  }
  return withSync(
    {
      state: resource.state,
      history:
        historyOwner.current === userId && history.entries.length
          ? history
          : (resource.state?.history ?? { entries: [], hasMore: false }),
      enabled,
      busy: resource.busy || loadingMore,
      error:
        (historyOwner.current === userId ? localError : "") || resource.error,
      notice: historyOwner.current === userId ? notice : "",
      noticeReward: historyOwner.current === userId ? noticeReward : undefined,
      clearNotice: () => {
        setNotice("");
        setNoticeReward(undefined);
      },
      refresh: resource.refresh,
      buy,
      acknowledgeAutomatic: (ids: string[]) =>
        request("acknowledge_medical_kit_notice", { p_ids: ids }, ""),
      loadMore,
      useKit: (day: string) =>
        request(
          "use_medical_kit",
          { p_day: day },
          "Kit usado · Sua ofensiva está protegida hoje",
        ),
    },
    resource.sync,
  );
}
