import { useEffect, type RefObject } from "react";

// Mobile keyboards can shrink only the visual viewport, leaving 100dvh behind.
export function useDialogViewport(ref: RefObject<HTMLDialogElement | null>) {
  useViewport(ref, true);
}
export function useFormViewport(ref: RefObject<HTMLElement | null>) {
  useViewport(ref, false);
}
function useViewport(ref: RefObject<HTMLElement | null>, modal: boolean) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // A form inside a dialog already has a viewport owner. Pinch zoom
        // must remain native rather than resizing the dialog a second time.
        if (!modal && dialog.closest("dialog")) return;
        const zoomed = viewport && viewport.scale > 1;
        const height =
          !zoomed && viewport ? viewport.height : window.innerHeight;
        const top = !zoomed && viewport ? viewport.offsetTop : 0;
        if (modal) {
          dialog.style.setProperty("--dialog-viewport-top", `${top}px`);
          dialog.style.setProperty("--dialog-viewport-height", `${height}px`);
          dialog.style.setProperty(
            "--dialog-bottom-offset",
            `${Math.max(0, window.innerHeight - height - top)}px`,
          );
        }
        const active = document.activeElement;
        if (!modal)
          dialog.style.setProperty(
            "--form-keyboard-inset",
            `${active instanceof HTMLElement && dialog.contains(active) ? Math.max(0, window.innerHeight - height - top) : 0}px`,
          );
        if (
          !(active instanceof HTMLElement) ||
          !dialog.contains(active) ||
          !active.matches("input, select, textarea")
        )
          return;
        const bounds = active.getBoundingClientRect();
        if (bounds.bottom <= bounds.top) return;
        const surface = dialog.getBoundingClientRect();
        const visibleTop =
          modal && surface.height > 0 ? Math.max(top, surface.top) : top;
        const visibleBottom =
          modal && surface.height > 0
            ? Math.min(top + height, surface.bottom)
            : top + height;
        const reveal = (target: HTMLElement) => {
          target.scrollIntoView?.({ block: "nearest", behavior: "instant" });
          const next = target.getBoundingClientRect();
          const delta =
            next.top < visibleTop + 16
              ? next.top - visibleTop - 16
              : next.bottom > visibleBottom - 16
                ? next.bottom - visibleBottom + 16
                : 0;
          if (!delta) return;
          if (modal) dialog.scrollTop += delta;
          else window.scrollBy({ top: delta, behavior: "instant" });
        };
        const field = active.closest(".signup-step");
        const actions =
          field?.parentElement?.querySelector<HTMLElement>(".signup-actions");
        if (field && actions) {
          const actionBounds = actions.getBoundingClientRect();
          // Keep the next action visible too when it fits together with the field.
          if (
            actionBounds.bottom > visibleBottom - 16 &&
            actionBounds.bottom - field.getBoundingClientRect().top <=
              visibleBottom - visibleTop - 32
          ) {
            reveal(actions);
            return;
          }
        }
        if (bounds.top < visibleTop + 16 || bounds.bottom > visibleBottom - 16)
          reveal(active);
      });
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    dialog.addEventListener("focusin", update);
    dialog.addEventListener("focusout", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      dialog.removeEventListener("focusin", update);
      dialog.removeEventListener("focusout", update);
      dialog.style.removeProperty("--form-keyboard-inset");
      dialog.style.removeProperty("--dialog-viewport-height");
      dialog.style.removeProperty("--dialog-viewport-top");
      dialog.style.removeProperty("--dialog-bottom-offset");
    };
  }, [ref, modal]);
}
