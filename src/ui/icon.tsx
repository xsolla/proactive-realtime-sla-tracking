export function Caret({ direction }: { direction: "down" | "right" }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`size-4 shrink-0 ${direction === "down" ? "rotate-90" : ""}`}
    >
      <path
        d="M6 3.5 11 8 6 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
