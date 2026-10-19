import { useEffect, useState } from "react";
import type { MascotPose } from "./capiboraVoice";
import { MASCOT_ASSETS } from "./mascotAssets";

export default function Mascot({
  pose = "neutral",
  size = 64,
  animate = false,
  loading = "lazy",
}: {
  pose?: MascotPose;
  size?: number;
  animate?: boolean;
  loading?: "lazy" | "eager";
}) {
  const asset = MASCOT_ASSETS[pose];
  const [failed, setFailed] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    setFailed(null);
    if (!asset?.animatedSrc || !animate) {
      setPlaying(false);
      return;
    }
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const stop = () => setPlaying(false);
    setPlaying(Boolean(query && !query.matches));
    query?.addEventListener?.("change", stop);
    const timer = window.setTimeout(
      stop,
      Math.min(2500, Math.max(100, asset.durationMs ?? 1200)),
    );
    return () => {
      clearTimeout(timer);
      query?.removeEventListener?.("change", stop);
    };
  }, [asset, pose, animate]);
  if (!asset || failed === asset.src) return null;
  const source = playing && asset.animatedSrc ? asset.animatedSrc : asset.src;
  return (
    <img
      className="capibora-mascot"
      src={source}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading={loading}
      decoding="async"
      onError={() => {
        if (playing) setPlaying(false);
        else setFailed(asset.src);
      }}
    />
  );
}
