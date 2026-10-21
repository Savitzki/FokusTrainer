import { useEffect, useState } from "react";
import { transientSyncError, type ResourceSync } from "./sync";

export type StartupResource = {
  available: boolean;
  sync?: ResourceSync;
  error?: string;
};

/** Reuse each controller's validated snapshot; never treat a pending write as loaded data. */
export function startupStatus(resources: StartupResource[]) {
  const missing = resources.filter((resource) => !resource.available);
  const failed =
    missing.find((resource) => resource.sync?.errorKind === "auth") ??
    missing.find((resource) => !transientSyncError(resource.sync?.errorKind ?? null) && (resource.error || resource.sync?.error));
  return {
    ready: missing.length === 0,
    error: failed?.error || failed?.sync?.error || "",
    authError: failed?.sync?.errorKind === "auth",
  };
}

/** Only gate initial hydration. Later navigation and revalidation remain nonblocking. */
export function useStartupGate(
  userId: string | null,
  resources: StartupResource[],
  recovery: StartupResource,
) {
  const [opening, setOpening] = useState(() => ({
    userId,
    cached: startupStatus(resources).ready,
    released: false,
  }));
  const current = opening.userId === userId;
  // Auth may hydrate the profile cache one render after the other controllers.
  const hydratedCache =
    startupStatus(resources).ready &&
    resources.every((resource) => !resource.sync?.lastSuccess);
  const status = startupStatus([
    ...resources,
    // An online-only session is recovered silently when the entire saved view is available.
    ...(current && (opening.cached || hydratedCache) ? [] : [recovery]),
  ]);
  useEffect(() => {
    if (!current) setOpening({ userId, cached: false, released: status.ready });
    else if (status.ready && !opening.released)
      setOpening((previous) => ({ ...previous, released: true }));
  }, [userId, current, status.ready, opening.released]);
  return {
    ...status,
    blocked: Boolean(userId && !(current && opening.released) && !status.ready),
  };
}
