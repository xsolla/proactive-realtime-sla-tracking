import { SelectMenu } from "@/ui";
import type { MonthOption } from "./model";

export function WindowSelect({
  months,
  title,
  phaseLabel,
}: {
  months: MonthOption[];
  title: string;
  phaseLabel: string;
}) {
  return (
    <SelectMenu
      label="Window"
      value={
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <span>{title}</span>
          <span className="text-muted-foreground">{phaseLabel}</span>
        </span>
      }
    >
      <ul>
        {months.map((month) => (
          <li key={month.key}>
            <a
              href={month.href}
              aria-current={month.selected ? "page" : undefined}
              className={`flex min-h-11 items-center justify-between gap-4 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${month.selected ? "bg-primary/10 text-brand-text" : "text-foreground"}`}
            >
              <span>{month.title}</span>
              <span className="text-muted-foreground">{month.phaseLabel}</span>
            </a>
          </li>
        ))}
      </ul>
    </SelectMenu>
  );
}
