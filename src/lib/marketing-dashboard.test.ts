import { readFileSync, readdirSync } from "node:fs";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Rendering needs a router for <Link>; a plain anchor is enough to check the markup.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => React.createElement("a", { href: to }, children),
}));

import { FunnelMonitor, HealthBadge, LeadGoalPanel, buildDiagnosticBrief } from "../components/admin/MarketingFunnel";
import {
  FUNNEL_STAGES,
  HEALTH_LABELS,
  computeHealth,
  stageState,
  worstState,
  type HealthInput,
  type HealthItem,
} from "./marketing-health";
import {
  DAILY_GOAL,
  EXPORT_COLUMNS,
  appointmentRequestRate,
  buildLeadExportCsv,
  buildLeadGoalReport,
  channelKeyForSource,
  classifyLeads,
  csvCell,
  goalProgress,
  groupChannelRows,
  localDateKey,
  normalizeEmail,
  normalizePhone,
  type GoalLead,
} from "./marketing-lead-goal";

const read = (path: string) => readFileSync(path, "utf8");
const HOUR = 3600_000;

/* -------------------------------------------------------------------------- */
/* Lead goal                                                                   */
/* -------------------------------------------------------------------------- */

// Synthetic records only. 2026-03-10 15:00 UTC = 11:00 in New York (EDT).
const NOW = Date.parse("2026-03-10T15:00:00Z");
let seq = 0;
function lead(overrides: Partial<GoalLead & { full_name: string }> = {}): GoalLead & { full_name: string } {
  seq += 1;
  return {
    id: `lead-${seq}`,
    lead_type: "contact",
    status: "new",
    full_name: `Test Person ${seq}`,
    email: `person${seq}@example.test`,
    phone: null,
    created_at: "2026-03-10T14:00:00Z",
    details: { channel: "organic_search" },
    ...overrides,
  };
}

describe("dealership-local day boundaries", () => {
  it("uses New York time, not UTC, for the calendar day", () => {
    expect(localDateKey(Date.parse("2026-03-10T03:30:00Z"))).toBe("2026-03-09");
    expect(localDateKey(Date.parse("2026-03-10T05:30:00Z"))).toBe("2026-03-10");
    // Daylight saving started 2026-03-08: before it the offset is -5h, after it -4h.
    expect(localDateKey(Date.parse("2026-03-08T04:30:00Z"))).toBe("2026-03-07");
    expect(localDateKey(Date.parse("2026-03-08T05:30:00Z"))).toBe("2026-03-08");
  });

  it("counts a lead received at 11 pm local time on the local day, not the next UTC day", () => {
    const late = lead({ created_at: "2026-03-10T03:30:00Z" });
    const report = buildLeadGoalReport([late], { now: NOW });
    expect(report.daily.find((d) => d.date === "2026-03-09")?.total).toBe(1);
    expect(report.daily.find((d) => d.date === "2026-03-10")?.total).toBe(0);
    expect(report.today).toBe("2026-03-10");
  });
});

