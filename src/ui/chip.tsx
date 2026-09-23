import type { ReactNode } from "react";

const tones = {
  neutral: "border-border bg-secondary text-foreground",
  warning: "border-warning bg-secondary text-warning",
  danger: "border-danger bg-secondary text-danger",
} as const;

export function Chip({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded border px-2 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
