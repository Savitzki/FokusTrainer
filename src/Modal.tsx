import { useEffect, useRef, useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { useDialogViewport } from "./useDialogViewport";
export default function Modal({
  title,
  onClose,
  children,
  wide = false,
  compactHeader = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  compactHeader?: boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogViewport(dialogRef);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = dialogRef.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const cancel = (event: Event) => {
      event.preventDefault();
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
      className={`modal ${wide ? "modal-share" : ""} ${compactHeader ? "modal-profile" : ""}`}
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="modal-heading">
        {compactHeader ? (
          <h2 id={titleId}>{title}</h2>
        ) : (
          <span className="eyebrow">VAMOS NESSA</span>
        )}
        <button
          className="icon-button"
          aria-label="Fechar janela"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {!compactHeader && <h2 id={titleId}>{title}</h2>}
      {children}
    </dialog>
  );
}
