import { useCallback, useEffect, useRef, useState } from "react";
import { accountConfigured, backendRpc } from "./backend";
import { accountStorageGeneration } from "./accountStorage";
import { STORAGE_KEY } from "./model";
import { currencyAmount } from "./currency";
import {
  readCoinHistory,
  readEconomyState,
  type CoinHistory,
  type EconomyState,
} from "./economy";

export type EconomyController = ReturnType<typeof useEconomy>;
export function useEconomy(userId: string | null, disabled = false) {
  // Balance is never computed from local records or modified optimistically.
  const [state, setState] = useState<EconomyState | null>(null);
  const [history, setHistory] = useState<CoinHistory>({
    entries: [],
    hasMore: false,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const current = useRef(state),
    alive = useRef(true),
    running = useRef(false),
    refreshAgain = useRef(false);
  const [generation] = useState(() =>
    userId ? accountStorageGeneration(userId) : 0,
  );
  const enabled = Boolean(userId && accountConfigured && !disabled);
  const pendingKey = `${STORAGE_KEY}:account:${userId}:kit-purchase`;
  const request = useCallback(
    async (name: string, args: Record<string, unknown> = {}, success = "") => {
      if (userId && accountStorageGeneration(userId) !== generation)
        return false;
      if (!enabled || running.current) {
        if (name === "get_economy_state" && enabled)
          refreshAgain.current = true;
        return false;
      }
      running.current = true;
      setBusy(true);
      const isCurrent = () =>
        alive.current && accountStorageGeneration(userId!) === generation;
      try {
        const next = readEconomyState(
          await backendRpc(name, {
            p_timezone:
              current.current?.timezone ??
              Intl.DateTimeFormat().resolvedOptions().timeZone ??
              "UTC",
            ...args,
          }),
        );
        if (!isCurrent()) return false;
        const previous = current.current;
        if (!previous || next.revision >= previous.revision) {
          current.current = next;
          setState(next);
          if (!previous || next.revision !== previous.revision)
            setHistory(next.history);
          if (success) setNotice(success);
          else if (previous && next.revision > previous.revision) {
            const lastId = BigInt(previous.history.entries[0]?.id ?? "0");
            const earned = next.history.entries
              .filter((e) => BigInt(e.id) > lastId && e.amount > 0)
              .reduce((sum, e) => sum + e.amount, 0);
            if (earned) setNotice(`+${currencyAmount(earned)} de proteína`);
            else if (
              next.monthlyKits?.freeAvailable &&
              previous.monthlyKits?.month !== next.monthlyKits.month
            )
              setNotice("Kits gratuitos renovados para este mês");
          }
        }
        try {
          const pending = localStorage.getItem(pendingKey);
          if (
            name === "buy_medical_kit" ||
            (pending &&
              next.history.entries.some(
                (e) => e.kind === "kit-purchase" && e.requestId === pending,
              ))
          )
            localStorage.removeItem(pendingKey);
        } catch {
          // The confirmed server result is still valid; a retained ID only retries that same purchase.
        }
        setError("");
        return true;
      } catch (e) {
        if (isCurrent())
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível atualizar seu saldo",
          );
        return false;
      } finally {
        running.current = false;
        if (isCurrent()) {
          setBusy(false);
          if (refreshAgain.current) {
            refreshAgain.current = false;
            void Promise.resolve().then(() => request("get_economy_state"));
          }
        }
      }
    },
    [enabled, userId, generation, pendingKey],
  );
  const refresh = useCallback(() => request("get_economy_state"), [request]);
  useEffect(() => {
    alive.current = true;
    if (enabled) void refresh();
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(visible, 60000);
    return () => {
      alive.current = false;
      clearInterval(timer);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [enabled, refresh]);
  async function buy() {
    if (userId && accountStorageGeneration(userId) !== generation) return false;
    if (!enabled || running.current) return false;
    try {
      // Keep the same ID across timeout/reload retries until the server confirms.
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
      setError(
        "Permita o armazenamento deste navegador para comprar com segurança",
      );
      return false;
    }
  }
  async function loadMore() {
    if (userId && accountStorageGeneration(userId) !== generation) return;
    if (!enabled || running.current || !history.hasMore) return;
    running.current = true;
    setBusy(true);
    try {
      const next = readCoinHistory(
        await backendRpc("get_economy_history", {
          p_before: history.entries.at(-1)?.id,
        }),
      );
      if (!alive.current || accountStorageGeneration(userId!) !== generation)
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
      setError("");
    } catch (e) {
      if (alive.current && accountStorageGeneration(userId!) === generation)
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível carregar o histórico",
        );
    } finally {
      running.current = false;
      if (alive.current && accountStorageGeneration(userId!) === generation) {
        setBusy(false);
        if (refreshAgain.current) {
          refreshAgain.current = false;
          void refresh();
        }
      }
    }
  }
  return {
    state,
    history,
    enabled,
    busy,
    error,
    notice,
    clearNotice: () => setNotice(""),
    refresh,
    buy,
    loadMore,
    useKit: (day: string) =>
      request(
        "use_medical_kit",
        { p_day: day },
        "Kit usado · Sua chama está protegida hoje",
      ),
  };
}
