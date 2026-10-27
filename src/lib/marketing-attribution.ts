export type AttributionEvidence = "confirmed" | "inferred" | "unknown";
export type AttributionRangeInput =
  | { preset: 7 | 30 | 90 }
  | { preset: "custom"; startDate: string; endDate: string };

export type ResolvedAttributionRange = {
  startDate: string;
  endDate: string;
  startInclusive: string;
  endExclusive: string;
};

export type AttributionCount = { label: string; count: number };
export type AttributionSourceCount = AttributionCount & {
  source: string;
  evidence: AttributionEvidence;
  rawUtmSources: AttributionCount[];
  rawUtmMediums: AttributionCount[];
  rawUtmCampaigns: AttributionCount[];
};
export type AttributionTouchSummary = {
  missing: number;
  bySource: Array<AttributionCount & { source: string; evidence: AttributionEvidence }>;
  byMedium: AttributionCount[];
  byCampaign: AttributionCount[];
};
export type LeadAttributionReport = {
  startDate: string;
  endDate: string;
  generatedAt: string;
  timezone: "UTC";
  scanned: number;
  total: number | null;
  complete: boolean;
  bySource: AttributionSourceCount[];
  byMedium: Array<{ medium: string; count: number }>;
  byCampaign: Array<{ campaign: string; count: number }>;
  byLeadType: Array<{ leadType: string; count: number }>;
  byIntent: Array<{ intent: string; count: number }>;
  byRequestKind: Array<{ requestKind: string; count: number }>;
  firstTouch: AttributionTouchSummary;
  lastTouch: AttributionTouchSummary;
  daily: Array<{ date: string; count: number }>;
  outcomes: LeadOutcomeReport;
};

export type AttributionLeadRow = {
  id?: string;
  lead_type?: string | null;
  details?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type OutcomeSourceCount = AttributionCount & {
  source: string;
  evidence: AttributionEvidence;
};

export type OutcomeBreakdown = {
  status: "available" | "unavailable";
  message: string | null;
  count: number | null;
  scanned: number;
  complete: boolean;
  missingRelationship: number | null;
  unknownAttribution: number;
  byFirstTouchSource: OutcomeSourceCount[];
  byLastTouchSource: OutcomeSourceCount[];
};

export type LeadOutcomeReport = {
  periodBasis: "lead_created_at";
  appointmentRequests: {
    count: number | null;
    status: "available" | "unavailable";
    scanned: number;
    complete: boolean;
    byFirstTouchSource: OutcomeSourceCount[];
    byLastTouchSource: OutcomeSourceCount[];
  };
  appointmentRequestsWithoutRecord: { count: number | null; status: "available" | "unavailable" };
  confirmedAppointments: OutcomeBreakdown;
  completedPurchases: OutcomeBreakdown & { unlinkedCompleted: number | null; unlinkedStatus: "available" | "unavailable" };
};

export const MAX_ATTRIBUTION_DAYS = 366;
export const MAX_ATTRIBUTION_ROWS = 10000;
export const ATTRIBUTION_PAGE_SIZE = 1000;

export function filterLeadsByCreatedRange<T extends AttributionLeadRow>(
  rows: T[],
  range: Pick<ResolvedAttributionRange, "startInclusive" | "endExclusive">,
): T[] {
  const start = Date.parse(range.startInclusive);
  const end = Date.parse(range.endExclusive);
  return rows.filter((row) => {
    const created = row.created_at ? Date.parse(row.created_at) : NaN;
    return Number.isFinite(created) && created >= start && created < end;
  });
}

function sourceOf(details: Record<string, unknown>, prefix: "first_touch" | "last_touch"): OutcomeSourceCount {
  const raw = prefix === "last_touch"
    ? valueOf(details["last_touch_source"], valueOf(details["lead_source"], ""))
    : valueOf(details["first_touch_source"], "");
  const source = normalizedSource(raw);
  const storedEvidence = details[`${prefix}_source_evidence`] ?? (prefix === "last_touch" ? details["source_evidence"] : undefined);
  const evidence = evidenceOf(storedEvidence, Boolean(raw));
  return { label: `${source} · ${evidence}`, source, evidence, count: 1 };
}

function countOutcomeSources(rows: OutcomeSourceCount[]): OutcomeSourceCount[] {
  const counts = new Map<string, OutcomeSourceCount>();
  for (const row of rows) {
    const key = `${row.source}\u0000${row.evidence}`;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { ...row });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.source.localeCompare(b.source) || a.evidence.localeCompare(b.evidence));
}

