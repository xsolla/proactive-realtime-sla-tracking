import type { ReactNode } from "react";

const tones = {
  neutral: "border-border bg-muted text-foreground",
  warning: "border-warning bg-warning text-warning-foreground",
  danger: "border-danger bg-danger text-destructive-foreground",
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
      className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
