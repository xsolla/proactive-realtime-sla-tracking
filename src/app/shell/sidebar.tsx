import { StatusDot } from "@/ui";
import type { Badge, NavModel } from "../dashboard/nav";
import { withWindow } from "../dashboard/nav";

function BadgeMark({ badge }: { badge: Badge }) {
  if (badge === null) return null;
  if ("status" in badge) {
    return <span className="rounded-md bg-danger px-2 py-0.5 font-mono text-xs text-destructive-foreground">!</span>;
  }
  const tone = badge.count > 0 ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground";
  return <span className={`rounded-md px-2 py-0.5 font-mono text-xs ${tone}`}>{badge.count}</span>;
}

function NavLink({ href, label, active, badge }: { href: string; label: string; active: boolean; badge?: Badge }) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center justify-between gap-3 border-l-2 px-4 py-2 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
        active ? "border-primary bg-primary/10 text-brand-text" : "border-transparent text-foreground hover:bg-accent"
      }`}
    >
      <span>{label}</span>
      {badge === undefined ? null : <BadgeMark badge={badge} />}
    </a>
  );
}

export function Sidebar({ nav }: { nav: NavModel }) {
  const active = nav.active;
  return (
    <nav aria-label="Dashboard" className="flex h-full flex-col gap-4 border-b border-border bg-sidebar py-4 lg:gap-6 lg:border-b-0 lg:border-r lg:py-5">
      <div className="px-4">
        <p className="font-heading text-lg font-semibold leading-tight text-brand-text">SLA tracking</p>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Partner operations</p>
      </div>
      <div className="flex flex-wrap lg:flex-col">
        <NavLink href={withWindow("/", nav.windowKey)} label="Overview" active={active.kind === "overview"} />
        {nav.role === "technical" ? (
          <>
            <NavLink href={withWindow("/alerts", nav.windowKey)} label="Alerts" active={active.kind === "alerts"} badge={nav.alerts} />
            <NavLink href="/health" label="Health" active={active.kind === "health"} badge={nav.health} />
          </>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <p className="px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">Partners</p>
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-col">
          {nav.partners.map((partner) => {
            const current = active.kind === "partner" && active.id === partner.id;
            return (
              <li key={partner.id}>
                <a
                  href={partner.href}
                  aria-current={current ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 border-l-2 px-4 py-2 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                    current ? "border-primary bg-primary/10 text-brand-text" : "border-transparent hover:bg-accent"
                  } ${current ? "text-brand-text" : partner.tone === "tracking" || partner.tone === "unknown" ? "text-muted-foreground" : "text-foreground"}`}
                >
                  {partner.tone === "unknown" ? null : <StatusDot tone={partner.tone} />}
                  <span className="flex-1">{partner.name}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
