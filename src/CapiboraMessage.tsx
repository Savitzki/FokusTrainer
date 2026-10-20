import type { CSSProperties, Ref } from "react";
import Mascot from "./Mascot";
import type { CapiboraMessage as Message } from "./capiboraVoice";
import "./capiboraMessage.css";

/** Speech only. Buttons and domain/confirmation states remain with their existing controllers. */
export default function CapiboraMessage({
  message,
  variant = "inline",
  heading = "h3",
  titleId,
  headingRef,
  size = 96,
  showMascot = true,
  showTitle = true,
  animate = false,
}: {
  message: Message;
  variant?: "hero" | "inline" | "centered";
  heading?: "h1" | "h2" | "h3" | "strong";
  titleId?: string;
  headingRef?: Ref<HTMLHeadingElement>;
  size?: number;
  showMascot?: boolean;
  showTitle?: boolean;
  animate?: boolean;
}) {
  const Heading = heading;
  return (
    <div
      className={`capibora-message capibora-message--${variant}`}
      style={
        variant === "hero"
          ? undefined
          : ({ "--speech-art-size": `${size}px` } as CSSProperties)
      }
    >
      <div className="capibora-message-copy">
        {showTitle && (
          <Heading
            className={`capibora-message-title${variant === "hero" ? " hero-message" : ""}`}
            id={titleId}
            ref={headingRef}
            tabIndex={titleId || headingRef ? -1 : undefined}
          >
            {message.title}
          </Heading>
        )}
        <p className="capibora-message-body">{message.body}</p>
      </div>
      {showMascot && (
        <Mascot
          pose={message.expression}
          size={size}
          animate={animate}
          loading={variant === "hero" ? "eager" : "lazy"}
        />
      )}
    </div>
  );
}
