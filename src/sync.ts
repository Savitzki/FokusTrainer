import { STORAGE_KEY } from "./model";

export type SyncResource =
  | "training"
  | "economy"
  | "social"
  | "weights"
  | "gamification"
  | "session"
  | "reports"
  | "challenges"
  | "profile"
  | "showcase"
  | "notifications";
export type SyncKind = "network" | "auth" | "server" | "validation";
export type ResourceSync = {
  initialLoading: boolean;
  refreshing: boolean;
  writing: boolean;
  stale: boolean;
  error: string;
  errorKind: SyncKind | null;
  lastSuccess: number;
};
type Registration = {
  userId: string;
  resource: SyncResource;
  refresh: () => unknown;
  invalidate: () => void;
  status: ResourceSync;
};
const registrations = new Set<Registration>(),
  subscribers = new Set<() => void>();
const active = new Map<string, Set<SyncResource>>(),
  epochs = new Map<string, number>();
const flights = new Map<string, Promise<unknown>>();
const pending = new Set<Registration>();
let version = 0,
  listening = false,
  timer: ReturnType<typeof setInterval> | undefined;
const changed = () => {
  version++;
  subscribers.forEach((fn) => fn());
};
const scope = (id: string, resource: SyncResource) => `${id}:${resource}`;
export const syncEpoch = (id: string, resource: SyncResource) =>
  epochs.get(scope(id, resource)) ?? 0;
export function syncProblem(error: unknown): {
  message: string;
  kind: SyncKind;
} {
  const e = error as {
    message?: string;
    kind?: SyncKind;
    status?: number;
    code?: string;
    name?: string;
  };
  const message = e?.message || "Não foi possível atualizar as informações";
  if (e?.kind) return { message, kind: e.kind };
  if (
    e?.status === 401 ||
    e?.status === 403 ||
    /JWT|PGRST30|refresh_token/.test(e?.code ?? "")
  )
    return {
      kind: "auth",
      message:
        "Sua sessão precisa ser renovada. Entre novamente para sincronizar",
    };
  if (e?.code === "P0001") return { message, kind: "validation" };
  if (
    !navigator.onLine ||
    /fetch|network|timeout|abort|conexão|internet|esgotado/i.test(
      `${e?.name} ${message}`,
    )
  )
    return { message, kind: "network" };
  return { message, kind: "server" };
}
export function withSyncTimeout<T>(
  request: PromiseLike<T>,
  timeout = 15000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          Object.assign(
            new Error("A conexão demorou demais. Tente sincronizar novamente"),
            { kind: "network" },
          ),
        ),
      timeout,
    );
    Promise.resolve(request)
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
}
/** Only in-flight reads are shared; no result from another account/epoch is reused. */
export function sharedSyncRead<T>(
  key: string,
  read: () => Promise<T>,
): Promise<T> {
  const existing = flights.get(key);
  if (existing) return existing as Promise<T>;
  let result: Promise<T>;
  try {
    result = read();
  } catch (error) {
    result = Promise.reject(error);
  }
  const request = withSyncTimeout(result);
  flights.set(key, request);
  void request
    .finally(() => {
      if (flights.get(key) === request) flights.delete(key);
    })
    .catch(() => {});
  return request;
}
function enqueue(entry: Registration) {
  pending.add(entry);
  queueMicrotask(() => {
    if (!pending.delete(entry) || !registrations.has(entry)) return;
    void entry.refresh();
  });
}
export function invalidateSync(
  userId: string | null,
  resources: SyncResource[],
  broadcast = false,
  except?: SyncResource,
) {
  if (!userId) return;
  const selected = new Set(resources.filter((r) => r !== except));
  selected.forEach((r) =>
    epochs.set(scope(userId, r), syncEpoch(userId, r) + 1),
  );
  for (const entry of registrations)
    if (entry.userId === userId && selected.has(entry.resource)) {
      entry.invalidate();
      enqueue(entry);
    }
  if (broadcast)
    try {
      localStorage.setItem(
        `${STORAGE_KEY}:account:${userId}:sync-event`,
        JSON.stringify({
          resources: [...new Set(resources)],
          nonce: crypto.randomUUID(),
        }),
      );
    } catch {
      /* Refresh on resume still works when storage is unavailable. */
    }
}
export function mutationResources(name: string): SyncResource[] {
  if (
    ["enable_push_notifications", "decline_push_notifications"].includes(name)
  )
    return ["notifications"];
  if (["confirm_manual_workout", "finish_workout_session"].includes(name))
    return [
      "social",
      "training",
      "economy",
      "gamification",
      "reports",
      "challenges",
      "session",
    ];
  if (
    [
      "save_training_plan",
      "authorize_extra_rest",
      "reschedule_training",
    ].includes(name)
  )
    return ["training", "social", "gamification", "reports", "challenges"];
  if (name === "use_medical_kit")
    return [
      "economy",
      "training",
      "social",
      "gamification",
      "reports",
      "challenges",
    ];
  if (name === "set_group_reaction") return ["social"];
  if (name === "buy_medical_kit") return ["economy"];
  if (name === "sync_weight_entries")
    return ["weights", "economy", "gamification", "reports"];
  if (["start_workout_session", "cancel_workout_session"].includes(name))
    return ["session"];
  if (name === "submit_workout_review") return ["social", "reports"];
  if (["buy_cosmetic", "equip_cosmetic", "set_featured_medals"].includes(name))
    return name === "buy_cosmetic"
      ? ["gamification", "economy"]
      : ["gamification", "showcase"];
  if (/challenge/.test(name)) return ["challenges", "gamification", "economy"];
  if (/friend|streak_group|group_invite/.test(name))
    return ["social", "gamification", "challenges"];
  return [];
}
export const notifySyncWrite = (
  userId: string | null,
  name: string,
  except?: SyncResource,
) => invalidateSync(userId, mutationResources(name), true, except);
function isActive(entry: Registration) {
  return (
    !active.has(entry.userId) || active.get(entry.userId)!.has(entry.resource)
  );
}
function resume(force = false) {
  if (document.visibilityState !== "visible" || !navigator.onLine) return;
  for (const entry of registrations)
    if (
      isActive(entry) &&
      (force ||
        entry.status.stale ||
        Date.now() - entry.status.lastSuccess >= 15000)
    )
      enqueue(entry);
}
let wasHidden = false;
const onVisibility = () => {
  if (document.visibilityState !== "visible") {
    wasHidden = true;
    return;
  }
  const force = wasHidden;
  wasHidden = false;
  resume(force);
};
const onResume = () => resume(),
  onOnline = () => resume(true),
  onOffline = () => changed();
