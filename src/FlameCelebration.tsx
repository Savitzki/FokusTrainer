import type { CSSProperties } from "react";
import { Flame } from "lucide-react";
export default function FlameCelebration() {
  return (
    <div className="flame-celebration" data-celebration aria-hidden="true">
      {Array.from({ length: 24 }, (_, i) => (
        <Flame
          key={i}
          fill="currentColor"
          className="fire-particle"
          style={
            {
              "--x": `${4 + ((i * 37) % 92)}vw`,
              "--drift": `${(i % 2 ? -1 : 1) * (15 + ((i * 13) % 90))}px`,
              "--turn": `${(i % 2 ? -1 : 1) * 45}deg`,
              width: 18 + ((i * 7) % 22),
              height: 18 + ((i * 7) % 22),
              animationDelay: `${(i % 6) * 65}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
