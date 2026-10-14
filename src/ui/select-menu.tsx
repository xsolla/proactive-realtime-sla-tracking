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
      <summary className="menu-trigger inline-flex min-h-11 cursor-pointer list-none items-center gap-2 whitespace-nowrap rounded-input border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="text-muted-foreground">{label}</span>
        <span>{value}</span>
        <Caret direction="down" />
      </summary>
      <div className="absolute right-0 z-20 mt-1 max-h-80 min-w-full overflow-y-auto rounded-card border border-border bg-popover p-1 text-popover-foreground">
        {children}
      </div>
    </details>
  );
}
