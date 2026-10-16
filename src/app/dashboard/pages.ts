import type { ContractTermsRow } from "@/data";
import { partnerLabel } from "@/feed";
import { formatUtcTimestamp } from "./copy";
import { SERVICES, type PartnerId } from "@/registry";
import { emptyContractForm, formStateFromTerms, type ContractFile, type ContractFormState } from "@/terms";
import { buildAlertsView, type AlertsView } from "./alerts-view";
import { alertsBadge, healthBadge } from "./badges";
import type { Frame, Workspace } from "./load";
import { unusableRows, type BacktestPanel, type HealthView, type UnusableRowView } from "./model";
import { buildNav, withWindow, type NavActive, type NavModel } from "./nav";
import { buildOverview, type OverviewView } from "./overview";
import { buildPartnerPage, type PartnerPageView } from "./partner-page";

/**
 * The page envelopes the mini-app renders, one per screen. Every label, href
 * and builder stays here with the registry and the copy; the frontend only
 * draws what it receives. Pure: a Workspace in, JSON-safe data out, and the
 * tests assert the round trip through JSON.stringify leaves nothing behind.
 */

export type Breadcrumb = { label: string; href?: string };
export type PageFrame = Frame & { view: { active: "technical" | "business" } };
export type PageEnvelope<T> = {
  frame: PageFrame;
  nav: NavModel;
  breadcrumb: Breadcrumb[];
  /** False on screens that are not windowed; the month picker is then hidden. */
  showWindow: boolean;
  view: T;
};
export type PartnerEnvelope = PageEnvelope<PartnerPageView> & { backtest: BacktestPanel | null };
export type HealthPageView = { health: HealthView | { status: "error" }; unusable: UnusableRowView[] | null };
export type TermsRowView = {
  lifecycle: string;
  version: number;
  updatedBy: string;
  /** ISO-8601. */
  updatedAt: string;
  /** `updatedAt` as the UI prints it. */
  updatedAtLabel: string;
  terms: ContractFile;
};
export type TermsPageView = {
  partner: string;
  partnerName: string;
  row: TermsRowView | null;
  /** The form's starting state: the stored terms, or an empty form when none are saved. */
  initial: ContractFormState;
  services: { id: string; displayName: string }[];
};

function envelope<T>(workspace: Workspace, active: NavActive, breadcrumb: Breadcrumb[], showWindow: boolean, view: T): PageEnvelope<T> {
  const nav = buildNav({
    windowKey: workspace.frame.windowKey,
    role: workspace.role,
    partners: workspace.partners,
    alerts: alertsBadge(workspace.alerts, workspace.frame.windowKey),
    health: healthBadge(workspace.health),
    active,
  });
  return { frame: { ...workspace.frame, view: workspace.view }, nav, breadcrumb, showWindow, view };
}

export function overviewPage(workspace: Workspace): PageEnvelope<OverviewView> {
  const view = buildOverview({
    partners: workspace.partners,
    phase: workspace.frame.phase,
    windowKey: workspace.frame.windowKey,
    failure: workspace.failure,
  });
  return envelope(workspace, { kind: "overview" }, [{ label: "Overview" }], true, view);
}

/** Null when the slug is not a partner the workspace knows; the route answers 404. */
export function partnerPage(workspace: Workspace, id: string): PartnerEnvelope | null {
  const partner = workspace.partners.find((entry) => entry.id === id);
  if (partner === undefined) {
    return null;
  }
  const view = buildPartnerPage({
    partner,
    phase: workspace.frame.phase,
    windowKey: workspace.frame.windowKey,
    failure: workspace.failure,
    role: workspace.role,
  });
  const breadcrumb: Breadcrumb[] = [{ label: "← Overview", href: withWindow("/", workspace.frame.windowKey) }, { label: partner.name }];
  const backtest = workspace.backtest !== null && workspace.backtest.partner === id ? workspace.backtest.panel : null;
  return { ...envelope(workspace, { kind: "partner", id }, breadcrumb, true, view), backtest };
}

/**
 * Null for the business role, which has no alerts page. `requested` is the raw
 * window parameter: "all" lists every month, anything else the workspace window.
 */
export function alertsPage(workspace: Workspace, requested: string | undefined): PageEnvelope<AlertsView> | null {
  if (workspace.role === "business") {
    return null;
  }
  const filterKey = requested === "all" ? "all" : workspace.frame.windowKey;
  const view = buildAlertsView({
    alerts: workspace.alerts ?? { status: "error" },
    filterKey,
    months: workspace.frame.months,
    partners: workspace.partners,
  });
  return envelope(workspace, { kind: "alerts" }, [{ label: "Alerts" }], true, view);
}

/** Null for the business role, which has no health page. */
export function healthPage(workspace: Workspace): PageEnvelope<HealthPageView> | null {
  if (workspace.role === "business") {
    return null;
  }
  const view: HealthPageView = {
    health: workspace.health ?? { status: "error" },
    unusable: workspace.unusable === null ? null : unusableRows(workspace.unusable),
  };
  return envelope(workspace, { kind: "health" }, [{ label: "Health" }], false, view);
}

const serviceOptions = [...SERVICES]
  .map((service) => ({ id: service.id, displayName: service.displayName }))
  .sort((left, right) => left.displayName.localeCompare(right.displayName));

/** Null for the business role, which has no terms page. */
export function termsPage(workspace: Workspace, partner: PartnerId, row: ContractTermsRow | null): PageEnvelope<TermsPageView> | null {
  if (workspace.role === "business") {
    return null;
  }
  const name = partnerLabel(partner);
  const breadcrumb: Breadcrumb[] = [
    { label: "Overview", href: withWindow("/", workspace.frame.windowKey) },
    { label: name, href: withWindow(`/partners/${partner}`, workspace.frame.windowKey) },
    { label: "Contract terms" },
  ];
  const view: TermsPageView = {
    partner,
    partnerName: name,
    row:
      row === null
        ? null
        : {
            lifecycle: row.lifecycle,
            version: row.version,
            updatedBy: row.updatedBy,
            updatedAt: row.updatedAt.toISOString(),
            updatedAtLabel: formatUtcTimestamp(row.updatedAt.toISOString()),
            terms: row.terms,
          },
    initial: row === null ? emptyContractForm() : formStateFromTerms(row.terms, row.version),
    services: serviceOptions,
  };
  return envelope(workspace, { kind: "partner", id: partner }, breadcrumb, false, view);
}
