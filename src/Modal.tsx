import { useEffect, useRef, useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { useDialogViewport } from "./useDialogViewport";
export default function Modal({
  title,
  onClose,
  children,
  wide = false,
  compactHeader = false,
  centered = false,
  minimal = false,
  dismissible = true,
  closeDisabled = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  compactHeader?: boolean;
  centered?: boolean;
  minimal?: boolean;
  dismissible?: boolean;
  closeDisabled?: boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogViewport(dialogRef);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const policyRef = useRef({ dismissible, closeDisabled });
  policyRef.current = { dismissible, closeDisabled };
  useEffect(() => {
    dialogRef.current?.setAttribute("closedby", dismissible && !closeDisabled ? "closerequest" : "none");
  }, [dismissible, closeDisabled]);
  useEffect(() => {
    const dialog = dialogRef.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const cancel = (event: Event) => {
      event.preventDefault();
      if (policyRef.current.dismissible && !policyRef.current.closeDisabled)
        closeRef.current();
    };
    dialog.addEventListener("cancel", cancel);
    return () => {
      dialog.removeEventListener("cancel", cancel);
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className={`modal ${wide ? "modal-share" : ""} ${compactHeader ? "modal-profile" : ""} ${centered ? "modal-centered" : ""} ${minimal ? "modal-minimal" : ""}`}
      aria-labelledby={titleId}
      onClick={(e) => {
        if (dismissible && !closeDisabled && e.target === dialogRef.current) onClose();
      }}
    >
      <div className="modal-heading">
        {minimal ? (
          <h2 className="sr-only" id={titleId}>
            {title}
          </h2>
        ) : compactHeader ? (
          <h2 id={titleId}>{title}</h2>
        ) : (
          <span className="eyebrow">VAMOS NESSA</span>
        )}
        <button
          className="icon-button"
          aria-label="Fechar janela"
          disabled={closeDisabled}
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {!compactHeader && !minimal && <h2 id={titleId}>{title}</h2>}
      {children}
    </dialog>
  );
}
