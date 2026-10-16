import { BUSINESS_VIEW, ENGINEER_VIEW } from "../dashboard/copy";
import { WindowSelect } from "../dashboard/window-select";
import type { ShellFrame } from "./shell";

export function TopBar({
  frame,
  breadcrumb,
  showWindow = true,
}: {
  frame: ShellFrame;
  breadcrumb: { label: string; href?: string }[];
  showWindow?: boolean;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-background px-4 py-3 md:px-6">
      <ol className="flex items-center gap-2 text-sm">
        {breadcrumb.map((crumb, index) => (
          <li key={`${crumb.label}:${index}`} className="flex items-center gap-2">
            {index > 0 ? <span className="text-muted-foreground">›</span> : null}
            {crumb.href === undefined ? (
              <span className="text-foreground">{crumb.label}</span>
            ) : (
              <a href={crumb.href} className="text-link underline underline-offset-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {crumb.label}
              </a>
            )}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-4">
        {showWindow ? <WindowSelect months={frame.months} title={frame.windowTitle} phaseLabel={frame.phaseLabel} /> : null}
        <p className="font-mono text-xs tabular-nums text-muted-foreground">as of {frame.asOfLabel}</p>
        <ViewToggle active={frame.view.active} windowKey={frame.windowKey} />
      </div>
    </header>
  );
}

const SEGMENT = "inline-flex min-h-11 items-center rounded-button border px-3 py-2 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const SEGMENT_ACTIVE = "border-primary bg-primary/10 text-brand-text";
const SEGMENT_INACTIVE = "border-border text-muted-foreground hover:bg-accent";

/** Plain links to the overview with the view preference as a query parameter; no client code. */
function ViewToggle({ active, windowKey }: { active: "technical" | "business"; windowKey: string }) {
  const segments = [
    { role: "technical", label: ENGINEER_VIEW },
    { role: "business", label: BUSINESS_VIEW },
  ] as const;
  return (
    <nav aria-label="View" className="flex items-center gap-1">
      {segments.map((segment) => (
        <a
          key={segment.role}
          href={`/?view=${segment.role}&window=${encodeURIComponent(windowKey)}`}
          aria-current={active === segment.role ? "page" : undefined}
          className={`${SEGMENT} ${active === segment.role ? SEGMENT_ACTIVE : SEGMENT_INACTIVE}`}
        >
          {segment.label}
        </a>
      ))}
    </nav>
  );
}
