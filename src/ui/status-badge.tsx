/**
 * Status never rides on colour alone: the label is required and visible.
 * Success, warning, and danger are the meeting, at-risk, and breaching tokens.
 */
const variants = {
  neutral: "border-border bg-muted text-foreground",
  success: "border-success bg-success text-success-foreground",
  warning: "border-warning bg-warning text-warning-foreground",
  danger: "border-danger bg-danger text-destructive-foreground",
} as const;

export type StatusBadgeVariant = keyof typeof variants;

export function StatusBadge({
  variant,
  label,
}: {
  variant: StatusBadgeVariant;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium ${variants[variant]}`}
    >
      {label}
    </span>
  );
}
