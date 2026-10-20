import { useState } from "react";
import { frameImage, frameArtworkStyle } from "./cosmetics";
import { avatarSource, type Profile } from "./profile";

export function Avatar({
  profile,
  size = 44,
  frame,
}: {
  profile: Profile | null;
  size?: number;
  frame?: string;
}) {
  const art = frame ? frameImage(frame) : null;
  const [failedArt, setFailedArt] = useState<string | null>(null);
  const image = (
    <img
      className="profile-avatar"
      data-frame={art && failedArt !== art ? frame : undefined}
      src={avatarSource(profile)}
      width={size}
      height={size}
      alt={profile ? `Avatar de ${profile.nickname}` : "Seu avatar"}
    />
  );
  return art && failedArt !== art ? (
    <span className="framed-avatar" style={{ width: size, height: size }}>
      {image}
      <img
        src={art}
        onError={() => setFailedArt(art)}
        className="avatar-frame-art"
        style={frame ? frameArtworkStyle(frame) : undefined}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        decoding="async"
      />
    </span>
  ) : (
    image
  );
}
