import { Chip, StatusBadge, Table, TableBody, TableCell, TableHead, TableHeaderCell } from "@/ui";
import type { AlertsView } from "./alerts-view";
import { ALERTS_UNAVAILABLE } from "./copy";

export function AlertsPage({ view }: { view: AlertsView }) {
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold leading-tight md:text-3xl">Alerts</h1>
        {view.state === "ok" ? <p className="text-sm text-muted-foreground">{view.note}</p> : null}
      </header>
      {view.state === "error" ? (
        <p role="alert" className="text-sm text-danger">{ALERTS_UNAVAILABLE}</p>
      ) : (
        <>
          <nav aria-label="Month" className="flex flex-wrap gap-2">
            {view.filter.map((option) => (
              <a key={option.href} href={option.href} aria-current={option.selected ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-button border px-3 py-2 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${option.selected ? "border-primary bg-primary/10 text-brand-text" : "border-border text-muted-foreground hover:bg-accent"}`}>{option.label}</a>
            ))}
          </nav>
          {view.empty !== null ? (
            <p className="text-sm text-muted-foreground">{view.empty}</p>
          ) : (
            <Table caption="Alert history">
              <TableHead>
                <tr className="border-b border-border">
                  <TableHeaderCell>Partner</TableHeaderCell><TableHeaderCell>Scope</TableHeaderCell><TableHeaderCell>Month</TableHeaderCell><TableHeaderCell>Last status</TableHeaderCell><TableHeaderCell>Last alerted</TableHeaderCell><TableHeaderCell numeric>Alerts sent</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {view.rows.map((row) => (
                  <tr key={row.key} className="border-b border-border last:border-b-0">
                    <TableCell><a href={row.href} className="font-medium text-link underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{row.partner}</a></TableCell>
                    <TableCell>{row.scope}</TableCell>
                    <TableCell>{row.month}</TableCell>
                    <TableCell>{row.statusKind === "badge" ? <StatusBadge variant={row.badgeVariant} label={row.status} /> : <Chip>{row.status}</Chip>}</TableCell>
                    <TableCell className="font-mono tabular-nums">{row.lastAlerted}</TableCell>
                    <TableCell numeric>{row.alerts}</TableCell>
                  </tr>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </>
  );
}
