import type { ReactNode } from "react";

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-card border border-border bg-card p-4 text-card-foreground md:p-6">{children}</div>;
}
