import { useState } from "react";
import { bannerImage } from "./cosmetics";

/** Missing assets leave the free, theme-aware profile appearance intact. */
export function ProfileCover({ banner }: { banner?: string }) {
  const src = banner ? bannerImage(banner) : null;
  const [failed, setFailed] = useState<string | null>(null);
  return src && failed !== src ? (
    <img
      className="profile-cover"
      src={src}
      alt=""
      aria-hidden="true"
      decoding="async"
      onError={() => setFailed(src)}
    />
  ) : null;
}
