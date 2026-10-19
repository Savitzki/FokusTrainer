import { useEffect, useState } from "react";

export const MINIMUM_LOADING_MS = 2000;

/** One clock per visible loading episode, including the auth → data handoff. */
export function useMinimumLoading(pending: boolean) {
  const [cycle, setCycle] = useState(() => ({
    startedAt: null as number | null,
    elapsed: !pending,
  }));
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
