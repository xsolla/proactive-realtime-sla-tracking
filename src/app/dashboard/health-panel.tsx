import { Card } from "@/ui";
import { ZERO_COVERAGE_NOTE } from "./copy";
import type { HealthView } from "./model";

export function HealthPanel({ health }: { health: HealthView }) {
  return (
    <section aria-labelledby="data-health-heading">
      <Card>
        <div className="flex flex-col gap-4">
          <h2 id="data-health-heading" className="text-lg font-semibold tracking-tight">
            Data health
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Dropped rows"
              value={String(health.droppedRows)}
              detail={`of ${health.usableCount + health.droppedRows} rows in the extract`}
              warn={health.droppedRows > 0}
            />
            <Metric
              label="Unresolved partners"
              value={String(health.unresolvedPartnerNames.length)}
              warn={health.unresolvedPartnerNames.length > 0}
            />
            <Metric
              label="Unmatched services"
              value={String(health.unmatchedServiceNames.length)}
              warn={health.unmatchedServiceNames.length > 0}
            />
            <Metric
              label="Partners with no rows"
              value={String(health.partnersWithNoRows.length)}
              detail={ZERO_COVERAGE_NOTE}
              warn={false}
            />
          </div>
          {health.reasons.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {health.reasons.map((reason) => (
                <li key={reason.key} className="font-mono text-sm text-warning">
                  {reason.count} {reason.label}
                </li>
              ))}
            </ul>
          ) : null}
          <NameList label="Unresolved partner names" names={health.unresolvedPartnerNames} />
          <NameList label="Unmatched service names" names={health.unmatchedServiceNames} />
          <NameList label="Partners with no attributed rows" names={health.partnersWithNoRows} />
        </div>
      </Card>
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
  warn,
}: {
  label: string;
  value: string;
  detail?: string;
  warn: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-mono text-2xl tabular-nums ${warn ? "text-warning" : "text-foreground"}`}>{value}</p>
      {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function NameList({ label, names }: { label: string; names: readonly string[] }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</h3>
      {names.length === 0 ? (
        <p className="text-sm text-foreground">None</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {names.map((name) => (
            <li key={name} className="text-sm text-foreground">
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