export function aggregateLeadOutcomes(input: {
  leads: AttributionLeadRow[];
  appointmentRequestsTotal: number | null;
  appointmentRequestsAvailable: boolean;
  appointmentRequestsComplete: boolean;
  appointments: Array<{ id: string; lead_id: string | null; confirmed: boolean }> | null;
  confirmedAppointmentMissingRelationship: number | null;
  appointmentsComplete: boolean;
  purchases: Array<{ id: string | number; lead_id: string | null; status: string }> | null;
  unlinkedCompletedPurchases: number | null;
  completedPurchaseMissingRelationship: number | null;
  purchasesComplete: boolean;
  leadCohortComplete: boolean;
}): LeadOutcomeReport {
  const leadsById = new Map<string, AttributionLeadRow>();
  const appointmentRequests: AttributionLeadRow[] = [];
  for (const lead of input.leads) {
    if (lead.id) leadsById.set(lead.id, lead);
    if (lead.lead_type === "appointment") appointmentRequests.push(lead);
  }
  const requestSource = (prefix: "first_touch" | "last_touch") =>
    countOutcomeSources(appointmentRequests.map((lead) => sourceOf(lead.details ?? {}, prefix)));
  const appointmentsUnavailable = input.appointments === null;
  const requestLeadIds = new Set(appointmentRequests.map((lead) => lead.id).filter((id): id is string => Boolean(id)));
  const appointmentLeadIds = new Set((input.appointments ?? []).map((appointment) => appointment.lead_id).filter((id): id is string => Boolean(id)));
  const requestsWithoutRecord = [...requestLeadIds].filter((id) => !appointmentLeadIds.has(id)).length;
  const confirmedAppointments = new Map<string, AttributionLeadRow>();
  let invalidAppointmentRelationships = 0;
  for (const appointment of input.appointments ?? []) {
    if (!appointment.confirmed) continue;
    const lead = appointment.lead_id ? leadsById.get(appointment.lead_id) : undefined;
    if (!lead || lead.lead_type !== "appointment") {
      invalidAppointmentRelationships += 1;
      continue;
    }
    confirmedAppointments.set(appointment.id, lead);
  }
  const purchasesUnavailable = input.purchases === null;
  const completedPurchases = new Map<string, AttributionLeadRow>();
  let invalidPurchaseRelationships = 0;
  for (const purchase of input.purchases ?? []) {
    if (purchase.status !== "completed") continue;
    const lead = purchase.lead_id ? leadsById.get(purchase.lead_id) : undefined;
    const isPurchaseLead = lead?.lead_type === "purchase" ||
      (lead?.lead_type === "availability" && lead.details?.["request_kind"] === "purchase");
    if (!lead || !isPurchaseLead) {
      invalidPurchaseRelationships += 1;
      continue;
    }
    completedPurchases.set(String(purchase.id), lead);
  }
  const outcome = (
    items: Map<string, AttributionLeadRow>,
    unavailable: boolean,
    count: number | null = null,
    missingRelationship: number | null = 0,
  ): OutcomeBreakdown => {
    const rows = [...items.values()];
    const first = rows.map((lead) => sourceOf(lead.details ?? {}, "first_touch"));
    const last = rows.map((lead) => sourceOf(lead.details ?? {}, "last_touch"));
    const unknownAttribution = rows.filter((lead) => {
      const details = lead.details ?? {};
      const firstSource = valueOf(details["first_touch_source"], "");
      const lastSource = valueOf(details["last_touch_source"], valueOf(details["lead_source"], ""));
      const firstEvidence = evidenceOf(details["first_touch_source_evidence"], Boolean(firstSource));
      const lastEvidence = evidenceOf(details["last_touch_source_evidence"] ?? details["source_evidence"], Boolean(lastSource));
      return (!firstSource || firstEvidence === "unknown") && (!lastSource || lastEvidence === "unknown");
    }).length;
    return {
      status: unavailable ? "unavailable" : "available",
      message: unavailable ? "Outcome records are unavailable; no count is inferred." : null,
      count: unavailable || !input.leadCohortComplete || (items === confirmedAppointments ? !input.appointmentsComplete : !input.purchasesComplete)
        ? null
        : (count ?? rows.length),
      scanned: unavailable ? 0 : rows.length,
      complete: !unavailable && input.leadCohortComplete && (items === confirmedAppointments ? input.appointmentsComplete : input.purchasesComplete),
      missingRelationship: unavailable ? null : missingRelationship,
      unknownAttribution: unavailable ? 0 : unknownAttribution,
      byFirstTouchSource: unavailable ? [] : countOutcomeSources(first),
      byLastTouchSource: unavailable ? [] : countOutcomeSources(last),
    };
  };
  const requestUnavailable = !input.appointmentRequestsAvailable;
  return {
    periodBasis: "lead_created_at",
    appointmentRequests: {
      count: requestUnavailable ? null : input.appointmentRequestsTotal,
      status: requestUnavailable ? "unavailable" : "available",
      scanned: appointmentRequests.length,
      complete: !requestUnavailable && input.appointmentRequestsComplete,
      byFirstTouchSource: requestUnavailable ? [] : requestSource("first_touch"),
      byLastTouchSource: requestUnavailable ? [] : requestSource("last_touch"),
    },
    appointmentRequestsWithoutRecord: {
      count: appointmentsUnavailable || !input.leadCohortComplete || !input.appointmentsComplete ? null : requestsWithoutRecord,
      status: appointmentsUnavailable ? "unavailable" : "available",
    },
    confirmedAppointments: outcome(
      confirmedAppointments,
      appointmentsUnavailable,
      null,
      input.confirmedAppointmentMissingRelationship === null
        ? null
        : input.confirmedAppointmentMissingRelationship + invalidAppointmentRelationships,
    ),
    completedPurchases: {
      ...outcome(
        completedPurchases,
        purchasesUnavailable,
        null,
        input.completedPurchaseMissingRelationship === null
          ? null
          : invalidPurchaseRelationships + input.completedPurchaseMissingRelationship,
      ),
      unlinkedCompleted: purchasesUnavailable ? null : input.unlinkedCompletedPurchases,
      unlinkedStatus: purchasesUnavailable ? "unavailable" : "available",
    },
  };
}

function parseUtcDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10) === value ? date : null;
}

export function resolveAttributionRange(
  input: AttributionRangeInput,
  now = new Date(),
): ResolvedAttributionRange {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid reporting clock.");
  let startDate: string;
  let endDate: string;
  if (input.preset === "custom") {
    startDate = input.startDate;
    endDate = input.endDate;
  } else {
    const today = now.toISOString().slice(0, 10);
    const start = new Date(`${today}T00:00:00.000Z`);
    start.setUTCDate(start.getUTCDate() - (input.preset - 1));
    startDate = start.toISOString().slice(0, 10);
    endDate = today;
  }

  const start = parseUtcDate(startDate);
  const end = parseUtcDate(endDate);
  if (!start || !end) throw new Error("Choose valid start and end dates.");
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  if (end.getTime() > today.getTime()) throw new Error("End date cannot be in the future.");
  if (start.getTime() > end.getTime()) throw new Error("Start date must be on or before end date.");
  const inclusiveDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  if (inclusiveDays > MAX_ATTRIBUTION_DAYS) {
    throw new Error(`Date range cannot exceed ${MAX_ATTRIBUTION_DAYS} days.`);
  }
  const endExclusive = new Date(end.getTime() + 86400000);
  return {
    startDate,
    endDate,
    startInclusive: start.toISOString(),
    endExclusive: endExclusive.toISOString(),
  };
}

