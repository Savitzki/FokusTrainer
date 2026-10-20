import { Avatar } from "./Avatar";
import type { Profile } from "./profile";

/** Use the real avatar whenever available, independently of an equipped frame. */
export default function ArenaAvatar({
  name,
  lit = false,
  frame,
  avatar,
}: {
  name: string;
  lit?: boolean;
  frame?: string;
  avatar?: Profile;
}) {
  return (
    <span
      className={`team-avatar ${lit ? "is-lit" : ""}`}
      aria-hidden={avatar ? undefined : true}
    >
      {avatar ? (
        <Avatar profile={avatar} frame={frame} size={42} />
      ) : (
        [...name].slice(0, 2).join("").toUpperCase()
      )}
    </span>
  );
}
