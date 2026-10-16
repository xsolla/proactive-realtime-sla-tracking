import { Tooltip } from "./tooltip";

const values = {
  neutral: "text-foreground",
  warning: "text-warning",
  danger: "text-danger",
  muted: "text-muted-foreground",
} as const;

const labelTones = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
} as const;

/**
 * One headline figure. `emphasis` tints the card itself (used for a breaching
 * count). The value is mono so columns of tiles line up.
 */
export function Tile({
  label,
  value,
  detail = null,
  help,
  tone = "neutral",
  labelTone,
  emphasis = false,
}: {
  label: string;
  value: string;
  detail?: string | null;
  help?: string;
  tone?: keyof typeof values;
  labelTone?: keyof typeof labelTones;
  emphasis?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-3 rounded-card border p-3 text-card-foreground transition-colors duration-150 md:p-4 ${emphasis ? "border-danger bg-danger/10" : "border-border bg-card hover:border-primary/30"}`}>
      <div className="flex items-center gap-1.5">
        <p className={`text-xs font-medium uppercase tracking-wide ${labelTone === undefined ? "text-muted-foreground" : labelTones[labelTone]}`}>{label}</p>
        {help === undefined ? null : (
          <Tooltip label={help} ariaLabel={`How ${label} is calculated`} position="right-down">
            <span
              aria-hidden="true"
              className="inline-flex size-4 items-center justify-center rounded-full border border-current font-mono text-[10px] leading-none opacity-70 transition-opacity duration-150 hover:opacity-100"
            >
              ?
            </span>
          </Tooltip>
        )}
      </div>
      <p className={`font-mono text-2xl font-bold tabular-nums md:text-3xl ${values[tone]}`}>{value}</p>
      {detail === null ? null : <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p>}
    </div>
  );
}
