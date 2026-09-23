import type { ReactNode } from "react";
import { Caret } from "./icon";

export function SelectMenu({
  label,
  value,
  children,
}: {
  label: string;
  value: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="relative">
      <summary className="menu-trigger inline-flex cursor-pointer list-none items-center gap-2 whitespace-nowrap rounded border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
        <span className="text-muted-foreground">{label}</span>
        <span>{value}</span>
        <Caret direction="down" />
      </summary>
      <div className="absolute right-0 z-20 mt-1 max-h-80 min-w-full overflow-y-auto rounded border border-border bg-card p-1">
        {children}
      </div>
    </details>
  );
}
