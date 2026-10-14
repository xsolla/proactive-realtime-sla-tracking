import type { ButtonHTMLAttributes } from "react";

const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const variants = {
  primary:
    "border-primary bg-primary text-primary-foreground hover:bg-[var(--xui-control-brand-primary-bgHover)] active:bg-[var(--xui-control-brand-primary-bgPress)]",
  secondary: "border-border bg-card text-foreground hover:bg-accent",
  ghost: "border-transparent bg-transparent text-foreground hover:bg-accent",
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
      className={`inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-button border px-4 py-2 text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:border-border disabled:bg-[var(--xui-control-brand-primary-bgDisable)] disabled:text-muted-foreground disabled:opacity-50 ${focus} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
