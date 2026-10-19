import { BRAND_ASSETS } from "./brandAssets";

/** Reuses official brand art; the ledger and existing item IDs are unchanged. */
export default function CapiWheyToken({ size = 22 }: { size?: number }) {
  return (
    <span
      className="capiwhey-token"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <img
        src={BRAND_ASSETS.symbol}
        alt=""
        width={size}
        height={size}
        decoding="async"
      />
    </span>
  );
}
