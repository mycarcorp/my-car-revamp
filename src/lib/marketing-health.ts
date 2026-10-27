// Health states and funnel stages for the Marketing Funnel Monitor.
//
// A state is green only when a real check or real record proves the thing works recently. A saved credential, a
// configured flag or the absence of errors is never enough. Nothing here sends a request, retries a delivery or
// changes a setting: it only interprets reports and lead records that already exist.
import { getGhlDeliveryStatus } from "./ghl-delivery-status";
import type { IntegrationState } from "./marketing";

export type HealthState = "green" | "yellow" | "red" | "gray";

export const HEALTH_LABELS: Record<HealthState, string> = {
  green: "Healthy",
  yellow: "Warning",
  red: "Failure",
  gray: "Unknown",
};

export type HealthItem = {
  id: string;
  name: string;
  state: HealthState;
  reason: string;
  /** ISO time of the evidence the state is based on, or null when there is none. */
  verifiedAt: string | null;
  action: string;
  /** Marketing Hub tab to open, when one explains or fixes the item. */
  tab?: string;
  /** Internal route to open. */
  to?: string;
};

export const REPORT_FRESH_MS = 7 * 24 * 3600_000;
export const LEAD_RECENT_MS = 72 * 3600_000;
export const DELIVERY_WINDOW_MS = 7 * 24 * 3600_000;
export const FAILURE_WINDOW_MS = 24 * 3600_000;

type ReportInput = { state: IntegrationState; checkedAt: string | null; message?: string } | null | undefined;

export type HealthLead = {
  lead_type: string;
  created_at: string | null;
  details?: Record<string, unknown> | null;
};

export type HealthInput = {
  now: number;
  search: ReportInput;
  website: (ReportInput & { data?: { sitemap?: { status: number; urls: number }; metadata?: { status: number }; robots?: { status: number } } | null }) | null | undefined;
  /** Saved lead records, or null when they could not be loaded. */
  leads: HealthLead[] | null;
  ga4: { state: "ok" | "error" | "not_configured" | "unchecked"; checkedAt: string | null; message?: string };
  /** Whether the Meta Pixel ID is present in the site code. It says nothing about events actually arriving. */
  metaPixelConfigured: boolean;
};

const age = (iso: string | null | undefined, now: number): number | null => {
  const ms = Date.parse(iso ?? "");
  return Number.isFinite(ms) ? now - ms : null;
};

function reportItem(
  id: string,
  name: string,
  report: ReportInput,
  now: number,
  opts: { tab: string; notConnected: string; action: string },
): HealthItem {
  const base = { id, name, tab: opts.tab };
  if (!report) return { ...base, state: "gray", reason: "No saved report yet.", verifiedAt: null, action: opts.action };
  if (report.state === "Not Connected") {
    return { ...base, state: "gray", reason: opts.notConnected, verifiedAt: report.checkedAt, action: opts.action };
  }
  if (report.state === "Error") {
    return { ...base, state: "red", reason: "The last check failed. Showing the last saved data, if any.", verifiedAt: report.checkedAt, action: "Open the integration and refresh the report." };
  }
  const old = age(report.checkedAt, now);
  if (old === null) return { ...base, state: "yellow", reason: "Connected, but no check time was recorded.", verifiedAt: null, action: "Refresh the report to verify." };
  if (old > REPORT_FRESH_MS) {
    return { ...base, state: "yellow", reason: "The last successful check is more than 7 days old.", verifiedAt: report.checkedAt, action: "Refresh the report to verify." };
  }
  return { ...base, state: "green", reason: "The last report request succeeded recently.", verifiedAt: report.checkedAt, action: "No action needed." };
}

/** Lead-record evidence for the website and GHL items. Only records inside the window are considered. */
export function summarizeLeadEvidence(leads: HealthLead[], now: number) {
  const dated = leads
    .map((lead) => ({ lead, ms: Date.parse(lead.created_at ?? "") }))
    .filter((row) => Number.isFinite(row.ms))
    .sort((a, b) => b.ms - a.ms);
  const latestLead = dated[0] ?? null;

  const tracked = dated
    .filter((row) => now - row.ms <= DELIVERY_WINDOW_MS)
    .map((row) => ({ ...row, status: getGhlDeliveryStatus(row.lead, now), at: Date.parse(String(row.lead.details?.["ghl_delivery_at"] ?? "")), http: Number(row.lead.details?.["ghl_delivery_http"]) }))
    .filter((row) => row.status.kind !== "not_tracked" && row.status.kind !== "not_applicable");

  const recentFailures = tracked.filter((row) => row.status.kind === "failed" && now - row.ms <= FAILURE_WINDOW_MS);
  const pending = tracked.filter((row) => row.status.kind === "unconfirmed" || row.status.kind === "stale_sending");
  const latestTracked = tracked[0] ?? null;
  return { latestLead, tracked, recentFailures, pending, latestTracked };
}

