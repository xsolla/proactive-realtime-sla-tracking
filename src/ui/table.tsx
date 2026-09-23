import type { ReactNode } from "react";

export function Table({
  caption,
  children,
  framed = true,
}: {
  caption: string;
  children: ReactNode;
  framed?: boolean;
}) {
  const table = (
    <table className="w-full border-collapse text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      {children}
    </table>
  );
  if (!framed) {
    return table;
  }
  return <div className="overflow-x-auto rounded border border-border">{table}</div>;
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="bg-card">{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr className={`border-b border-border last:border-b-0 ${className}`} onClick={onClick}>
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  numeric = false,
  className = "",
}: {
  children: ReactNode;
  numeric?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`px-3 py-3 align-top ${numeric ? "text-right font-mono tabular-nums" : ""} ${className}`}
    >
      {children}
    </td>
  );
}

export function TableHeaderCell({
  children,
  numeric = false,
}: {
  children: ReactNode;
  numeric?: boolean;
}) {
  return (
    <th
      scope="col"
      className={`px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground ${numeric ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}
