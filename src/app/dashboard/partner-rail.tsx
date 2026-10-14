import { Chip, StatusBadge } from "@/ui";
import { badgeVariant } from "./attention-table";
import { TRACKING_ONLY_LABEL, statusLabel } from "./copy";
import type { RailCard } from "./overview";

export function PartnerRail({ cards }: { cards: readonly RailCard[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {cards.map((card) => (
        <li key={card.id} className="rounded-card border border-border bg-card p-4 text-card-foreground transition-colors duration-150 hover:border-primary/30">
          <div className="flex items-start justify-between gap-3">
            <a href={card.href} className="text-sm font-medium text-link underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{card.name}</a>
            {card.unavailable ? null : card.worst === null ? <Chip>{TRACKING_ONLY_LABEL}</Chip> : <StatusBadge variant={badgeVariant[card.worst]} label={statusLabel(card.worst)} />}
          </div>
          <p className={`mt-2 font-mono text-xs ${card.unavailable ? "text-danger" : "text-muted-foreground"}`} role={card.unavailable ? "alert" : undefined}>{card.line}</p>
          {card.termsLink === null ? null : (
            <a href={card.termsLink.href} className="mt-2 inline-block text-xs text-link underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{card.termsLink.label}</a>
          )}
        </li>
      ))}
    </ul>
  );
}
