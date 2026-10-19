import { useState, type ReactNode } from "react";
import { bannerImage } from "./cosmetics";

/** Missing assets leave the free, theme-aware profile appearance intact. */
export function ProfileCover({
  banner,
  fallback = null,
}: {
  banner?: string;
  fallback?: ReactNode;
}) {
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
  ) : (
    fallback
  );
}