const iso = (ms: number | undefined | null) => (ms != null && Number.isFinite(ms) ? new Date(ms).toISOString() : null);

export function computeHealth(input: HealthInput): HealthItem[] {
  const { now } = input;
  const items: HealthItem[] = [];

  /* Website and lead-capture evidence */
  if (input.leads === null) {
    for (const [id, name] of [["lead-persistence", "Website lead persistence"], ["form-processing", "Website form processing"]] as const) {
      items.push({ id, name, state: "gray", reason: "Lead records could not be loaded, so nothing can be verified.", verifiedAt: null, action: "Reload this page; check staff access.", to: "/admin/customers" });
    }
    for (const [id, name] of [["ghl-delivery", "GHL delivery"], ["ghl-webhook", "GHL webhook response"]] as const) {
      items.push({ id, name, state: "gray", reason: "Lead records could not be loaded, so delivery cannot be checked.", verifiedAt: null, action: "Reload this page.", to: "/admin/customers" });
    }
  } else {
    const ev = summarizeLeadEvidence(input.leads, now);
    const latestAge = ev.latestLead ? now - ev.latestLead.ms : null;

    items.push(
      !ev.latestLead
        ? { id: "lead-persistence", name: "Website lead persistence", state: "gray", reason: "No saved lead records were found, so there is nothing to verify.", verifiedAt: null, action: "Submit a real test inquiry yourself when convenient; none is sent automatically.", to: "/admin/customers" }
        : latestAge! <= LEAD_RECENT_MS
          ? { id: "lead-persistence", name: "Website lead persistence", state: "green", reason: "A lead was saved in the last 72 hours.", verifiedAt: iso(ev.latestLead.ms), action: "No action needed.", to: "/admin/customers" }
          : { id: "lead-persistence", name: "Website lead persistence", state: "yellow", reason: "No lead has been saved in the last 72 hours. This may only mean a quiet period.", verifiedAt: iso(ev.latestLead.ms), action: "Check that the forms work with a real test inquiry.", to: "/admin/customers" },
    );

    const processed = ev.tracked[0] ?? null;
    items.push(
      !processed
        ? { id: "form-processing", name: "Website form processing", state: "gray", reason: "No recent lead carries a server delivery record, so server-side processing is unverified.", verifiedAt: null, action: "Confirm the delivery update is deployed, then wait for the next lead.", to: "/admin/customers" }
        : { id: "form-processing", name: "Website form processing", state: "green", reason: "A recent lead was processed by the server and recorded a delivery result.", verifiedAt: iso(processed.ms), action: "No action needed.", to: "/admin/customers" },
    );

    if (!ev.tracked.length) {
      for (const [id, name] of [["ghl-delivery", "GHL delivery"], ["ghl-webhook", "GHL webhook response"]] as const) {
        items.push({ id, name, state: "gray", reason: "No lead in the last 7 days has a delivery record. Older leads were saved before tracking.", verifiedAt: null, action: "Wait for the next website lead, or check the server credentials if leads are arriving.", to: "/admin/customers" });
      }
    } else {
      const worst: HealthItem["state"] = ev.recentFailures.length ? "red" : ev.pending.length ? "yellow" : "green";
      const when = iso(ev.tracked[0]!.at) ?? iso(ev.tracked[0]!.ms);
      items.push({
        id: "ghl-delivery",
        name: "GHL delivery",
        state: worst,
        reason:
          worst === "red"
            ? `${ev.recentFailures.length} lead(s) in the last 24 hours were refused by GoHighLevel.`
            : worst === "yellow"
              ? `${ev.pending.length} lead(s) in the last 7 days are unconfirmed or stalled. GoHighLevel may or may not have them.`
              : "Recent tracked leads were accepted by GoHighLevel.",
        verifiedAt: when,
        action:
          worst === "green"
            ? "No action needed."
            : "Open Customers, use the Needs GHL Follow-up filter, and check each lead in GoHighLevel. Nothing is resent automatically.",
        to: "/admin/customers",
      });

      const latest = ev.tracked[0]!;
      const http = Number.isFinite(latest.http) ? latest.http : null;
      const family = http === null ? null : `${Math.floor(http / 100)}xx`;
      items.push({
        id: "ghl-webhook",
        name: "GHL webhook response",
        state: latest.status.kind === "delivered" ? "green" : latest.status.kind === "failed" ? "red" : "yellow",
        reason:
          latest.status.kind === "delivered"
            ? `The latest tracked delivery got an accepted response${family ? ` (${family})` : ""}.`
            : latest.status.kind === "failed"
              ? `The latest tracked delivery was refused${family ? ` (${family})` : ""}.`
              : "The latest tracked delivery has no confirmed response.",
        verifiedAt: iso(latest.at) ?? iso(latest.ms),
        action: latest.status.kind === "delivered" ? "No action needed." : "Check the lead in GoHighLevel before contacting the customer.",
        to: "/admin/customers",
      });
    }
  }

  /* Provider reports */
  items.push(
    reportItem("search-console", "Search Console connection", input.search, now, {
      tab: "gsc",
      notConnected: "Search Console is not connected.",
      action: "Connect Search Console in Integrations.",
    }),
  );

  const g = input.ga4;
  const ga4Age = age(g.checkedAt, now);
  items.push({
    id: "ga4",
    name: "GA4 configuration",
    tab: "analytics",
    ...(g.state === "ok" && ga4Age !== null && ga4Age <= REPORT_FRESH_MS
      ? { state: "green" as const, reason: "The last GA4 report request succeeded.", verifiedAt: g.checkedAt, action: "No action needed." }
      : g.state === "ok"
        ? { state: "yellow" as const, reason: "The last successful GA4 check is more than 7 days old or has no time.", verifiedAt: g.checkedAt, action: "Open Google Analytics to refresh." }
        : g.state === "error"
          ? { state: "red" as const, reason: "The last GA4 report request failed.", verifiedAt: g.checkedAt, action: "Open Google Analytics and read the error." }
          : g.state === "not_configured"
            ? { state: "gray" as const, reason: "GA4 reporting is not configured.", verifiedAt: null, action: "Configure GA4 reporting." }
            : { state: "gray" as const, reason: "GA4 has not been checked in this session.", verifiedAt: null, action: "Open Google Analytics." }),
  });

  /* Site checks come from the saved Website report, which fetches the live site. */
  const site = input.website;
  const siteData = site?.data ?? null;
  const siteAge = age(site?.checkedAt, now);
  const siteBase = { verifiedAt: site?.checkedAt ?? null, tab: "health" as const };
  const siteFresh = siteAge !== null && siteAge <= REPORT_FRESH_MS;

  items.push(
    !siteData
      ? { id: "sitemap", name: "Sitemap response", state: "gray", reason: "No saved website check.", verifiedAt: null, tab: "health", action: "Refresh Website Health." }
      : siteData.sitemap && siteData.sitemap.status !== 200
        ? { id: "sitemap", name: "Sitemap response", state: "red", reason: `The sitemap answered HTTP ${siteData.sitemap.status}.`, ...siteBase, action: "Open the sitemap and check the website." }
        : siteData.sitemap && siteData.sitemap.urls === 0
          ? { id: "sitemap", name: "Sitemap response", state: "red", reason: "The sitemap loaded but lists no URLs.", ...siteBase, action: "Check the inventory and blog data sources." }
          : !siteFresh
            ? { id: "sitemap", name: "Sitemap response", state: "yellow", reason: "The saved sitemap check is more than 7 days old.", ...siteBase, action: "Refresh Website Health." }
            : { id: "sitemap", name: "Sitemap response", state: "green", reason: `The sitemap answered HTTP 200 with ${siteData.sitemap?.urls ?? 0} URLs.`, ...siteBase, action: "No action needed." },
  );

  items.push(
    !siteData?.metadata
      ? { id: "routes", name: "Website route availability", state: "gray", reason: "No saved website check.", verifiedAt: null, tab: "health", action: "Refresh Website Health." }
      : siteData.metadata.status !== 200
        ? { id: "routes", name: "Website route availability", state: "red", reason: `The home page answered HTTP ${siteData.metadata.status}.`, ...siteBase, action: "Check the website and hosting." }
        : !siteFresh
          ? { id: "routes", name: "Website route availability", state: "yellow", reason: "The saved home-page check is more than 7 days old. Only the home page, robots.txt and the sitemap are checked.", ...siteBase, action: "Refresh Website Health." }
          : { id: "routes", name: "Website route availability", state: "green", reason: "The home page answered HTTP 200 in the last check. Other pages are not checked.", ...siteBase, action: "No action needed." },
  );

  /* Meta: the dashboard has no way to see events arrive. */
  items.push({
    id: "meta",
    name: "Meta integration configuration",
    state: input.metaPixelConfigured ? "yellow" : "gray",
    reason: input.metaPixelConfigured
      ? "The Meta Pixel is set up in the site code and fires only with consent. Event delivery and server-side (CAPI) deduplication are not verifiable here."
      : "No Meta Pixel was found in the site configuration.",
    verifiedAt: null,
    action: "Check Test Events and Diagnostics in Meta Events Manager.",
  });

  return items;
}

