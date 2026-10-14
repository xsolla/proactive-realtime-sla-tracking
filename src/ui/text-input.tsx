import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { Tooltip } from "./tooltip";

const control =
  "min-h-11 w-full rounded-input border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors duration-150 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring read-only:bg-muted disabled:pointer-events-none disabled:opacity-50";

export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${control} ${className}`} {...props} />;
}

export function TextArea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${control} ${className}`} {...props} />;
}

export function Field({
  label,
  htmlFor,
  field,
  error,
  warning,
  help,
  children,
}: {
  label: string;
  htmlFor: string;
  field: string;
  error?: string;
  warning?: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2" data-field={field}>
      <div className="flex items-center gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {help ? (
          <Tooltip label={help}>
            <span
              aria-hidden="true"
              className="inline-flex size-5 items-center justify-center rounded-full border border-border font-mono text-xs text-muted-foreground"
            >
              ?
            </span>
            <span className="sr-only">More information about {label}</span>
          </Tooltip>
        ) : null}
      </div>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {!error && warning ? (
        <p id={`${htmlFor}-warning`} className="text-sm text-warning">
          {warning}
        </p>
      ) : null}
    </div>
  );
}
