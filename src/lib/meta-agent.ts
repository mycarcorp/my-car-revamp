// Read-only analysis and non-executing action previews for a future Meta (Facebook/Instagram) marketing agent.
//
// Audit result: there is NO Meta agent and no Meta API connection in this repository. This module does not call Meta.
// It turns rows that an authorized, read-only Meta insights request would return into summaries, evidence-backed
// suggestions and previews of actions a human could approve later. It never builds or sends a write request.

export type MetaInsightRow = {
  campaignId: string;
  campaignName: string;
  /** Inclusive local dates of the reporting window. */
  start: string;
  end: string;
  currency: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
};

export type CampaignSummary = {
  campaignId: string;
  campaignName: string;
  window: string;
  currency: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  /** All derived values are null when the denominator is zero: nothing is estimated. */
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  costPerLead: number | null;
};

const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export function summarizeCampaign(row: MetaInsightRow): CampaignSummary {
  return {
    campaignId: row.campaignId,
    campaignName: row.campaignName,
    window: `${row.start} to ${row.end}`,
    currency: row.currency,
    spend: row.spend,
    impressions: row.impressions,
    clicks: row.clicks,
    leads: row.leads,
    ctr: div(row.clicks, row.impressions),
    cpc: div(row.spend, row.clicks),
    cpm: row.impressions > 0 ? (row.spend / row.impressions) * 1000 : null,
    costPerLead: div(row.spend, row.leads),
  };
}

export type AccountComparison =
  | { comparable: false; reason: string }
  | { comparable: true; window: string; currency: string; total: CampaignSummary; campaigns: CampaignSummary[] };

/** Campaigns are compared only when they share one window and one currency; otherwise the numbers are not comparable. */
export function compareCampaigns(rows: MetaInsightRow[]): AccountComparison {
  if (!rows.length) return { comparable: false, reason: "No campaign rows were returned." };
  const windows = new Set(rows.map((r) => `${r.start}|${r.end}`));
  const currencies = new Set(rows.map((r) => r.currency));
  if (windows.size > 1) return { comparable: false, reason: "Rows cover different date ranges, so they are not compared." };
  if (currencies.size > 1) return { comparable: false, reason: "Rows use different currencies, so they are not compared." };
  const campaigns = rows.map(summarizeCampaign);
  const sum = (key: "spend" | "impressions" | "clicks" | "leads") => rows.reduce((n, r) => n + r[key], 0);
  const total = summarizeCampaign({
    campaignId: "all",
    campaignName: "All campaigns",
    start: rows[0]!.start,
    end: rows[0]!.end,
    currency: rows[0]!.currency,
    spend: sum("spend"),
    impressions: sum("impressions"),
    clicks: sum("clicks"),
    leads: sum("leads"),
  });
  return { comparable: true, window: total.window, currency: total.currency, total, campaigns };
}

export type Suggestion = {
  id: string;
  kind: "creative" | "audience" | "budget" | "structure" | "tracking" | "review";
  title: string;
  /** The numbers or facts the suggestion is based on. A suggestion without evidence is never produced. */
  evidence: string;
  /** What a person should consider; never an instruction the agent carries out. */
  consider: string;
};

export const MIN_IMPRESSIONS_FOR_ADVICE = 1000;

/**
 * Evidence-backed suggestions. Comparisons are made only within the account's own campaigns for the same window, so no
 * outside benchmark is assumed. Campaigns with too little data are listed as needing more data, not judged.
 */