function onStorage(event: StorageEvent) {
  for (const userId of new Set([...registrations].map((r) => r.userId))) {
    if (
      event.key !== `${STORAGE_KEY}:account:${userId}:sync-event` ||
      !event.newValue
    )
      continue;
    try {
      const data = JSON.parse(event.newValue);
      if (Array.isArray(data.resources))
        invalidateSync(
          userId,
          data.resources.filter(
            (r: unknown) => typeof r === "string",
          ) as SyncResource[],
        );
    } catch {
      /* Ignore malformed signals; they contain no authoritative data. */
    }
  }
}
function startListeners() {
  if (listening) return;
  listening = true;
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  window.addEventListener("focus", onResume);
  window.addEventListener("pageshow", onResume);
  window.addEventListener("storage", onStorage);
  document.addEventListener("visibilitychange", onVisibility);
  // Existing 60-second fallback is shared and limited to visible resources. No Realtime.
  timer = setInterval(() => {
    if (document.visibilityState !== "visible" || !navigator.onLine) return;
    for (const e of registrations)
      if (isActive(e) && Date.now() - e.status.lastSuccess >= 60000) enqueue(e);
  }, 60000);
}
function stopListeners() {
  if (registrations.size || !listening) return;
  listening = false;
  clearInterval(timer);
  window.removeEventListener("online", onOnline);
  window.removeEventListener("offline", onOffline);
  window.removeEventListener("focus", onResume);
  window.removeEventListener("pageshow", onResume);
  window.removeEventListener("storage", onStorage);
  document.removeEventListener("visibilitychange", onVisibility);
  active.clear();
  pending.clear();
  wasHidden = false;
}
export function registerSync(entry: Registration) {
  registrations.add(entry);
  startListeners();
  changed();
  return {
    update(status: ResourceSync) {
      entry.status = status;
      changed();
    },
    dispose() {
      registrations.delete(entry);
      pending.delete(entry);
      stopListeners();
      changed();
    },
  };
}
export function activateSync(userId: string, resources: SyncResource[]) {
  active.set(userId, new Set(resources));
  for (const entry of registrations)
    if (
      entry.userId === userId &&
      isActive(entry) &&
      (entry.status.stale || Date.now() - entry.status.lastSuccess >= 15000)
    )
      enqueue(entry);
}
export function clearSyncAccount(userId: string) {
  active.delete(userId);
  for (const entry of registrations)
    if (entry.userId === userId) pending.delete(entry);
  for (const key of epochs.keys())
    if (key.startsWith(`${userId}:`)) epochs.delete(key);
  for (const key of flights.keys())
    if (key.startsWith(`${userId}:`)) flights.delete(key);
}
export const subscribeSync = (callback: () => void) => {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
};
export const syncVersion = () => version;
export const syncStates = (userId: string) =>
  [...registrations].filter((r) => r.userId === userId).map((r) => r.status);
export function retrySync(userId: string) {
  for (const entry of registrations)
    if (entry.userId === userId && (entry.status.stale || entry.status.error))
      enqueue(entry);
}
export const withSync = <T>(
  controller: T,
  sync: ResourceSync,
): T & { sync?: ResourceSync } => ({ ...controller, sync });
