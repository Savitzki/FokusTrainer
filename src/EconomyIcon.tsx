/** Official artwork supplied by the user. Keep asset references in one place. */
export const ECONOMY_ASSETS = {
  capiwhey: "images/capiwhey.png",
  medicalKit: "images/capi-kit-medico.png",
} as const;

export default function EconomyIcon({
  kind,
  size = 22,
}: {
  kind: keyof typeof ECONOMY_ASSETS;
  size?: number;
}) {
  return (
    <span
      className={`economy-icon economy-icon-${kind}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <img
        src={`${import.meta.env.BASE_URL}${ECONOMY_ASSETS[kind]}`}
        alt=""
        width={size}
        height={size}
        decoding="async"
      />
    </span>
  );
}