/** Worst state wins; gray only when nothing else is known. */
export function worstState(states: HealthState[]): HealthState {
  if (states.includes("red")) return "red";
  if (states.includes("yellow")) return "yellow";
  if (states.includes("green")) return "green";
  return "gray";
}

/* -------------------------------------------------------------------------- */
/* Funnel stages                                                               */
/* -------------------------------------------------------------------------- */

export type FunnelStage = {
  id: string;
  title: string;
  summary: string;
  /** What this stage contains, as it exists today. */
  items: string[];
  /** Health items that decide this stage's state. Empty means nothing here can be verified. */
  healthIds: string[];
  /** What cannot be verified from the dashboard. */
  notVerified: string[];
  links: Array<{ label: string; tab?: string; to?: string }>;
};

export const FUNNEL_STAGES: FunnelStage[] = [
  {
    id: "sources",
    title: "Marketing sources",
    summary: "Where visitors come from. Only some of these report to the dashboard.",
    items: ["Google organic search", "Google Ads (campaigns paused)", "Facebook", "Instagram", "TikTok", "LinkedIn", "AI assistants", "Direct and referral visits"],
    healthIds: ["search-console", "ga4"],
    notVerified: [
      "Facebook, Instagram, TikTok, LinkedIn and WhatsApp have no API connection in this dashboard. They appear only when a visitor's saved lead carries that source.",
      "Google Ads has no API connection here and campaigns are paused.",
    ],
    links: [{ label: "Search Console", tab: "gsc" }, { label: "Google Analytics", tab: "analytics" }, { label: "Lead attribution", tab: "attribution" }],
  },
  {
    id: "capture",
    title: "Website and lead capture",
    summary: "The forms on mycarcorp.com, plus the chat widget.",
    items: ["Contact", "Car Finder", "Sell", "Trade", "Appointment", "Availability", "Financing"],
    healthIds: ["routes", "sitemap", "meta"],
    notVerified: ["Form behavior in a real browser is not tested from the dashboard. Only the home page, robots.txt and the sitemap are fetched."],
    links: [{ label: "Website health", tab: "health" }],
  },
  {
    id: "processing",
    title: "Lead processing",
    summary: "The website saves each inquiry, then forwards the saved record once.",
    items: ["Lead saved in the database", "Saved record forwarded to GoHighLevel once", "Delivery result stored on the lead"],
    healthIds: ["lead-persistence", "form-processing"],
    notVerified: ["Unconfirmed deliveries are never retried automatically, because a retry could create a duplicate contact."],
    links: [{ label: "Customer leads", to: "/admin/customers" }],
  },
  {
    id: "crm",
    title: "GoHighLevel CRM",
    summary: "Contact creation, custom fields, tags and opportunities happen inside GoHighLevel.",
    items: ["Webhook received", "Contact and fields", "Tags", "Opportunity"],
    healthIds: ["ghl-delivery", "ghl-webhook"],
    notVerified: [
      "The dashboard sees only the webhook response. Whether GoHighLevel then created the contact, tags and opportunity is not visible here.",
      "GoHighLevel workflows are not read or changed.",
    ],
    links: [{ label: "Needs GHL follow-up", to: "/admin/customers" }],
  },
  {
    id: "sales",
    title: "Sales operations",
    summary: "Staff notification, assignment and follow-up.",
    items: ["Staff notifications", "Lead assignment", "Follow-up"],
    healthIds: [],
    notVerified: ["Notifications, assignment and follow-up happen in GoHighLevel and are not visible to the dashboard."],
    links: [{ label: "Customer leads", to: "/admin/customers" }],
  },
  {
    id: "conversions",
    title: "Conversions",
    summary: "Outcomes that follow a lead.",
    items: ["Workable lead", "Appointment request", "Confirmed appointment", "Completed purchase"],
    healthIds: [],
    notVerified: ["Qualified leads are not reported: qualification criteria have not been approved."],
    links: [{ label: "Lead goal", tab: "leadgoal" }, { label: "Verified outcomes", tab: "attribution" }],
  },
];

export function stageState(stage: FunnelStage, items: HealthItem[]): HealthState {
  if (!stage.healthIds.length) return "gray";
  const states = items.filter((i) => stage.healthIds.includes(i.id)).map((i) => i.state);
  return worstState(states.length ? states : ["gray"]);
}

/** A stage with a green state is verified only for the checks listed in its health ids, never for everything it contains. */
export function stageCoverage(stage: FunnelStage): string {
  return stage.healthIds.length ? `${stage.healthIds.length} automatic check(s)` : "No automatic check";
}