describe("lead classification", () => {
  it("normalizes contact details", () => {
    expect(normalizeEmail("  Pat@Example.TEST ")).toBe("pat@example.test");
    expect(normalizeEmail("not an email")).toBe("");
    expect(normalizePhone("(540) 555-0100")).toBe("5405550100");
    expect(normalizePhone("+1 540 555 0100")).toBe("5405550100");
    expect(normalizePhone("12345")).toBe("");
  });

  it("a record with no usable email or phone is invalid; nothing else is called spam", () => {
    const rows = classifyLeads([lead({ email: "x", phone: "1" }), lead({ email: "", phone: "5405550100" }), lead({ message: "buy now!!!" } as never)]);
    expect(rows.map((r) => r.category)).toEqual(["invalid", "workable", "workable"]);
  });

  it("the same person's same inquiry within 24 hours is a duplicate; the first is kept", () => {
    const a = lead({ email: "same@example.test", created_at: "2026-03-10T10:00:00Z" });
    const b = lead({ email: "SAME@example.test", created_at: "2026-03-10T12:00:00Z" });
    const c = lead({ email: "same@example.test", created_at: "2026-03-11T11:00:00Z" });
    const rows = Object.fromEntries(classifyLeads([c, b, a]).map((r) => [r.id, r.category]));
    expect(rows[a.id!]).toBe("workable");
    expect(rows[b.id!]).toBe("duplicate");
    expect(rows[c.id!]).toBe("workable");
  });

  it("matches repeats by phone too, and never merges different inquiry types", () => {
    const a = lead({ email: "one@example.test", phone: "540-555-0100", created_at: "2026-03-10T10:00:00Z" });
    const samePhone = lead({ email: "two@example.test", phone: "(540) 555-0100", created_at: "2026-03-10T11:00:00Z" });
    const otherType = lead({ lead_type: "appointment", email: "one@example.test", created_at: "2026-03-10T11:30:00Z" });
    const rows = Object.fromEntries(classifyLeads([a, samePhone, otherType]).map((r) => [r.id, r.category]));
    expect(rows[samePhone.id!]).toBe("duplicate");
    expect(rows[otherType.id!]).toBe("workable");
  });

  it("labels inquiry types, including Car Finder and Sell versus Trade", () => {
    const types = classifyLeads([
      lead({ lead_type: "contact", details: { request_type: "car_finder" } }),
      lead({ lead_type: "trade", details: { intent: "sell" } }),
      lead({ lead_type: "trade", details: { intent: "trade" } }),
      lead({ lead_type: "finance" }),
    ]).map((r) => r.inquiryType);
    expect(types).toEqual(["Car Finder", "Sell", "Trade", "Financing"]);
  });

  it("records without a readable creation time are left out, not guessed", () => {
    expect(classifyLeads([lead({ created_at: null }), lead({ created_at: "garbage" })])).toEqual([]);
  });
});

describe("daily goal report", () => {
  it("counts today's workable leads against the 6–10 target and never reports qualified leads", () => {
    const leads = Array.from({ length: 7 }, () => lead());
    const report = buildLeadGoalReport(leads, { now: NOW });
    expect(report.today_.workable).toBe(7);
    expect(report.workableProgress.status).toBe("within");
    expect(report.qualified.status).toBe("unavailable");
    expect(JSON.stringify(report)).not.toMatch(/"qualified":\s*\d/);
  });

  it("goal progress boundaries", () => {
    expect([0, 5, 6, 10, 11].map(goalProgress)).toEqual(["below", "below", "within", "within", "above"]);
    expect(DAILY_GOAL).toEqual({ min: 6, max: 10 });
  });

  it("an empty period is honest: zero everywhere, every day present, nothing invented", () => {
    const report = buildLeadGoalReport([], { now: NOW, windowDays: 30 });
    expect(report.total).toBe(0);
    expect(report.daily).toHaveLength(30);
    expect(report.daily.every((d) => d.total === 0)).toBe(true);
    expect(report.bySource).toEqual([]);
    expect(report.workableProgress.percentOfMinimum).toBe(0);
    expect(appointmentRequestRate(report)).toBeNull();
  });

  it("excludes repeats and unusable records from source and inquiry breakdowns", () => {
    const a = lead({ email: "d@example.test", created_at: "2026-03-10T10:00:00Z" });
    const dup = lead({ email: "d@example.test", created_at: "2026-03-10T11:00:00Z" });
    const bad = lead({ email: "", phone: "" });
    const other = lead({ lead_type: "appointment", details: { channel: "ai_assistant" } });
    const report = buildLeadGoalReport([a, dup, bad, other], { now: NOW });
    expect(report.totals).toMatchObject({ total: 4, workable: 2, duplicate: 1, invalid: 1 });
    expect(report.bySource).toEqual([{ label: "AI assistants", count: 1 }, { label: "Organic search", count: 1 }]);
    expect(report.appointmentRequests).toBe(1);
  });

  it("leads saved before channel tracking are 'Not tracked', not guessed", () => {
    const report = buildLeadGoalReport([lead({ details: {} }), lead({ details: null })], { now: NOW });
    expect(report.bySource).toEqual([{ label: "Not tracked", count: 2 }]);
  });

  it("ignores records outside the window and flags a possibly truncated read", () => {
    const old = lead({ created_at: "2025-01-01T12:00:00Z" });
    const report = buildLeadGoalReport([old, lead()], { now: NOW, windowDays: 30, recordLimit: 2 });
    expect(report.total).toBe(1);
    expect(report.possiblyTruncated).toBe(true);
    expect(buildLeadGoalReport([lead()], { now: NOW, recordLimit: 2000 }).possiblyTruncated).toBe(false);
  });

  it("weekly and monthly totals add up to the daily series", () => {
    const leads = ["2026-02-20T15:00:00Z", "2026-03-02T15:00:00Z", "2026-03-03T15:00:00Z", "2026-03-10T14:00:00Z"].map((created_at) => lead({ created_at }));
    const report = buildLeadGoalReport(leads, { now: NOW, windowDays: 30 });
    const sum = (rows: Array<{ total: number }>) => rows.reduce((n, r) => n + r.total, 0);
    expect(sum(report.weekly)).toBe(report.total);
    expect(sum(report.monthly)).toBe(report.total);
    expect(sum(report.daily)).toBe(report.total);
    expect(report.weekly.every((w) => new Date(`${w.weekStart}T00:00:00Z`).getUTCDay() === 1)).toBe(true);
  });
});

