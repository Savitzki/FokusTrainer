import { useEffect, useState } from "react";

export const MINIMUM_LOADING_MS = 2000;

function bootStartedAt() {
  const raw = document.documentElement.dataset.capiboraBootStarted;
  const value = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= performance.now()
    ? value
    : null;
}

/** One clock per visible loading episode, including the auth → data handoff. */
export function useMinimumLoading(pending: boolean) {
  const [cycle, setCycle] = useState(() => ({
    startedAt: pending ? bootStartedAt() : null,
    elapsed: !pending,
  }));
  useEffect(() => {
    document.documentElement.removeAttribute("data-capibora-boot-started");
  }, []);
  useEffect(() => {
    if (pending && cycle.startedAt === null) {
      setCycle({ startedAt: performance.now(), elapsed: false });
      return;
    }
    if (cycle.startedAt === null) return;
    const finish = () =>
      setCycle({
        startedAt: pending ? cycle.startedAt : null,
        elapsed: true,
      });
    const remaining = Math.max(
      0,
      MINIMUM_LOADING_MS - (performance.now() - cycle.startedAt),
    );
    if (!remaining) {
      finish();
      return;
    }
    const timer = window.setTimeout(finish, remaining);
    return () => window.clearTimeout(timer);
  }, [pending, cycle.startedAt]);
  return pending || !cycle.elapsed;
}
