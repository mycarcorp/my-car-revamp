// Lead-source reporting from saved website lead records, with filters and explicit metric definitions.
//
// Counts are WORKABLE leads (usable contact, not a repeat; see marketing-lead-goal.ts), grouped by the first or last
// touch saved on the lead. Appointments here are appointment REQUESTS. A confirmed appointment or a sale is reported
// only when a caller supplies lead IDs that are actually linked to one; it is never inferred from a request or a status.
import { classifyLeads, localDateKey, DEALERSHIP_TIMEZONE, type GoalLead } from "./marketing-lead-goal";

export type TouchKind = "first" | "last";

export type ReportFilters = {
  /** Local dates (YYYY-MM-DD), inclusive. */
  from: string | null;
  to: string | null;
  channel: string | null;
  source: string | null;
  campaign: string | null;
  touch: TouchKind;
};

export const EMPTY_FILTERS: ReportFilters = { from: null, to: null, channel: null, source: null, campaign: null, touch: "last" };

const CHANNEL_NAMES: Record<string, string> = {
  organic_search: "Organic search",
  paid_search: "Paid search",
  organic_social: "Organic social",
  paid_social: "Paid social",
  social: "Social",
  ai_assistant: "AI assistants",
  email: "Email",
  referral: "Referral websites",
  direct: "Direct",
  unknown: "Unknown",
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export const NOT_TRACKED = "Not tracked";

/** Channel, source and campaign of one touch. Leads saved before attribution existed return "Not tracked". */
export function touchOf(details: Record<string, unknown> | null | undefined, touch: TouchKind) {
  const d = details ?? {};
  const prefix = touch === "first" ? "first_touch_" : "last_touch_";
  const channelKey = text(d[`${prefix}channel`]) || (touch === "last" ? text(d["channel"]) : "");
  const source = text(d[`${prefix}source`]) || (touch === "last" ? text(d["lead_source"]) : "");
  const campaign = text(d[`${prefix}utm_campaign`]) || (touch === "last" ? text(d["utm_campaign"]) : "");
  return {
    channel: CHANNEL_NAMES[channelKey.toLowerCase()] ?? NOT_TRACKED,
    source: source || NOT_TRACKED,
    campaign: campaign || NOT_TRACKED,
  };
}

export type Count = { label: string; count: number };

export type ChannelReport = {
  filters: ReportFilters;
  timezone: string;
  /** Records in the filters, before removing repeats and unusable ones. */
  records: number;
  /** Workable leads in the filters. */
  leads: number;
  duplicates: number;
  invalid: number;
  byChannel: Count[];
  bySource: Count[];
  byCampaign: Count[];
  byInquiry: Count[];
  appointmentRequests: number;
  /** Appointment requests divided by workable leads, or null when there are no leads. */
  appointmentRequestRate: number | null;
  confirmedAppointments: { status: "available"; count: number } | { status: "unavailable"; reason: string };
  confirmedSales: { status: "available"; count: number } | { status: "unavailable"; reason: string };
  confirmedAppointmentRate: number | null;
  confirmedSaleRate: number | null;
  qualified: { status: "unavailable"; reason: string };
  options: { channels: string[]; sources: string[]; campaigns: string[] };
};

const tally = (values: string[]): Count[] => {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
};

const rate = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null);

export const OUTCOME_UNAVAILABLE = "No lead-level link to a confirmed record was supplied, so none is counted.";

