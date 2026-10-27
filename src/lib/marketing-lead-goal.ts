// Daily lead-goal reporting from the saved website lead records (the `leads` table).
//
// Definitions (documented so the numbers can be audited):
//   total      every saved record in the period
//   invalid    no usable way to contact the person (no valid email AND no valid phone). Nothing else is called spam:
//              there is no verified spam signal in the data, and content is never judged here.
//   duplicate  a later record from the same person (same normalized email or phone) with the same inquiry type
//              within DUPLICATE_WINDOW_HOURS of the first record that was counted. The first record is kept.
//   workable   total minus invalid minus duplicate: usable contact details and not a repeat
//   qualified  UNAVAILABLE. Management has not approved qualification criteria and the lead table has no qualified
//              status, so no record is ever counted as qualified here. `staffEngaged` (status contacted, working or
//              won) is reported separately and is staff progress, not qualification.
//
// Daily boundaries use the dealership-local timezone, not UTC.

export const DEALERSHIP_TIMEZONE = "America/New_York";
export const DAILY_GOAL = { min: 6, max: 10 } as const;
export const DUPLICATE_WINDOW_HOURS = 24;

export type GoalLead = {
  id?: string | null;
  lead_type?: string | null;
  status?: string | null;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;
  details?: Record<string, unknown> | null;
};

export type LeadCategory = "workable" | "duplicate" | "invalid";

export type ClassifiedLead = {
  id: string;
  localDate: string;
  createdMs: number;
  category: LeadCategory;
  channel: string;
  inquiryType: string;
  staffEngaged: boolean;
};

/** Local calendar date (YYYY-MM-DD) of an instant in the dealership timezone. */
export function localDateKey(ms: number, timeZone: string = DEALERSHIP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

export function normalizeEmail(value: unknown): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : "";
}

export function normalizePhone(value: unknown): string {
  const digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return national.length === 10 ? national : "";
}