function valueOf(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizedSource(value: string): string {
  const source = value.trim().toLowerCase();
  const labels: Record<string, string> = {
    direct: "Direct Traffic",
    "direct traffic": "Direct Traffic",
    "google organic": "Google Organic",
    "google ads": "Google Ads",
    "microsoft ads": "Microsoft Ads",
    "bing organic": "Bing Organic",
    "yahoo organic": "Yahoo Organic",
    "duckduckgo organic": "DuckDuckGo Organic",
    "brave organic": "Brave Organic",
    "ecosia organic": "Ecosia Organic",
    chatgpt: "ChatGPT",
    perplexity: "Perplexity",
    gemini: "Gemini",
    copilot: "Copilot",
    claude: "Claude",
    "google vehicle ads": "Google Vehicle Ads",
    facebook: "Facebook",
    instagram: "Instagram",
    tiktok: "TikTok",
    linkedin: "LinkedIn",
    reddit: "Reddit",
    referral: "Referral Websites",
    referrals: "Referral Websites",
    "referral websites": "Referral Websites",
  };
  return labels[source] ?? (source ? "Other / Unknown" : "Unattributed");
}

function evidenceOf(value: unknown, hasSource: boolean): AttributionEvidence {
  if (value === "confirmed" || value === "inferred" || value === "unknown") return value;
  return hasSource ? "inferred" : "unknown";
}

function countLabels(values: string[]): AttributionCount[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function touchSummary(rows: AttributionLeadRow[], prefix: "first_touch" | "last_touch", last: boolean): AttributionTouchSummary {
  let missing = 0;
  const sources: Array<AttributionCount & { source: string; evidence: AttributionEvidence }> = [];
  const mediums: string[] = [];
  const campaigns: string[] = [];
  for (const row of rows) {
    const details = row.details ?? {};
    const sourceValue = details[`${prefix}_source`];
    const mediumValue = details[`${prefix}_medium`];
    const campaignValue = details[`${prefix}_utm_campaign`];
    const fallbackSource = last ? details["lead_source"] : undefined;
    const fallbackMedium = last ? details["lead_medium"] : undefined;
    const fallbackCampaign = last ? details["utm_campaign"] : undefined;
    const rawSource = valueOf(sourceValue, valueOf(fallbackSource, ""));
    if (!rawSource) {
      missing += 1;
      continue;
    }
    const source = normalizedSource(rawSource);
    const evidence = evidenceOf(
      details[`${prefix}_source_evidence`] ?? (last ? details["source_evidence"] : undefined),
      source !== "Unattributed",
    );
    sources.push({ label: source, source, count: 1, evidence });
    mediums.push(valueOf(mediumValue, valueOf(fallbackMedium, "Unattributed")));
    campaigns.push(valueOf(campaignValue, valueOf(fallbackCampaign, "Unattributed")));
  }
  const sourceCounts = new Map<string, { source: string; evidence: AttributionEvidence; count: number }>();
  for (const entry of sources) {
    const key = `${entry.source}\u0000${entry.evidence}`;
    const existing = sourceCounts.get(key);
    if (existing) existing.count += 1;
    else sourceCounts.set(key, { source: entry.source, count: 1, evidence: entry.evidence });
  }
  const bySource = [...sourceCounts.entries()]
    .map(([, item]) => ({ label: `${item.source} · ${item.evidence}`, ...item }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source) || a.evidence.localeCompare(b.evidence));
  return { missing, bySource, byMedium: countLabels(mediums), byCampaign: countLabels(campaigns) };
}

export function aggregateLeadAttribution(
  rows: AttributionLeadRow[],
  range: Pick<ResolvedAttributionRange, "startDate" | "endDate">,
  total: number | null,
  generatedAt = new Date().toISOString(),
  outcomes: LeadOutcomeReport = {
    periodBasis: "lead_created_at",
    appointmentRequests: { count: null, status: "unavailable", scanned: 0, complete: false, byFirstTouchSource: [], byLastTouchSource: [] },
    appointmentRequestsWithoutRecord: { count: null, status: "unavailable" },
    confirmedAppointments: { status: "unavailable", message: "Outcome data has not been loaded.", count: null, scanned: 0, complete: false, missingRelationship: 0, unknownAttribution: 0, byFirstTouchSource: [], byLastTouchSource: [] },
    completedPurchases: { status: "unavailable", message: "Outcome data has not been loaded.", count: null, scanned: 0, complete: false, missingRelationship: 0, unknownAttribution: 0, byFirstTouchSource: [], byLastTouchSource: [], unlinkedCompleted: null, unlinkedStatus: "unavailable" },
  },
): LeadAttributionReport {
  const sources = new Map<string, {
    source: string;
    count: number;
    evidence: AttributionEvidence;
    rawSources: string[];
    rawMediums: string[];
    rawCampaigns: string[];
  }>();
  const sourceValues: string[] = [];
  const mediums: string[] = [];
  const campaigns: string[] = [];
  const leadTypes: string[] = [];
  const intents: string[] = [];
  const requestKinds: string[] = [];
  const dailyCounts = new Map<string, number>();

  for (const row of rows) {
    const details = row.details ?? {};
    const rawSource = valueOf(details["last_touch_source"], valueOf(details["lead_source"], ""));
    const source = normalizedSource(rawSource);
    const evidence = evidenceOf(details["last_touch_source_evidence"] ?? details["source_evidence"], Boolean(rawSource));
    const sourceKey = `${source}\u0000${evidence}`;
    const rawUtmSource = valueOf(details["utm_source"], "Unattributed");
    const rawUtmMedium = valueOf(details["utm_medium"], "Unattributed");
    const rawUtmCampaign = valueOf(details["utm_campaign"], "Unattributed");
    const current = sources.get(sourceKey);
    if (current) {
      current.count += 1;
      current.rawSources.push(rawUtmSource);
      current.rawMediums.push(rawUtmMedium);
      current.rawCampaigns.push(rawUtmCampaign);
    } else {
      sources.set(sourceKey, {
        source,
        count: 1,
        evidence,
        rawSources: [rawUtmSource],
        rawMediums: [rawUtmMedium],
        rawCampaigns: [rawUtmCampaign],
      });
    }
    mediums.push(valueOf(details["last_touch_medium"], valueOf(details["lead_medium"], "Unattributed")));
    campaigns.push(valueOf(details["last_touch_utm_campaign"], valueOf(details["utm_campaign"], "Unattributed")));
    leadTypes.push(valueOf(row.lead_type, "Unknown"));
    intents.push(valueOf(details["intent"], "Unspecified"));
    requestKinds.push(valueOf(details["request_kind"], "Unspecified"));
    if (row.created_at) {
      const createdAt = new Date(row.created_at);
      if (Number.isFinite(createdAt.getTime())) {
        const day = createdAt.toISOString().slice(0, 10);
        dailyCounts.set(day, (dailyCounts.get(day) ?? 0) + 1);
      }
    }
  }

  const bySource = [...sources.entries()]
    .map(([, item]) => ({
      source: item.source,
      label: item.source,
      count: item.count,
      evidence: item.evidence,
      rawUtmSources: countLabels(item.rawSources),
      rawUtmMediums: countLabels(item.rawMediums),
      rawUtmCampaigns: countLabels(item.rawCampaigns),
    }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
  const firstTouch = touchSummary(rows, "first_touch", false);
  const lastTouch = touchSummary(rows, "last_touch", true);

  return {
    ...range,
    generatedAt,
    timezone: "UTC",
    scanned: rows.length,
    total,
    complete: total !== null && total <= rows.length,
    bySource,
    byMedium: countLabels(mediums).map(({ label: medium, count }) => ({ medium, count })),
    byCampaign: countLabels(campaigns).map(({ label: campaign, count }) => ({ campaign, count })),
    byLeadType: countLabels(leadTypes).map(({ label: leadType, count }) => ({ leadType, count })),
    byIntent: countLabels(intents).map(({ label: intent, count }) => ({ intent, count })),
    byRequestKind: countLabels(requestKinds).map(({ label: requestKind, count }) => ({ requestKind, count })),
    firstTouch,
    lastTouch,
    daily: [...dailyCounts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
    outcomes,
  };
}

function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildAttributionCsv(report: LeadAttributionReport): string {
  const header = [
    "range_start_utc", "range_end_utc_inclusive", "section", "touch", "source", "medium",
    "campaign", "evidence", "raw_utm_source", "lead_type", "intent", "request_kind", "date_utc", "count",
    "scanned_rows", "exact_total", "coverage", "generated_at_utc",
  ];
  const lines = [header.map(csvCell).join(",")];
  const add = (values: Record<string, unknown>) =>
    lines.push(header.map((column) => csvCell(values[column] ?? "")).join(","));
  const base = { range_start_utc: report.startDate, range_end_utc_inclusive: report.endDate };
  for (const row of report.bySource) {
    const rawValues = [
      ...row.rawUtmSources.map((raw) => ({ raw_utm_source: raw.label, count: raw.count })),
      ...row.rawUtmMediums.map((raw) => ({ medium: raw.label, count: raw.count })),
      ...row.rawUtmCampaigns.map((raw) => ({ campaign: raw.label, count: raw.count })),
    ];
    for (const raw of rawValues) add({ ...base, section: "source", touch: "latest", source: row.source, evidence: row.evidence, ...raw });
  }
  for (const touchName of ["first", "last"] as const) {
    const summary = touchName === "first" ? report.firstTouch : report.lastTouch;
    for (const row of summary.bySource) add({ ...base, section: "source", touch: touchName, source: row.source, evidence: row.evidence, count: row.count });
    for (const row of summary.byMedium) add({ ...base, section: "medium", touch: touchName, medium: row.label, count: row.count });
    for (const row of summary.byCampaign) add({ ...base, section: "campaign", touch: touchName, campaign: row.label, count: row.count });
  }
  for (const row of report.daily) add({ ...base, section: "daily", date_utc: row.date, count: row.count });
  for (const row of report.byLeadType) add({ ...base, section: "form", lead_type: row.leadType, count: row.count });
  for (const row of report.byIntent) add({ ...base, section: "intent", intent: row.intent, count: row.count });
  for (const row of report.byRequestKind) add({ ...base, section: "request_kind", request_kind: row.requestKind, count: row.count });
  const outcomes = report.outcomes;
  if (outcomes.appointmentRequests.status === "available") {
    add({ ...base, section: "appointment_request", touch: "first", count: outcomes.appointmentRequests.count });
    add({ ...base, section: "appointment_request_without_record", count: outcomes.appointmentRequestsWithoutRecord.count });
    add({ ...base, section: "appointment_request_coverage", coverage: outcomes.appointmentRequests.complete ? "complete" : "partial", count: outcomes.appointmentRequests.scanned });
    for (const row of outcomes.appointmentRequests.byFirstTouchSource) add({ ...base, section: "appointment_request_source", touch: "first", source: row.source, evidence: row.evidence, count: row.count });
    for (const row of outcomes.appointmentRequests.byLastTouchSource) add({ ...base, section: "appointment_request_source", touch: "last", source: row.source, evidence: row.evidence, count: row.count });
  }
  for (const [section, outcome] of [
    ["confirmed_appointment", outcomes.confirmedAppointments],
    ["completed_purchase", outcomes.completedPurchases],
  ] as const) {
    if (outcome.status !== "available") continue;
    add({ ...base, section, count: outcome.count });
    add({ ...base, section: `${section}_coverage`, coverage: outcome.complete ? "complete" : "partial", count: outcome.scanned });
    add({ ...base, section: `${section}_unattributed`, evidence: "unknown", count: outcome.unknownAttribution });
    add({ ...base, section: `${section}_missing_relationship`, count: outcome.missingRelationship });
    for (const [touch, rows] of [["first", outcome.byFirstTouchSource], ["last", outcome.byLastTouchSource]] as const) {
      for (const row of rows) add({ ...base, section: `${section}_source`, touch, source: row.source, evidence: row.evidence, count: row.count });
    }
  }
  if (outcomes.completedPurchases.unlinkedStatus === "available") {
    add({ ...base, section: "completed_purchase_unlinked", count: outcomes.completedPurchases.unlinkedCompleted });
  }
  add({
    ...base,
    section: "coverage",
    scanned_rows: report.scanned,
    exact_total: report.total ?? "unavailable",
    coverage: report.complete ? "complete" : "partial",
    generated_at_utc: report.generatedAt,
  });
  return lines.join("\r\n");
}