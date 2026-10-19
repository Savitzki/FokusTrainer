import { useEffect, useRef, useState } from "react";
import { STORAGE_KEY } from "./model";

/** Presentation only: use the account's midnight, never a device-local day. */
export function isProtectionHour(now: Date, today: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return (
    `${part("year")}-${part("month")}-${part("day")}` === today &&
    Number(part("hour")) >= 23
  );
}

/** One optional suggestion per account/day in this tab, after fresh server reads.
 * No writes, timers or notification permission requests are introduced here.
 */
export function useHomeProtection({
  userId,
  today,
  eligible,
  available,
  refresh,
}: {
  userId: string | null;
  today: string;
  eligible: boolean;
  available: boolean;
  refresh: () => Promise<boolean>;
}) {
  const key = userId
    ? `${STORAGE_KEY}:account:${userId}:protection-suggestion:${today}`
    : "";
  const latest = useRef({ key, eligible, available, refresh });
  latest.current = { key, eligible, available, refresh };
  const checked = useRef("");
  const [verified, setVerified] = useState("");
  const [dismissed, setDismissed] = useState("");
  useEffect(() => {
    if (!key || !eligible || !available || checked.current === key) return;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      /* In-memory fallback. */
    }
    checked.current = key;
    let cancelled = false;
    void refresh()
      .then((ok) => {
        if (
          !cancelled &&
          ok &&
          latest.current.key === key &&
          latest.current.eligible
        )
          setVerified(key);
      })
      .catch(() => {
        /* A suggestion must never obscure a failed refresh. */
      });
    return () => {
      cancelled = true;
      if (checked.current === key) checked.current = "";
    };
  }, [key, eligible, available]);
  return {
    offer: Boolean(key && eligible && verified === key && dismissed !== key),
    dismiss() {
      setDismissed(key);
      try {
        sessionStorage.setItem(key, "dismissed");
      } catch {
        /* In-memory fallback. */
      }
    },
  };
}