describe("channel grouping", () => {
  it("maps saved source labels to the fixed channel rows", () => {
    expect(channelKeyForSource("Google Organic")).toBe("google-organic");
    expect(channelKeyForSource("Google Vehicle Ads")).toBe("google-ads");
    expect(channelKeyForSource("Direct Traffic")).toBe("direct");
    expect(channelKeyForSource("ChatGPT")).toBe("ai");
    expect(channelKeyForSource("Bing Organic")).toBe("other");
    expect(channelKeyForSource("Facebook")).toBe("facebook");
  });

  it("always returns all ten rows and never invents a count", () => {
    const rows = groupChannelRows([{ source: "Google Organic", count: 3 }, { source: "Perplexity", count: 2 }, { source: "Reddit", count: 1 }]);
    expect(rows).toHaveLength(10);
    expect(rows.find((r) => r.key === "google-organic")?.leads).toBe(3);
    expect(rows.find((r) => r.key === "ai")?.leads).toBe(2);
    expect(rows.find((r) => r.key === "other")?.leads).toBe(1);
    expect(rows.find((r) => r.key === "tiktok")?.leads).toBe(0);
  });

  it("does not imply API connections for social channels", () => {
    const rows = groupChannelRows([]);
    for (const key of ["facebook", "instagram", "tiktok", "linkedin", "whatsapp"]) {
      expect(rows.find((r) => r.key === key)?.connection, key).toMatch(/No API connection/);
    }
  });
});

