import type { ReactNode } from "react";

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded border border-border bg-card p-4">{children}</div>;
}
