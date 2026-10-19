import CapiWheyToken from "./CapiWheyToken";

/** Explicit currency for assistive technology, only artwork + number visually. */
export default function CapiWheyAmount({
  amount,
  signed = false,
  size = 22,
}: {
  amount: number;
  signed?: boolean;
  size?: number;
}) {
  const value = `${signed && amount > 0 ? "+" : ""}${amount.toLocaleString("pt-BR")}`;
  return (
    <span
      className="currency-amount"
      role="img"
      aria-label={`${value} CapiWhey`}
    >
      <span className="currency-amount-visual" aria-hidden="true">
        <CapiWheyToken size={size} />
        <span>{value}</span>
      </span>
    </span>
  );
}