const CHANNEL_LABELS: Record<string, string> = {
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

/** Channel of the lead's last touch when recorded; leads saved before channels existed are "Not tracked". */
export function leadChannelLabel(details: Record<string, unknown> | null | undefined): string {
  const d = details ?? {};
  const raw = d["channel"] ?? d["last_touch_channel"];
  const key = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return CHANNEL_LABELS[key] ?? "Not tracked";
}

export function inquiryTypeLabel(lead: Pick<GoalLead, "lead_type" | "details">): string {
  const details = lead.details ?? {};
  if (lead.lead_type === "contact") return details["request_type"] === "car_finder" ? "Car Finder" : "Contact";
  if (lead.lead_type === "trade") return typeof details["intent"] === "string" && /sell/i.test(details["intent"]) ? "Sell" : "Trade";
  const labels: Record<string, string> = { finance: "Financing", appointment: "Appointment request", availability: "Availability" };
  return labels[lead.lead_type ?? ""] ?? "Other";
}

/**
 * Classifies records oldest-first so the earliest record of a repeat is the one kept. Records without a readable
 * creation time are left out (they cannot be placed on a day).
 */
export function classifyLeads(leads: GoalLead[], timeZone: string = DEALERSHIP_TIMEZONE): ClassifiedLead[] {
  const dated = leads
    .map((lead, index) => ({ lead, index, ms: Date.parse(lead.created_at ?? "") }))
    .filter((row) => Number.isFinite(row.ms))
    .sort((a, b) => a.ms - b.ms || a.index - b.index);

  const windowMs = DUPLICATE_WINDOW_HOURS * 3600_000;
  const lastKept = new Map<string, number>();
  const out: ClassifiedLead[] = [];

  for (const { lead, index, ms } of dated) {
    const email = normalizeEmail(lead.email);
    const phone = normalizePhone(lead.phone);
    const inquiryType = inquiryTypeLabel(lead);
    let category: LeadCategory = "workable";

    if (!email && !phone) {
      category = "invalid";
    } else {
      const keys = [email && `e:${email}|${inquiryType}`, phone && `p:${phone}|${inquiryType}`].filter(Boolean) as string[];
      if (keys.some((key) => ms - (lastKept.get(key) ?? -Infinity) < windowMs)) {
        category = "duplicate";
      } else {
        for (const key of keys) lastKept.set(key, ms);
      }
    }

    out.push({
      id: String(lead.id ?? `row-${index}`),
      localDate: localDateKey(ms, timeZone),
      createdMs: ms,
      category,
      channel: leadChannelLabel(lead.details),
      inquiryType,
      staffEngaged: ["contacted", "working", "won"].includes(String(lead.status ?? "")),
    });
  }

  return out;
}

export type GoalProgress = "below" | "within" | "above";

export function goalProgress(workable: number): GoalProgress {
  return workable < DAILY_GOAL.min ? "below" : workable <= DAILY_GOAL.max ? "within" : "above";
}

export type DailyRow = { date: string; total: number; workable: number; duplicate: number; invalid: number };
export type Count = { label: string; count: number };

export type LeadGoalReport = {
  timezone: string;
  today: string;
  windowStart: string;
  windowDays: number;
  /** True when the record limit was reached, so the oldest days of the window may be incomplete. */
  possiblyTruncated: boolean;
  total: number;
  today_: { total: number; workable: number; duplicate: number; invalid: number; staffEngaged: number };
  workableProgress: { workable: number; goalMin: number; goalMax: number; status: GoalProgress; percentOfMinimum: number };
  qualified: { status: "unavailable"; reason: string };
  appointmentRequests: number;
  bySource: Count[];
  byInquiry: Count[];
  daily: DailyRow[];
  weekly: Array<{ weekStart: string; total: number; workable: number }>;
  monthly: Array<{ month: string; total: number; workable: number }>;
  totals: { total: number; workable: number; duplicate: number; invalid: number; staffEngaged: number };
};

export const QUALIFIED_UNAVAILABLE_REASON =
  "Qualification criteria have not been approved by management and the lead table has no qualified status, so no lead is counted as qualified.";

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Monday of the week containing a local date. */
function weekStart(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(dateKey, -((weekday + 6) % 7));
}

const sortCounts = (map: Map<string, number>): Count[] =>
  [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

/**
 * Builds the report from saved lead records. `windowDays` days ending today (local) are shown day by day, with
 * zero-lead days included so the trend is honest. Nothing is estimated or filled in.
 */
export function buildLeadGoalReport(
  leads: GoalLead[],
  options: { now?: number; windowDays?: number; recordLimit?: number; timeZone?: string } = {},
): LeadGoalReport {
  const timeZone = options.timeZone ?? DEALERSHIP_TIMEZONE;
  const windowDays = options.windowDays ?? 30;
  const today = localDateKey(options.now ?? Date.now(), timeZone);
  const windowStart = addDays(today, -(windowDays - 1));
  const classified = classifyLeads(leads, timeZone).filter((lead) => lead.localDate >= windowStart && lead.localDate <= today);

  const dailyMap = new Map<string, DailyRow>();
  for (let i = 0; i < windowDays; i += 1) {
    const date = addDays(windowStart, i);
    dailyMap.set(date, { date, total: 0, workable: 0, duplicate: 0, invalid: 0 });
  }

  const bySource = new Map<string, number>();
  const byInquiry = new Map<string, number>();
  const weekly = new Map<string, { weekStart: string; total: number; workable: number }>();
  const monthly = new Map<string, { month: string; total: number; workable: number }>();
  const totals = { total: 0, workable: 0, duplicate: 0, invalid: 0, staffEngaged: 0 };
  const todayRow = { total: 0, workable: 0, duplicate: 0, invalid: 0, staffEngaged: 0 };
  let appointmentRequests = 0;

  for (const lead of classified) {
    const row = dailyMap.get(lead.localDate)!;
    row.total += 1;
    row[lead.category] += 1;
    totals.total += 1;
    totals[lead.category] += 1;
    if (lead.staffEngaged) totals.staffEngaged += 1;
    if (lead.localDate === today) {
      todayRow.total += 1;
      todayRow[lead.category] += 1;
      if (lead.staffEngaged) todayRow.staffEngaged += 1;
    }
    // Source and inquiry breakdowns count workable leads only, so repeats and unusable records do not inflate them.
    if (lead.category === "workable") {
      bySource.set(lead.channel, (bySource.get(lead.channel) ?? 0) + 1);
      byInquiry.set(lead.inquiryType, (byInquiry.get(lead.inquiryType) ?? 0) + 1);
      if (lead.inquiryType === "Appointment request") appointmentRequests += 1;
    }
    const ws = weekStart(lead.localDate);
    const w = weekly.get(ws) ?? { weekStart: ws, total: 0, workable: 0 };
    w.total += 1;
    if (lead.category === "workable") w.workable += 1;
    weekly.set(ws, w);
    const month = lead.localDate.slice(0, 7);
    const m = monthly.get(month) ?? { month, total: 0, workable: 0 };
    m.total += 1;
    if (lead.category === "workable") m.workable += 1;
    monthly.set(month, m);
  }

  const status = goalProgress(todayRow.workable);
  return {
    timezone: timeZone,
    today,
    windowStart,
    windowDays,
    possiblyTruncated: options.recordLimit != null && leads.length >= options.recordLimit,
    total: totals.total,
    today_: todayRow,
    workableProgress: {
      workable: todayRow.workable,
      goalMin: DAILY_GOAL.min,
      goalMax: DAILY_GOAL.max,
      status,
      percentOfMinimum: Math.min(100, Math.round((todayRow.workable / DAILY_GOAL.min) * 100)),
    },
    qualified: { status: "unavailable", reason: QUALIFIED_UNAVAILABLE_REASON },
    appointmentRequests,
    bySource: sortCounts(bySource),
    byInquiry: sortCounts(byInquiry),
    daily: [...dailyMap.values()],
    weekly: [...weekly.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    monthly: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)),
    totals,
  };
}

/** Conversion of workable leads into appointment requests, or null when there are no workable leads. */
export function appointmentRequestRate(report: Pick<LeadGoalReport, "appointmentRequests" | "totals">): number | null {
  return report.totals.workable > 0 ? report.appointmentRequests / report.totals.workable : null;
}

/** CSV cell with spreadsheet-formula protection. */
export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const EXPORT_COLUMNS = ["Received (local)", "Inquiry type", "Channel", "Category", "Name", "Email", "Phone", "Status"] as const;

/**
 * Business-lead export for authorized staff. Fields are limited to what follow-up needs; stored details, internal
 * notes, message text and delivery diagnostics are never exported.
 */
export function buildLeadExportCsv(
  leads: Array<GoalLead & { full_name?: string | null }>,
  options: { timeZone?: string } = {},
): string {
  const timeZone = options.timeZone ?? DEALERSHIP_TIMEZONE;
  const classified = new Map(classifyLeads(leads, timeZone).map((c) => [c.id, c]));
  const lines = [EXPORT_COLUMNS.map(csvCell).join(",")];
  leads.forEach((lead, index) => {
    const c = classified.get(String(lead.id ?? `row-${index}`));
    if (!c) return;
    const received = new Intl.DateTimeFormat("en-US", { timeZone, dateStyle: "short", timeStyle: "short" }).format(new Date(c.createdMs));
    lines.push(
      [received, c.inquiryType, c.channel, c.category, lead.full_name ?? "", lead.email ?? "", lead.phone ?? "", lead.status ?? "new"]
        .map(csvCell)
        .join(","),
    );
  });
  return lines.join("\r\n");
}

/* -------------------------------------------------------------------------- */
/* Channel performance: fixed channel rows from saved attribution counts       */
/* -------------------------------------------------------------------------- */

export const CHANNEL_ROWS = [
  { key: "google-organic", label: "Google Organic", connection: "Search Console and GA4 reports" },
  { key: "google-ads", label: "Google Ads", connection: "No API connection here; campaigns are paused" },
  { key: "facebook", label: "Facebook", connection: "No API connection here; Meta Pixel is in the site code" },
  { key: "instagram", label: "Instagram", connection: "No API connection here" },
  { key: "tiktok", label: "TikTok", connection: "No API connection here" },
  { key: "linkedin", label: "LinkedIn", connection: "No API connection here" },
  { key: "whatsapp", label: "WhatsApp", connection: "No API connection here" },
  { key: "direct", label: "Direct Website", connection: "GA4 report" },
  { key: "ai", label: "AI Referrals", connection: "Detected from the visitor's referrer or UTM source" },
  { key: "other", label: "Other", connection: "Everything else, including other search engines and referral sites" },
] as const;

const AI_SOURCES = new Set(["chatgpt", "perplexity", "gemini", "copilot", "claude"]);

/** Which fixed channel a saved source label belongs to. */
export function channelKeyForSource(source: string): (typeof CHANNEL_ROWS)[number]["key"] {
  const s = source.trim().toLowerCase();
  if (s === "google organic") return "google-organic";
  if (s === "google ads" || s === "google vehicle ads") return "google-ads";
  if (s === "facebook") return "facebook";
  if (s === "instagram") return "instagram";
  if (s === "tiktok") return "tiktok";
  if (s === "linkedin") return "linkedin";
  if (s === "whatsapp") return "whatsapp";
  if (s === "direct traffic" || s === "direct") return "direct";
  if (AI_SOURCES.has(s)) return "ai";
  return "other";
}

/** Totals per fixed channel from saved lead-source counts. A channel with no leads is 0, not hidden. */
export function groupChannelRows(sources: Array<{ source: string; count: number }>) {
  const totals = new Map<string, number>();
  for (const row of sources) {
    const key = channelKeyForSource(row.source);
    totals.set(key, (totals.get(key) ?? 0) + row.count);
  }
  return CHANNEL_ROWS.map((row) => ({ ...row, leads: totals.get(row.key) ?? 0 }));
}
