import type { ButtonHTMLAttributes } from "react";

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

const variants = {
  primary:
    "border-primary bg-primary text-primary-foreground hover:bg-accent disabled:hover:bg-muted",
  secondary: "border-border bg-secondary text-foreground hover:bg-muted disabled:hover:bg-muted",
  ghost: "border-transparent bg-transparent text-foreground hover:bg-muted disabled:hover:bg-transparent",
} as const;

export function Button({
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground ${focus} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
