import { useCallback, useEffect, useRef, useState } from "react";
import { accountStorageGeneration } from "./accountStorage";
import {
  notifySyncWrite,
  registerSync,
  sharedSyncRead,
  syncEpoch,
  syncProblem,
  withSyncTimeout,
  type ResourceSync,
  type SyncResource,
} from "./sync";

type Options<T> = {
  userId: string | null;
  resource: SyncResource;
  queryKey: string;
  enabled: boolean;
  read: () => Promise<unknown>;
  parse: (value: unknown) => T;
  cacheKey?: string;
  accept?: (next: T, previous: T) => boolean;
  onData?: (
    next: T,
    previous: T | null,
    source: "read" | "mutation" | "cache",
  ) => void;
};
function cached<T>(key: string | undefined, parse: Options<T>["parse"]) {
  if (key)
    try {
      const raw = localStorage.getItem(key);
      if (raw) return parse(JSON.parse(raw));
    } catch {
      /* Never overwrite malformed cache during hydration. */
    }
  return null;
}
/** Shared transport/lifecycle safeguards; domain revisions and offline queues stay in their controllers. */
export function useSyncedResource<T>(options: Options<T>) {
  const { userId, resource, queryKey, enabled, cacheKey } = options;
  const accountGeneration = userId ? accountStorageGeneration(userId) : 0;
  const identity = `${userId}:${queryKey}:${accountGeneration}`;
  const [record, setRecord] = useState(() => ({
    identity,
    value: cached(cacheKey, options.parse),
  }));
  const [flags, setFlags] = useState({
    reading: false,
    writing: false,
    settled: false,
    error: "",
    errorKind: null as ResourceSync["errorKind"],
    lastSuccess: 0,
    stale: true,
  });
  const latest = useRef(options);
  latest.current = options;
  const owner = useRef(identity);
  owner.current = identity;
  const current = useRef(record.value),
    alive = useRef(true),
    sequence = useRef(0);
  const flight = useRef<Promise<boolean> | null>(null),
    mutating = useRef(false),
    operationPending = useRef(false),
    again = useRef(false);
  const isCurrent = useCallback(
    () =>
      alive.current &&
      owner.current === identity &&
      Boolean(userId) &&
      accountGeneration === accountStorageGeneration(userId!),
    [identity, userId, accountGeneration],
  );
  const commit = useCallback(
    (value: unknown, source: "read" | "mutation" = "mutation") => {
      const next = latest.current.parse(value),
        previous = current.current;
      if (
        previous &&
        latest.current.accept &&
        !latest.current.accept(next, previous)
      )
        return previous;
      current.current = next;
      setRecord({ identity, value: next });
      if (cacheKey)
        try {
          localStorage.setItem(cacheKey, JSON.stringify(next));
        } catch {
          /* The server result remains valid without a local cache. */
        }
      latest.current.onData?.(next, previous, source);
      return next;
    },
    [cacheKey, identity],
  );
  const refresh = useCallback((): Promise<boolean> => {
    if (!enabled || !isCurrent()) return Promise.resolve(false);
    if (flight.current) return flight.current;
    if (mutating.current) {
      again.current = true;
      return Promise.resolve(false);
    }
    if (!navigator.onLine) {
      setFlags((s) => ({
        ...s,
        reading: false,
        settled: true,
        stale: true,
        error: "Sem conexão. As informações salvas podem estar desatualizadas",
        errorKind: "network",
      }));
      return Promise.resolve(false);
    }
    const token = ++sequence.current;
    setFlags((s) => ({ ...s, reading: true }));
    let request!: Promise<boolean>;
    request = (async () => {
      try {
        const read = latest.current.read;
        const value = await sharedSyncRead(
          `${userId}:${resource}:${accountGeneration}:${syncEpoch(userId!, resource)}:${queryKey}`,
          read,
        );
        if (!isCurrent() || token !== sequence.current) return false;
        commit(value, "read");
        setFlags((s) => ({
          ...s,
          settled: true,
          stale: false,
          lastSuccess: Date.now(),
          error: "",
          errorKind: null,
        }));
        return true;
      } catch (e) {
        if (isCurrent() && token === sequence.current) {
          const problem = syncProblem(e);
          setFlags((s) => ({
            ...s,
            settled: true,
            stale: true,
            error: problem.message,
            errorKind: problem.kind,
          }));
        }
        return false;
      } finally {
        if (flight.current === request) flight.current = null;
        if (isCurrent()) {
          setFlags((s) => ({ ...s, reading: false }));
          if (again.current && !mutating.current) {
            again.current = false;
            void refresh();
          }
        }
      }
    })();
    flight.current = request;
    return request;
  }, [enabled, isCurrent, commit, userId, resource, queryKey]);
  const invalidate = useCallback(() => {
    sequence.current++;
    again.current = Boolean(flight.current || mutating.current);
    setFlags((s) => ({ ...s, stale: true }));
  }, []);
  useEffect(() => {
    alive.current = true;
    current.current = cached(cacheKey, latest.current.parse);
    setRecord({ identity, value: current.current });
    setFlags({
      reading: false,
      writing: false,
      settled: false,
      error: "",
      errorKind: null,
      lastSuccess: 0,
      stale: true,
    });
    flight.current = null;
    mutating.current = false;
    operationPending.current = false;
    again.current = false;
    if (current.current !== null && isCurrent())
      latest.current.onData?.(current.current, null, "cache");
    if (enabled) void refresh();
    return () => {
      alive.current = false;
      sequence.current++;
    };
  }, [identity, cacheKey, enabled, refresh, userId]);
  const value = record.identity === identity ? record.value : null;
  const sync: ResourceSync = {
    initialLoading: enabled && value === null && !flags.settled,
    refreshing: flags.reading,
    writing: flags.writing,
    stale: flags.stale,
    error: flags.error,
    errorKind: flags.errorKind,
    lastSuccess: flags.lastSuccess,
  };
  const registration = useRef<ReturnType<typeof registerSync> | null>(null);
  useEffect(() => {
    if (!enabled || !userId) return;
    const handle = registerSync({
      userId,
      resource,
      refresh,
      invalidate,
      status: sync,
    });
    registration.current = handle;
    return () => {
      handle.dispose();
      if (registration.current === handle) registration.current = null;
    };
  }, [enabled, userId, resource, refresh, invalidate]);
  useEffect(() => {
    registration.current?.update(sync);
  }, [flags, value, enabled]);
  async function mutate(
    operation: () => Promise<unknown>,
    name: string,
    parseResponse = true,
  ) {
    if (!enabled || !isCurrent() || operationPending.current)
      return { committed: false, value: null as T | null };
    if (!navigator.onLine) {
      setFlags((s) => ({
        ...s,
        error: "Conecte-se à internet para confirmar esta operação",
        errorKind: "network",
        stale: true,
      }));
      return { committed: false, value: null as T | null };
    }
    mutating.current = true;
    operationPending.current = true;
    sequence.current++;
    again.current = false;
    setFlags((s) => ({ ...s, writing: true, error: "", errorKind: null }));
    let committed = false,
      next: T | null = null;
    try {
      const result = await withSyncTimeout(operation());
      if (!isCurrent()) return { committed: false, value: null };
      committed = true;
      notifySyncWrite(userId, name, parseResponse ? resource : undefined);
      if (parseResponse) {
        next = commit(result);
        setFlags((s) => ({
          ...s,
          settled: true,
          stale: false,
          lastSuccess: Date.now(),
        }));
      } else again.current = true;
    } catch (e) {
      if (committed) again.current = true;
      if (isCurrent()) {
        const p = syncProblem(e);
        setFlags((s) => ({
          ...s,
          settled: true,
          stale: committed || s.stale,
          error: committed
            ? `Operação salva. Não foi possível atualizar as informações: ${p.message}`
            : p.message,
          errorKind: p.kind,
        }));
      }
    } finally {
      if (isCurrent()) mutating.current = false;
    }
    if (committed && again.current && isCurrent()) {
      again.current = false;
      // An earlier read must finish (and be ignored) before the authoritative follow-up.
      if (flight.current) await flight.current;
      const updated = await refresh();
      if (!updated && isCurrent())
        setFlags((s) => ({
          ...s,
          error: s.error
            ? `Operação salva. Atualização pendente: ${s.error}`
            : "Operação salva. Atualização pendente",
          stale: true,
        }));
    }
    if (isCurrent()) {
      operationPending.current = false;
      setFlags((s) => ({ ...s, writing: false }));
    }
    return { committed, value: next };
  }
  const getCurrent = useCallback(
    () => (isCurrent() ? current.current : null),
    [isCurrent],
  );
  const publish = useCallback(
    (value: T) => {
      if (!isCurrent()) return;
      sequence.current++;
      commit(value);
      setFlags((s) => ({
        ...s,
        settled: true,
        stale: false,
        lastSuccess: Date.now(),
        error: "",
        errorKind: null,
      }));
    },
    [isCurrent, commit],
  );
  return {
    state: value,
    error: flags.error,
    busy: sync.writing || sync.initialLoading,
    sync,
    refresh,
    mutate,
    publish,
    isCurrent,
    getCurrent,
  };
}
