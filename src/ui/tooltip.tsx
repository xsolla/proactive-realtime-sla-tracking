"use client";

import { useId, type ReactNode } from "react";

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className="group relative inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" tabIndex={0} aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden w-64 rounded-card border border-border bg-popover p-3 text-left text-xs font-normal text-popover-foreground group-focus-within:block group-hover:block"
      >
        {label}
      </span>
    </span>
  );
}
