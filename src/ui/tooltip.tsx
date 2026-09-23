"use client";

import { useId, type ReactNode } from "react";

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className="group relative inline-flex rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" tabIndex={0} aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden w-64 rounded border border-border bg-foreground p-2 text-left text-xs font-normal text-background group-focus-within:block group-hover:block"
      >
        {label}
      </span>
    </span>
  );
}
