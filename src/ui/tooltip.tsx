"use client";

import { useId, type ReactNode } from "react";

const positions = {
  above: "bottom-full right-0 mb-2",
  "right-down": "left-full top-full ml-2 mt-2",
} as const;

export function Tooltip({
  label,
  children,
  ariaLabel,
  position = "above",
}: {
  label: string;
  children: ReactNode;
  ariaLabel?: string;
  position?: keyof typeof positions;
}) {
  const id = useId();
  return (
    <span
      className="group relative inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-describedby={id}
    >
      {children}
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute z-20 hidden w-72 whitespace-pre-line rounded-card border border-border bg-popover p-3 text-left text-xs font-normal leading-relaxed text-popover-foreground group-focus-within:block group-hover:block ${positions[position]}`}
      >
        {label}
      </span>
    </span>
  );
}
