import { useCallback, useEffect, useState } from "react";

// The CSS fade lasts 240 ms. This also removes the layer if animationend is lost
// when a mobile browser suspends the page or animations are unavailable.
export const LOADING_EXIT_FALLBACK_MS = 320;

export function useLoadingExit(opening: boolean) {
  const [retained, setRetained] = useState(opening);
  const finish = useCallback(() => {
    if (!opening) setRetained(false);
  }, [opening]);

  useEffect(() => {
    if (opening) {
      setRetained(true);
      return;
    }
    if (!retained) return;
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (motion?.matches) {
      finish();
      return;
    }
    const changed = () => {
      if (motion?.matches) finish();
    };
    motion?.addEventListener?.("change", changed);
    const timer = window.setTimeout(finish, LOADING_EXIT_FALLBACK_MS);
    return () => {
      window.clearTimeout(timer);
      motion?.removeEventListener?.("change", changed);
    };
  }, [opening, retained, finish]);

  return {
    visible: opening || retained,
    leaving: !opening && retained,
    finish,
  };
}
