import { useEffect, type RefObject } from "react";

// Mobile keyboards can shrink only the visual viewport, leaving 100dvh behind.
export function useDialogViewport(ref: RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = viewport?.height ?? window.innerHeight;
        const top = viewport?.offsetTop ?? 0;
        dialog.style.setProperty("--dialog-viewport-top", `${top}px`);
        dialog.style.setProperty("--dialog-viewport-height", `${height}px`);
        dialog.style.setProperty(
          "--dialog-bottom-offset",
          `${Math.max(0, window.innerHeight - height - top)}px`,
        );
        const active = document.activeElement;
        if (
          !(active instanceof HTMLElement) ||
          !dialog.contains(active) ||
          !active.matches("input, select, textarea")
        )
          return;
        const bounds = active.getBoundingClientRect();
        const field = active.closest(".signup-step");
        const actions =
          field?.parentElement?.querySelector<HTMLElement>(".signup-actions");
        if (field && actions) {
          const actionBounds = actions.getBoundingClientRect();
          // Keep the next action visible too when it fits together with the field.
          if (
            actionBounds.bottom > top + height - 16 &&
            actionBounds.bottom - field.getBoundingClientRect().top <=
              height - 32
          ) {
            actions.scrollIntoView?.({ block: "nearest", behavior: "instant" });
            return;
          }
        }
        if (bounds.top < top + 16 || bounds.bottom > top + height - 16)
          active.scrollIntoView?.({ block: "nearest", behavior: "instant" });
      });
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    dialog.addEventListener("focusin", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      dialog.removeEventListener("focusin", update);
      dialog.style.removeProperty("--dialog-viewport-height");
      dialog.style.removeProperty("--dialog-viewport-top");
      dialog.style.removeProperty("--dialog-bottom-offset");
    };
  }, [ref]);
}