describe("authorized lead export", () => {
  it("exports only business fields and protects against spreadsheet formulas", () => {
    const csv = buildLeadExportCsv([
      { ...lead({ full_name: "=HYPERLINK(\"x\")", email: "a@example.test" }), message: "private message", details: { secret: "internal", channel: "direct" } } as never,
    ]);
    const [header, row] = csv.split("\r\n");
    expect(header!.split(",")).toEqual([...EXPORT_COLUMNS]);
    expect(row).toContain("'=HYPERLINK");
    expect(csv).not.toMatch(/private message|internal|secret|ghl_delivery|details|password|token/i);
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell(null)).toBe("");
  });

  it("exports no row for a record that cannot be dated", () => {
    expect(buildLeadExportCsv([lead({ created_at: null })]).split("\r\n")).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Health                                                                      */
/* -------------------------------------------------------------------------- */

const NOW_H = Date.parse("2026-03-10T15:00:00Z");
const iso = (agoMs: number) => new Date(NOW_H - agoMs).toISOString();
const connected = (agoMs: number) => ({ state: "Connected" as const, checkedAt: iso(agoMs) });

function trackedLead(state: string, agoMs: number, extra: Record<string, unknown> = {}) {
  return { lead_type: "contact", created_at: iso(agoMs), details: { ghl_delivery_state: state, ghl_delivery_at: iso(agoMs), ghl_delivery_http: state === "delivered" ? "200" : state === "failed" ? "422" : "", ...extra } };
}

function input(overrides: Partial<HealthInput> = {}): HealthInput {
  return {
    now: NOW_H,
    search: connected(HOUR),
    website: { ...connected(HOUR), data: { sitemap: { status: 200, urls: 60 }, metadata: { status: 200 }, robots: { status: 200 } } },
    leads: [trackedLead("delivered", HOUR)],
    ga4: { state: "ok", checkedAt: iso(HOUR) },
    metaPixelConfigured: true,
    ...overrides,
  };
}

const byId = (items: HealthItem[], id: string) => items.find((i) => i.id === id)!;

describe("health states", () => {
  it("is green only with recent real evidence", () => {
    const items = computeHealth(input());
    for (const id of ["lead-persistence", "form-processing", "ghl-delivery", "ghl-webhook", "search-console", "ga4", "sitemap", "routes"]) {
      expect(byId(items, id).state, id).toBe("green");
      expect(byId(items, id).verifiedAt, id).toBeTruthy();
    }
  });

  it("a saved or configured connection with no proof is never green", () => {
    const items = computeHealth(input({ search: null, website: null, leads: [], ga4: { state: "unchecked", checkedAt: null } }));
    for (const id of ["search-console", "ga4", "sitemap", "routes", "lead-persistence", "form-processing", "ghl-delivery", "ghl-webhook"]) {
      expect(byId(items, id).state, id).toBe("gray");
    }
    expect(byId(items, "meta").state).toBe("yellow");
    expect(byId(items, "meta").reason).toMatch(/not verifiable here/);
  });

  it("GHL delivery: a refusal in the last 24 hours is red; unconfirmed or stalled is yellow, never retried by the dashboard", () => {
    expect(byId(computeHealth(input({ leads: [trackedLead("failed", 2 * HOUR), trackedLead("delivered", 3 * HOUR)] })), "ghl-delivery").state).toBe("red");
    expect(byId(computeHealth(input({ leads: [trackedLead("failed", 30 * HOUR)] })), "ghl-delivery").state).toBe("green");
    const yellow = byId(computeHealth(input({ leads: [trackedLead("unconfirmed", 2 * HOUR), trackedLead("delivered", 3 * HOUR)] })), "ghl-delivery");
    expect(yellow.state).toBe("yellow");
    expect(yellow.action).toMatch(/Nothing is resent automatically/);
    const stalled = trackedLead("sending", 10 * HOUR);
    expect(byId(computeHealth(input({ leads: [stalled] })), "ghl-delivery").state).toBe("yellow");
  });

  it("webhook response follows the newest tracked delivery", () => {
    expect(byId(computeHealth(input({ leads: [trackedLead("failed", HOUR), trackedLead("delivered", 5 * HOUR)] })), "ghl-webhook").state).toBe("red");
    expect(byId(computeHealth(input({ leads: [trackedLead("unconfirmed", HOUR)] })), "ghl-webhook").state).toBe("yellow");
  });

  it("legacy leads without delivery records are unknown, not failed", () => {
    const legacy = [{ lead_type: "contact", created_at: iso(HOUR), details: {} }];
    const items = computeHealth(input({ leads: legacy }));
    expect(byId(items, "ghl-delivery").state).toBe("gray");
    expect(byId(items, "lead-persistence").state).toBe("green");
    expect(byId(items, "form-processing").state).toBe("gray");
  });

  it("a quiet period is a warning, and unloadable lead records make everything lead-based unknown", () => {
    expect(byId(computeHealth(input({ leads: [{ lead_type: "contact", created_at: iso(100 * HOUR), details: {} }] })), "lead-persistence").state).toBe("yellow");
    const unknown = computeHealth(input({ leads: null }));
    for (const id of ["lead-persistence", "form-processing", "ghl-delivery", "ghl-webhook"]) expect(byId(unknown, id).state).toBe("gray");
  });

  it("provider reports: error is red, not connected is unknown, stale is a warning", () => {
    expect(byId(computeHealth(input({ search: { state: "Error", checkedAt: iso(HOUR) } })), "search-console").state).toBe("red");
    expect(byId(computeHealth(input({ search: { state: "Not Connected", checkedAt: null } })), "search-console").state).toBe("gray");
    expect(byId(computeHealth(input({ search: connected(9 * 24 * HOUR) })), "search-console").state).toBe("yellow");
    expect(byId(computeHealth(input({ ga4: { state: "error", checkedAt: null } })), "ga4").state).toBe("red");
    expect(byId(computeHealth(input({ ga4: { state: "not_configured", checkedAt: null } })), "ga4").state).toBe("gray");
  });

  it("sitemap and route checks use the saved live fetch", () => {
    const bad = (sitemap: number, home: number, urls = 60) => input({ website: { ...connected(HOUR), data: { sitemap: { status: sitemap, urls }, metadata: { status: home } } } });
    expect(byId(computeHealth(bad(500, 200)), "sitemap").state).toBe("red");
    expect(byId(computeHealth(bad(200, 200, 0)), "sitemap").state).toBe("red");
    expect(byId(computeHealth(bad(200, 503)), "routes").state).toBe("red");
    expect(byId(computeHealth(input({ website: { ...connected(10 * 24 * HOUR), data: { sitemap: { status: 200, urls: 5 }, metadata: { status: 200 } } } })), "routes").state).toBe("yellow");
    expect(byId(computeHealth(bad(200, 200)), "routes").reason).toMatch(/Other pages are not checked/);
  });

  it("health text never contains emails, phone numbers, URLs or keys", () => {
    const items = computeHealth(input({ leads: [trackedLead("failed", HOUR, { email: "secret@example.test" })] }));
    const text = JSON.stringify(items);
    expect(text).not.toMatch(/@example|https?:\/\/|api[_-]?key|webhook-trigger|sb_secret|Bearer/i);
  });

  it("worst state wins, and an unknown list stays unknown", () => {
    expect(worstState(["green", "yellow", "red", "gray"])).toBe("red");
    expect(worstState(["green", "gray"])).toBe("green");
    expect(worstState(["gray"])).toBe("gray");
    expect(worstState([])).toBe("gray");
  });
});

describe("funnel stages", () => {
  it("define the six stages in order", () => {
    expect(FUNNEL_STAGES.map((s) => s.id)).toEqual(["sources", "capture", "processing", "crm", "sales", "conversions"]);
  });

  it("stages with nothing to check are unknown, and every health id they use exists", () => {
    const items = computeHealth(input());
    const ids = new Set(items.map((i) => i.id));
    for (const stage of FUNNEL_STAGES) for (const id of stage.healthIds) expect(ids.has(id), `${stage.id}:${id}`).toBe(true);
    expect(stageState(FUNNEL_STAGES.find((s) => s.id === "sales")!, items)).toBe("gray");
    expect(stageState(FUNNEL_STAGES.find((s) => s.id === "conversions")!, items)).toBe("gray");
  });

  it("a stage takes the worst state of its checks", () => {
    const items = computeHealth(input({ leads: [trackedLead("failed", HOUR)] }));
    expect(stageState(FUNNEL_STAGES.find((s) => s.id === "crm")!, items)).toBe("red");
  });

  it("does not claim social channels or CRM internals are verified", () => {
    const sources = FUNNEL_STAGES.find((s) => s.id === "sources")!;
    expect(sources.notVerified.join(" ")).toMatch(/no API connection/i);
    const crm = FUNNEL_STAGES.find((s) => s.id === "crm")!;
    expect(crm.notVerified.join(" ")).toMatch(/not visible here/);
  });
});

describe("rendered funnel monitor", () => {
  const items = computeHealth(input({ leads: [trackedLead("unconfirmed", HOUR)] }));
  const html = renderToString(React.createElement(FunnelMonitor, { items, onOpenTab: () => undefined }));

  it("shows every stage and a text label for every state, not just colour", () => {
    for (const stage of FUNNEL_STAGES) expect(html).toContain(stage.title);
    for (const label of Object.values(HEALTH_LABELS)) expect(renderToString(React.createElement(HealthBadge, { state: Object.keys(HEALTH_LABELS).find((k) => HEALTH_LABELS[k as keyof typeof HEALTH_LABELS] === label) as "green" }))).toContain(label);
    expect(html).toContain("aria-pressed");
    expect(html).toContain("Not verified from this dashboard");
  });

  it("lists every health check with its reason, last verified time and next step", () => {
    for (const item of items) {
      expect(html).toContain(item.name);
      expect(html).toContain("Last verified:");
    }
    expect(html).toContain("Recommended action:");
  });

  it("states honestly that no agent is connected, and offers only a copyable brief", () => {
    expect(html).toContain("Agent not connected");
    expect(html).toContain("No AI agent is connected");
    expect(html).not.toMatch(/Ask the agent|Run fix|Apply fix|Restart integration|Rotate credentials/i);
  });

  it("the diagnostic brief omits healthy items, carries the safety rules and contains no customer data", () => {
    const brief = buildDiagnosticBrief(items, "2026-03-10T15:00:00Z");
    expect(brief).toMatch(/Do not change production settings/);
    expect(brief).toMatch(/do not retry webhook deliveries/);
    expect(brief).toContain("GHL delivery");
    expect(brief).not.toMatch(/@|https?:\/\//);
    const healthy = computeHealth(input());
    const allGreen = healthy.map((i) => ({ ...i, state: "green" as const }));
    expect(buildDiagnosticBrief(allGreen, "x")).toContain("No warnings, failures or unknowns");
  });
});

describe("rendered lead goal panel", () => {
  const render = (props: Partial<Parameters<typeof LeadGoalPanel>[0]> = {}) =>
    renderToString(React.createElement(LeadGoalPanel, { report: buildLeadGoalReport([lead()], { now: NOW }), loading: false, error: null, canExport: true, onExport: () => undefined, ...props }));

  it("shows the target, the timezone, today's counts and that qualified leads are not reported", () => {
    const html = render().replace(/<!-- -->/g, "");
    expect(html).toContain("6–10 workable leads per day");
    expect(html).toContain("America/New_York");
    expect(html).toContain("Not reported");
    expect(html).toContain("Target, not a result");
    expect(html).toMatch(/aria-valuenow/);
  });

  it("failed or loading data shows no figures", () => {
    expect(render({ report: null, error: "the lead service did not respond" })).toContain("No lead figures are shown");
    expect(render({ report: null, loading: true })).toContain("Loading saved lead records");
    expect(render({ report: null, loading: false, error: null })).toContain("No lead figures are shown");
  });

  it("warns when the record limit may hide older days", () => {
    expect(render({ report: buildLeadGoalReport([lead()], { now: NOW, recordLimit: 1 }) })).toContain("record limit was reached");
  });

  it("disables export without permission or data", () => {
    expect(render({ canExport: false })).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?Export CSV/);
    expect(render({ report: buildLeadGoalReport([], { now: NOW }) })).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?Export CSV/);
  });
});

/* -------------------------------------------------------------------------- */
/* Dashboard source: AutoSEO removal, navigation, permissions, preservation    */
/* -------------------------------------------------------------------------- */

describe("Marketing Hub page", () => {
  const hub = read("src/routes/admin.marketing.tsx");

  it("no longer presents AutoSEO as an active service", () => {
    const visible = hub.replace(/const articleOrigin[^\n]*\n/, "");
    expect(visible).not.toMatch(/AutoSEO|SEO Automation|autoSeoToken|AutoSEO pipeline/i);
    expect(hub).toContain('["content", "Blog Performance", FileText]');
    expect(hub).toContain("Articles already published stay live.");
  });

  it("every tab has a panel and a description, and every setTab target is a real tab", () => {
    const tabs = [...hub.matchAll(/^\s+\["([a-z]+)", "[^"]+", [A-Za-z0-9]+\],$/gm)].map((m) => m[1]!);
    expect(tabs).toEqual(["overview", "funnel", "leadgoal", "seo", "gsc", "inspection", "keywords", "backlinks", "attribution", "analytics", "content", "health", "reports", "integrations"]);
    for (const tab of tabs) {
      expect(hub, `panel ${tab}`).toContain(`<TabsContent value="${tab}">`);
    }
    for (const m of hub.matchAll(/setTab\("([a-z]+)"\)/g)) expect(tabs, m[1]).toContain(m[1]!);
    const stageTabs = FUNNEL_STAGES.flatMap((s) => s.links.map((l) => l.tab)).filter(Boolean);
    for (const tab of stageTabs) expect(tabs, String(tab)).toContain(tab!);
  });

  it("internal links go to routes that exist", () => {
    const routes = readdirSync("src/routes").map((f) => f.replace(/\.tsx$/, ""));
    for (const target of ["admin.customers", "admin.transactions", "admin.blog.index"]) expect(routes, target).toContain(target);
    for (const m of hub.matchAll(/<Link to="(\/admin\/[a-z]+)"/g)) {
      expect(routes.some((r) => r === m[1]!.slice(1).replace("/", ".") || r === `${m[1]!.slice(1).replace("/", ".")}.index`), m[1]).toBe(true);
    }
    for (const stage of FUNNEL_STAGES) for (const link of stage.links) if (link.to) expect(routes).toContain(link.to.slice(1).replace("/", "."));
  });

  it("labels URL Inspection as Google's indexing status, not a visitor count, and marks external reports", () => {
    expect(hub).toContain("It does not report how many people visited the page");
  });

  it("shows a meaningful state when Search Console or Semrush is not connected, without inventing a Semrush integration", () => {
    expect(hub).toContain('<Unavailable report={snapshot.research} name="Semrush" />');
    expect(hub).toContain('<Unavailable report={snapshot.search} name="Google Search Console" />');
    expect(hub).not.toMatch(/semrush\.com\/analytics|api\.semrush/i);
  });

  it("unavailable metrics say so instead of showing numbers", () => {
    expect(hub).toContain('"Not Connected"');
    // Qualified leads are not reported anywhere; the lead goal panel says so (covered above).
    expect(hub).not.toMatch(/Qualified leads"\s+value=\{?"?\d/);
    expect(hub).toContain('"No Data"');
  });

  it("lead data is requested only for signed-in staff, and export is gated the same way", () => {
    expect(hub).toMatch(/enabled: Boolean\(session\?\.access_token && isStaff\)/);
    expect(hub).toContain("canExport={Boolean(isStaff && leadsQuery.data?.length)}");
    const adminLeads = read("src/lib/admin-leads.functions.ts");
    expect(adminLeads).toContain("await requireStaff(data.accessToken);");
  });

  it("is read-only: no GHL sending, retries, writes or test leads from the hub or the new modules", () => {
    const files = [hub, read("src/components/admin/MarketingFunnel.tsx"), read("src/lib/marketing-health.ts"), read("src/lib/marketing-lead-goal.ts")];
    for (const source of files) {
      expect(source).not.toMatch(/sendLeadToGhl|deliverStoredLeadToGhl|deliverLeadToGhl|postToGhl|from "[^"]*(ghl-webhook|ghl-delivery\.server)|\.insert\(|\.delete\(|setInterval|method:\s*"(POST|PUT|PATCH|DELETE)"/);
    }
    expect(read("src/lib/marketing-health.ts")).not.toMatch(/fetch\(/);
    expect(read("src/lib/marketing-lead-goal.ts")).not.toMatch(/fetch\(/);
  });

  it("keeps the existing Phase 6 and Phase 7 pieces: attribution, GA4, Search Console, delivery monitor", () => {
    for (const piece of ["getLeadAttribution", "getMarketingGa4", "inspectMarketingUrl", "refreshMarketingFn", 'TabsContent value="attribution"', 'TabsContent value="analytics"', 'TabsContent value="gsc"']) {
      expect(hub, piece).toContain(piece);
    }
    expect(read("src/routes/admin.customers.tsx")).toContain("Needs GHL Follow-up");
    expect(read("src/lib/ghl-delivery.server.ts")).toContain("deliverStoredLeadToGhl");
    expect(read("src/lib/analytics.ts")).toContain("META_PIXEL_ID");
  });

  it("blog routes, SEO metadata and the article ingestion code are untouched by the dashboard work", () => {
    expect(read("src/routes/api/public/receive-article.tsx")).toContain("article.published");
    expect(read("src/lib/autoseo-blog.server.ts")).toContain("upsertAutoseoArticle");
    expect(read("src/routes/blog.$slug.tsx")).toContain("buildBlogPostingJsonLd");
  });
});