export function suggest(comparison: AccountComparison, options: { websiteLeadsFromMeta?: number | null } = {}): Suggestion[] {
  if (!comparison.comparable) return [];
  const out: Suggestion[] = [];
  const money = (n: number) => `${comparison.currency} ${n.toFixed(2)}`;
  const enough = comparison.campaigns.filter((c) => c.impressions >= MIN_IMPRESSIONS_FOR_ADVICE);

  for (const c of comparison.campaigns) {
    if (c.impressions < MIN_IMPRESSIONS_FOR_ADVICE) {
      out.push({ id: `data-${c.campaignId}`, kind: "review", title: `${c.campaignName}: not enough data yet`, evidence: `${c.impressions} impressions in ${comparison.window}.`, consider: "Wait for more delivery before judging this campaign." });
    }
  }

  const withCpl = enough.filter((c) => c.costPerLead !== null);
  if (withCpl.length >= 2) {
    const sorted = [...withCpl].sort((a, b) => a.costPerLead! - b.costPerLead!);
    const best = sorted[0]!;
    const worst = sorted[sorted.length - 1]!;
    if (worst.costPerLead! > best.costPerLead! * 1.5) {
      out.push({
        id: `cpl-${worst.campaignId}`,
        kind: "budget",
        title: `${worst.campaignName} costs more per lead than ${best.campaignName}`,
        evidence: `${money(worst.costPerLead!)} per lead versus ${money(best.costPerLead!)} in ${comparison.window}, on ${worst.leads} and ${best.leads} leads. Meta-reported leads, not appointments or sales.`,
        consider: "Review the creative and audience of the higher-cost campaign before moving budget. Lead quality is not shown by this number.",
      });
    }
  }

  for (const c of enough) {
    if (c.spend > 0 && c.leads === 0) {
      out.push({ id: `nolead-${c.campaignId}`, kind: "review", title: `${c.campaignName} spent money with no leads`, evidence: `${money(c.spend)} spent and ${c.clicks} clicks, 0 leads in ${comparison.window}.`, consider: "Check the lead form, landing page and tracking before changing the ad." });
    }
    if (c.clicks > 0 && c.ctr !== null && comparison.total.ctr !== null && c.ctr < comparison.total.ctr * 0.5) {
      out.push({ id: `ctr-${c.campaignId}`, kind: "creative", title: `${c.campaignName} has a low click-through rate`, evidence: `${(c.ctr * 100).toFixed(2)}% versus ${(comparison.total.ctr * 100).toFixed(2)}% for all campaigns in ${comparison.window}.`, consider: "Compare its creatives and audience with the better-performing campaign." });
    }
  }

  const metaLeads = comparison.total.leads;
  const websiteLeads = options.websiteLeadsFromMeta;
  if (websiteLeads != null && metaLeads !== websiteLeads) {
    out.push({
      id: "tracking-mismatch",
      kind: "tracking",
      title: "Meta and website lead counts differ",
      evidence: `Meta reports ${metaLeads} leads; the website saved ${websiteLeads} leads attributed to Facebook or Instagram. The two use different definitions and windows, so a difference can be normal.`,
      consider: "Check the Pixel and lead-form setup in Events Manager before relying on either number.",
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Approval-based actions: previews only                                       */
/* -------------------------------------------------------------------------- */

export type ProposedAction =
  | { type: "pause_campaign"; campaignId: string; campaignName: string }
  | { type: "resume_campaign"; campaignId: string; campaignName: string }
  | { type: "change_budget"; campaignId: string; campaignName: string; fromDaily: number; toDaily: number; currency: string }
  | { type: "edit_creative"; campaignId: string; campaignName: string; summary: string }
  | { type: "create_draft_campaign"; campaignName: string; objective: string }
  | { type: "publish_changes"; campaignId: string; campaignName: string };

export type ActionPreview = {
  /** Always false: this module cannot execute anything. */
  executes: false;
  requiresApproval: true;
  /** The exact change, in words, for the approver to confirm. */
  exactAction: string;
  requiredChecks: string[];
  recovery: string;
  /** What would have to be recorded in the audit log if a person approved and ran it. */
  auditRecord: { action: string; target: string; requestedAt: string; approvedBy: null; executedAt: null };
};

const COMMON_CHECKS = [
  "The approver is signed in with permission for this ad account",
  "The exact action above is confirmed by the approver, not the agent",
  "The current campaign state is read again immediately before acting",
  "The result is written to the audit log with who approved and when",
];

export function previewAction(action: ProposedAction, now: number = Date.now()): ActionPreview {
  const requestedAt = new Date(now).toISOString();
  const base = (exactAction: string, target: string, recovery: string, extra: string[] = []): ActionPreview => ({
    executes: false,
    requiresApproval: true,
    exactAction,
    requiredChecks: [...COMMON_CHECKS, ...extra],
    recovery,
    auditRecord: { action: action.type, target, requestedAt, approvedBy: null, executedAt: null },
  });

  switch (action.type) {
    case "pause_campaign":
      return base(`Pause the campaign "${action.campaignName}" (${action.campaignId}).`, action.campaignId, "Resume the campaign. Delivery restarts but may re-enter the learning phase.");
    case "resume_campaign":
      return base(`Resume the campaign "${action.campaignName}" (${action.campaignId}). This restarts spending at its current budget.`, action.campaignId, "Pause the campaign again. Money already spent is not refunded.", ["The current budget is confirmed by the approver before resuming"]);
    case "change_budget":
      return base(
        `Change the daily budget of "${action.campaignName}" from ${action.currency} ${action.fromDaily.toFixed(2)} to ${action.currency} ${action.toDaily.toFixed(2)}.`,
        action.campaignId,
        `Set the daily budget back to ${action.currency} ${action.fromDaily.toFixed(2)}.`,
        ["The new budget is within the monthly amount management approved"],
      );
    case "edit_creative":
      return base(`Edit the creative of "${action.campaignName}": ${action.summary}`, action.campaignId, "Restore the previous creative, which must be saved before editing.", ["The new copy contains no unverified approval, price, financing or condition claims"]);
    case "create_draft_campaign":
      return base(`Create a DRAFT campaign "${action.campaignName}" with objective ${action.objective}. It would not deliver or spend until separately published.`, "new draft", "Delete the draft.");
    case "publish_changes":
      return base(`Publish pending changes to "${action.campaignName}" (${action.campaignId}), which may start or change spending.`, action.campaignId, "Revert the changes or pause the campaign.", ["Management has approved the spend"]);
  }
}

/**
 * The only requests this application may ever send to Meta from the analysis agent: GET requests for insights and
 * campaign structure. Anything else is refused. This guard exists so a future connection cannot quietly gain write access.
 */
export function isReadOnlyMetaRequest(method: string, path: string): boolean {
  if (method.toUpperCase() !== "GET") return false;
  if (/[?&](method|access_token)=/i.test(path)) return false;
  return /^\/v\d+\.\d+\/(act_\d+\/(insights|campaigns|adsets|ads)|\d+\/(insights|adsets|ads|leads))(\?|$)/.test(path);
}
