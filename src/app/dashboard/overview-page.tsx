import { Tile } from "@/ui";
import { AttentionTable } from "./attention-table";
import type { OverviewView } from "./overview";

export function OverviewPage({ view }: { view: OverviewView }) {
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold leading-tight md:text-3xl">Overview</h1>
        {view.summary === "" ? null : <p className="text-sm text-muted-foreground">{view.summary}</p>}
        {view.settledNote === null ? null : <p className="text-sm text-muted-foreground">{view.settledNote}</p>}
        {view.failure === null ? null : <p role="alert" className="text-sm text-danger">{view.failure}</p>}
      </header>
      <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {view.tiles.map((tile) => (
          <Tile key={tile.label} label={tile.label} value={tile.value} detail={tile.detail} help={tile.help} tone={tile.tone} labelTone={tile.labelTone} emphasis={tile.emphasis} />
        ))}
      </section>
      <section aria-labelledby="attention-heading" className="flex min-w-0 flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 id="attention-heading" className="font-heading text-lg font-semibold leading-tight md:text-xl">SLA Breaches/At Risk for Selected Month</h2>
          {view.failure === null ? <span className="font-mono text-xs text-muted-foreground">{view.attention.length} flagged</span> : null}
        </div>
        <AttentionTable rows={view.attention} failure={view.failure} />
      </section>
    </>
  );
}
