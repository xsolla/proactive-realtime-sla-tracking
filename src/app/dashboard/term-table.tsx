import { BudgetBar, Caret, StatusBadge, Table, TableBody, TableHead } from "@/ui";
import { badgeVariant, budgetTone } from "./attention-table";
import { FILED_AGAINST, statusLabel } from "./copy";
import { OutageLines } from "./outage-lines";
import { WindowTrend } from "./trend-sparkline";
import type { TermView } from "./view";

const COLUMNS = 5;
const GRID = "grid-cols-5";

function incidentReference(term: TermView): string {
  if (term.tickets === null) return "Not available";
  if (term.tickets.length === 0) return "N/A";
  return term.tickets.map((ticket) => ticket.key).join(", ");
}

function Facts({ term }: { term: TermView }) {
  const actualTone = term.status === "meeting" ? "text-foreground" : term.status === "at_risk" ? "text-warning" : "text-danger";
  return (
    <div className={`grid ${GRID} items-center gap-x-3 px-3 py-3 text-center`}>
      <span>
        <span className="block text-sm font-medium text-foreground">{term.title}</span>
        <span className="block font-mono text-xs text-muted-foreground">{term.downLine}</span>
      </span>
      <span><StatusBadge variant={badgeVariant[term.status]} label={statusLabel(term.status)} /></span>
      <span className="font-mono text-sm tabular-nums">
        {term.target} / <span className={actualTone}>{term.actual}</span>
        {term.actualCaption === null ? null : <span className="block text-xs text-muted-foreground">{term.actualCaption}</span>}
      </span>
      <span>
        <BudgetBar usedMinutes={term.usedMinutes} allowedMinutes={term.allowedMinutes} tone={budgetTone[term.status]} />
        <span className="mt-1 block text-center font-mono text-sm text-muted-foreground">{term.consumedPercent}</span>
      </span>
      <span className="font-mono text-sm text-foreground">{incidentReference(term)}</span>
    </div>
  );
}

export function TermTable({ partnerName, terms }: { partnerName: string; terms: readonly TermView[] }) {
  return (
    <div className="min-w-0 overflow-x-auto rounded-card border border-border bg-card text-card-foreground">
      <Table framed={false} caption={`SLA term evaluations for ${partnerName}`}>
        <TableHead>
          <tr className="border-b border-border">
            <th colSpan={COLUMNS} className="p-0 text-left font-normal">
              <div className="flex items-center">
                <span aria-hidden="true" className="w-10 shrink-0" />
                <div className={`grid min-w-0 flex-1 ${GRID} gap-x-3 px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground`}>
                  <span>Service</span><span>Contractual Status</span><span>Target / Actual</span><span>SLA Consumed</span><span>Incident Ticket Reference</span>
                </div>
              </div>
            </th>
          </tr>
        </TableHead>
        <TableBody>
          {terms.map((term) => {
            const panelId = `outages-${term.key.replace(/[^A-Za-z0-9_-]/g, "-")}`;
            const outages = term.outages !== null && term.outages.length > 0 ? term.outages : null;
            return (
              <tr key={term.key} className="border-b border-border last:border-b-0">
                <td colSpan={COLUMNS} className="p-0">
                  <details data-outages={outages === null ? undefined : ""} data-disclosure="" className="group">
                    <summary aria-expanded={false} aria-controls={panelId} aria-label={`Show ${outages === null ? "trend" : "outages"} for ${partnerName}, ${term.title}`} className="disclosure flex cursor-pointer list-none items-center transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                      <span className="px-3 text-foreground group-open:[&_svg]:rotate-90"><Caret direction="right" /></span>
                      <div className="min-w-0 flex-1"><Facts term={term} /></div>
                    </summary>
                    <div id={panelId} className="flex flex-col gap-3 border-t border-border bg-muted p-3">
                      <WindowTrend trend={term.trend} status={term.status} />
                      {outages === null ? null : <OutageLines outages={outages} serviceCaption={FILED_AGAINST} />}
                    </div>
                  </details>
                </td>
              </tr>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
