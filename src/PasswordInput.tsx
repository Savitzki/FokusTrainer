import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Visibility is temporary; neither toggling nor the timer changes the password. */
export default function PasswordInput(
  props: Omit<ComponentProps<"input">, "type">,
) {
  const [visible, setVisible] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [visible]);
  useEffect(() => {
    if (props.disabled) setVisible(false);
  }, [props.disabled]);
  return (
    <span className="password-entry">
      <input
        {...props}
        ref={(node) => {
          input.current = node;
          const ref = props.ref;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        type={visible ? "text" : "password"}
      />
      <button
        type="button"
        className="icon-button"
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
        disabled={props.disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setVisible((current) => !current);
          input.current?.focus({ preventScroll: true });
        }}
      >
        {visible ? (
          <EyeOff size={20} aria-hidden="true" />
        ) : (
          <Eye size={20} aria-hidden="true" />
        )}
      </button>
    </span>
  );
}
