import { Avatar } from "./Avatar";
import type { Profile } from "./profile";

/** Use the real avatar whenever available, independently of an equipped frame. */
export default function ArenaAvatar({
  name,
  lit = false,
  frame,
  avatar,
  size = 42,
}: {
  name: string;
  lit?: boolean;
  frame?: string;
  avatar?: Profile;
  size?: number;
}) {
  return (
    <span
      style={size === 42 ? undefined : { width: size, height: size }}
      className={`team-avatar ${lit ? "is-lit" : ""}`}
      aria-hidden={avatar ? undefined : true}
    >
      {avatar ? (
        <Avatar profile={avatar} frame={frame} size={size} />
      ) : (
        [...name].slice(0, 2).join("").toUpperCase()
      )}
    </span>
  );
}