export function buildChannelReport(
  leads: GoalLead[],
  filters: ReportFilters = EMPTY_FILTERS,
  options: {
    timeZone?: string;
    /** IDs of leads linked to a confirmed appointment / completed purchase. Omit when no real link is available. */
    confirmedAppointmentLeadIds?: ReadonlySet<string> | null;
    completedPurchaseLeadIds?: ReadonlySet<string> | null;
  } = {},
): ChannelReport {
  const timeZone = options.timeZone ?? DEALERSHIP_TIMEZONE;
  const byId = new Map<string, GoalLead>();
  leads.forEach((lead, i) => byId.set(String(lead.id ?? `row-${i}`), lead));
  const classified = classifyLeads(leads, timeZone);

  const inDates = classified.filter((c) => (!filters.from || c.localDate >= filters.from) && (!filters.to || c.localDate <= filters.to));
  const optionSets = { channels: new Set<string>(), sources: new Set<string>(), campaigns: new Set<string>() };
  const matching = inDates.filter((c) => {
    const t = touchOf(byId.get(c.id)?.details, filters.touch);
    optionSets.channels.add(t.channel);
    optionSets.sources.add(t.source);
    optionSets.campaigns.add(t.campaign);
    return (!filters.channel || t.channel === filters.channel) && (!filters.source || t.source === filters.source) && (!filters.campaign || t.campaign === filters.campaign);
  });

  const workable = matching.filter((c) => c.category === "workable");
  const touches = workable.map((c) => touchOf(byId.get(c.id)?.details, filters.touch));
  const appointmentRequests = workable.filter((c) => c.inquiryType === "Appointment request");
  const workableIds = new Set(workable.map((c) => c.id));

  const link = (ids: ReadonlySet<string> | null | undefined) =>
    ids ? ({ status: "available", count: [...ids].filter((id) => workableIds.has(id)).length } as const) : ({ status: "unavailable", reason: OUTCOME_UNAVAILABLE } as const);
  const confirmedAppointments = link(options.confirmedAppointmentLeadIds);
  const confirmedSales = link(options.completedPurchaseLeadIds);

  return {
    filters,
    timezone: timeZone,
    records: matching.length,
    leads: workable.length,
    duplicates: matching.filter((c) => c.category === "duplicate").length,
    invalid: matching.filter((c) => c.category === "invalid").length,
    byChannel: tally(touches.map((t) => t.channel)),
    bySource: tally(touches.map((t) => t.source)),
    byCampaign: tally(touches.map((t) => t.campaign)),
    byInquiry: tally(workable.map((c) => c.inquiryType)),
    appointmentRequests: appointmentRequests.length,
    appointmentRequestRate: rate(appointmentRequests.length, workable.length),
    confirmedAppointments,
    confirmedSales,
    confirmedAppointmentRate: confirmedAppointments.status === "available" ? rate(confirmedAppointments.count, workable.length) : null,
    confirmedSaleRate: confirmedSales.status === "available" ? rate(confirmedSales.count, workable.length) : null,
    qualified: { status: "unavailable", reason: "Qualification criteria have not been approved, so no lead is counted as qualified." },
    options: { channels: [...optionSets.channels].sort(), sources: [...optionSets.sources].sort(), campaigns: [...optionSets.campaigns].sort() },
  };
}

/** Date-range presets in local days, ending today. */
export function presetRange(days: number, now: number = Date.now(), timeZone: string = DEALERSHIP_TIMEZONE): { from: string; to: string } {
  const to = localDateKey(now, timeZone);
  const [y, m, d] = to.split("-").map(Number) as [number, number, number];
  const from = new Date(Date.UTC(y, m - 1, d - (days - 1))).toISOString().slice(0, 10);
  return { from, to };
}

export const METRIC_DEFINITIONS: Array<{ name: string; meaning: string }> = [
  { name: "Leads", meaning: "Saved website inquiries with a usable email or phone, excluding repeats of the same person's same inquiry type within 24 hours." },
  { name: "First touch / Last touch", meaning: "The source recorded when the visitor first arrived, or on the visit that led to the inquiry. Saved with consent rules in place; older leads may have none." },
  { name: "Appointment requests", meaning: "Leads submitted through the schedule form. A request is not a confirmed appointment." },
  { name: "Confirmed appointments and sales", meaning: "Counted only from records actually linked to the lead. Never inferred from a request or a lead status." },
  { name: "Qualified leads", meaning: "Not reported until management approves qualification criteria." },
  { name: "Conversion rate", meaning: "Appointment requests (or linked confirmed records) divided by leads in the same filters. Shown only when the denominator is above zero." },
];
