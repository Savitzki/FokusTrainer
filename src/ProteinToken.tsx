/** The virtual currency keeps the existing coin ledger; only its identity changes. */
export default function ProteinToken({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="2.5" width="16" height="4" rx="1.2" />
      <path d="M6 6.5 4 9v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-2-2.5M4 10h16M4 18h16" />
      <path d="M10 16v-4h2a1.4 1.4 0 0 1 0 2.8h-2" />
    </svg>
  );
}
