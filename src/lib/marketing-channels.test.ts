import { readFileSync } from "node:fs";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
  createServerFn: () => ({ inputValidator: () => ({ handler: () => undefined }) }),
}));

import { ChannelReportPanel, SocialDashboard } from "../components/admin/MarketingChannels";
import { compareCampaigns, isReadOnlyMetaRequest, previewAction, suggest, summarizeCampaign, type MetaInsightRow } from "./meta-agent";
import { EMPTY_FILTERS, NOT_TRACKED, buildChannelReport, presetRange, touchOf } from "./marketing-channel-report";
import type { GoalLead } from "./marketing-lead-goal";
import { SOCIAL_PLATFORMS, buildSocialStatuses, socialLeadCounts } from "./marketing-social";

const read = (path: string) => readFileSync(path, "utf8");

/* -------------------------------------------------------------------------- */

describe("social platform connection states", () => {
  it("lists all six platforms and reports every one as Not Connected", () => {
    expect(SOCIAL_PLATFORMS.map((p) => p.id)).toEqual(["facebook", "instagram", "tiktok", "linkedin", "whatsapp", "snapchat"]);
    for (const s of buildSocialStatuses([])) {
      expect(s.connection).toBe("Not Connected");
      expect(s.analytics).toBe("Not Connected");
      expect(s.campaigns).toBe("Not Connected");
      expect(s.lastVerified).toBeNull();
    }
  });

  it("documents the API, permissions, authentication, token renewal, metrics, lead data and limits for each platform", () => {
    for (const p of SOCIAL_PLATFORMS) for (const key of ["api", "permissions", "authentication", "tokenRenewal", "metrics", "leadData", "limitations", "action"] as const) expect(p[key].length, `${p.id}.${key}`).toBeGreaterThan(10);
  });

  it("counts only website leads that name a platform as the source, and never invents performance", () => {
    const counts = socialLeadCounts([{ source: "Facebook", count: 3 }, { source: "tiktok", count: 1 }, { source: "Google Organic", count: 9 }]);
    expect(counts).toMatchObject({ facebook: 3, tiktok: 1, instagram: 0, snapchat: 0 });
    for (const s of buildSocialStatuses([])) {
      expect(Object.entries(s).filter(([, v]) => typeof v === "number").map(([k]) => k)).toEqual(["leadsAttributed"]);
    }
  });

  it("renders Not Connected and no invented metrics, with no credentials or tokens in the markup", () => {
    const html = renderToString(React.createElement(SocialDashboard, { leads: [], loading: false }));
    expect((html.match(/Not Connected/g) ?? []).length).toBeGreaterThanOrEqual(6);
    for (const p of SOCIAL_PLATFORMS) expect(html).toContain(p.name);
    expect(html).toContain("Direct-message inquiries");
    expect(html).toContain("Not Connected");
    expect(html).not.toMatch(/access_token|password|Bearer/i);
    expect(html).toContain("Facebook campaign analysis");
  });

  it("keeps organic, paid, referral, CRM and direct-message data separate", () => {
    const html = renderToString(React.createElement(SocialDashboard, { leads: null, loading: false }));
    for (const kind of ["Organic social performance", "Paid advertising performance", "Website referral traffic", "Leads generated and saved by the website", "Direct-message inquiries"]) expect(html).toContain(kind);
  });
});

/* -------------------------------------------------------------------------- */
/* Attribution report                                                          */
/* -------------------------------------------------------------------------- */

let n = 0;
function lead(o: Partial<GoalLead & { full_name: string }> & { channel?: string; source?: string; campaign?: string; first?: string } = {}): GoalLead {
  n += 1;
  const { channel, source, campaign, first, ...rest } = o;
  return {
    id: `l${n}`,
    lead_type: "contact",
    status: "new",
    email: `p${n}@example.test`,
    phone: null,
    created_at: "2026-03-10T14:00:00Z",
    details: {
      channel: channel ?? "organic_search",
      lead_source: source ?? "Google Organic",
      last_touch_channel: channel ?? "organic_search",
      last_touch_source: source ?? "Google Organic",
      last_touch_utm_campaign: campaign ?? "",
      first_touch_channel: first ?? "direct",
      first_touch_source: "Direct Traffic",
    },
    ...rest,
  };
}

describe("lead source and conversion report", () => {
  it("groups by last touch or first touch", () => {
    const leads = [lead({ channel: "paid_social", source: "Facebook", campaign: "spring" }), lead(), lead({ channel: "organic_search" })];
    const last = buildChannelReport(leads, { ...EMPTY_FILTERS, touch: "last" });
    expect(last.byChannel).toEqual([{ label: "Organic search", count: 2 }, { label: "Paid social", count: 1 }]);
    expect(last.byCampaign).toEqual([{ label: NOT_TRACKED, count: 2 }, { label: "spring", count: 1 }]);
    const first = buildChannelReport(leads, { ...EMPTY_FILTERS, touch: "first" });
    expect(first.byChannel).toEqual([{ label: "Direct", count: 3 }]);
  });

  it("filters by date in dealership-local days", () => {
    const late = lead({ created_at: "2026-03-10T03:30:00Z" }); // 11:30 pm on Mar 9 in New York
    const a = buildChannelReport([late], { ...EMPTY_FILTERS, from: "2026-03-09", to: "2026-03-09" });
    const b = buildChannelReport([late], { ...EMPTY_FILTERS, from: "2026-03-10", to: "2026-03-10" });
    expect([a.leads, b.leads]).toEqual([1, 0]);
  });

  it("filters by channel, source and campaign together", () => {
    const leads = [lead({ channel: "paid_social", source: "Facebook", campaign: "spring" }), lead({ channel: "paid_social", source: "Instagram", campaign: "spring" }), lead({ channel: "paid_social", source: "Facebook", campaign: "fall" })];
    const r = buildChannelReport(leads, { ...EMPTY_FILTERS, channel: "Paid social", source: "Facebook", campaign: "spring" });
    expect(r.leads).toBe(1);
    expect(r.options.sources).toEqual(["Facebook", "Instagram"]);
  });

  it("counts appointment requests and computes the conversion rate only with leads", () => {
    const leads = [lead(), lead({ lead_type: "appointment" }), lead({ lead_type: "appointment" }), lead()];
    const r = buildChannelReport(leads);
    expect(r.leads).toBe(4);
    expect(r.appointmentRequests).toBe(2);
    expect(r.appointmentRequestRate).toBe(0.5);
    expect(buildChannelReport([]).appointmentRequestRate).toBeNull();
  });

  it("never infers a confirmed appointment or sale from a request or a status", () => {
    const leads = [lead({ lead_type: "appointment", status: "won" }), lead({ lead_type: "availability", status: "won", details: { request_kind: "purchase" } })];
    const r = buildChannelReport(leads);
    expect(r.confirmedAppointments.status).toBe("unavailable");
    expect(r.confirmedSales.status).toBe("unavailable");
    expect(r.confirmedSaleRate).toBeNull();
    expect(r.qualified.status).toBe("unavailable");
  });

  it("counts confirmed outcomes only for linked leads inside the filters", () => {
    const a = lead({ lead_type: "appointment" });
    const b = lead();
    const r = buildChannelReport([a, b], EMPTY_FILTERS, { confirmedAppointmentLeadIds: new Set([a.id!, "unknown-id"]), completedPurchaseLeadIds: new Set() });
    expect(r.confirmedAppointments).toEqual({ status: "available", count: 1 });
    expect(r.confirmedSales).toEqual({ status: "available", count: 0 });
    expect(r.confirmedAppointmentRate).toBe(0.5);
  });

  it("leads saved before attribution are 'Not tracked', not guessed", () => {
    expect(touchOf(null, "last")).toEqual({ channel: NOT_TRACKED, source: NOT_TRACKED, campaign: NOT_TRACKED });
    expect(touchOf({}, "first").channel).toBe(NOT_TRACKED);
  });

  it("date presets end today and count days inclusively", () => {
    const r = presetRange(7, Date.parse("2026-03-10T15:00:00Z"));
    expect(r).toEqual({ from: "2026-03-04", to: "2026-03-10" });
  });

  it("renders filters, definitions, an empty state and an error state", () => {
    const html = renderToString(React.createElement(ChannelReportPanel, { leads: [lead()], loading: false }));
    expect(html).toContain("What the numbers mean");
    expect(html).toContain("Not reported");
    expect(renderToString(React.createElement(ChannelReportPanel, { leads: null, loading: false }))).toContain("No figures are shown");
    expect(renderToString(React.createElement(ChannelReportPanel, { leads: [], loading: false }))).toContain("No leads match these filters");
  });
});

/* -------------------------------------------------------------------------- */
/* Meta agent: read-only                                                       */
/* -------------------------------------------------------------------------- */

const row = (o: Partial<MetaInsightRow> = {}): MetaInsightRow => ({ campaignId: "1", campaignName: "A", start: "2026-03-01", end: "2026-03-07", currency: "USD", spend: 100, impressions: 10000, clicks: 200, leads: 10, ...o });

describe("Meta analysis", () => {
  it("derives CTR, CPC, CPM and cost per lead, and leaves them null when the denominator is zero", () => {
    const s = summarizeCampaign(row());
    expect(s).toMatchObject({ ctr: 0.02, cpc: 0.5, cpm: 10, costPerLead: 10 });
    const empty = summarizeCampaign(row({ impressions: 0, clicks: 0, leads: 0 }));
    expect([empty.ctr, empty.cpc, empty.cpm, empty.costPerLead]).toEqual([null, null, null, null]);
  });

  it("refuses to compare different date ranges or currencies", () => {
    expect(compareCampaigns([row(), row({ campaignId: "2", end: "2026-03-14" })])).toMatchObject({ comparable: false });
    expect(compareCampaigns([row(), row({ campaignId: "2", currency: "CAD" })])).toMatchObject({ comparable: false });
    expect(compareCampaigns([])).toMatchObject({ comparable: false });
  });

  it("every suggestion carries the evidence behind it, and none is made without data", () => {
    const comparison = compareCampaigns([row({ campaignId: "1", campaignName: "Cheap", spend: 100, leads: 20 }), row({ campaignId: "2", campaignName: "Costly", spend: 300, leads: 10 }), row({ campaignId: "3", campaignName: "New", impressions: 200, clicks: 3, leads: 0, spend: 5 })]);
    const out = suggest(comparison, { websiteLeadsFromMeta: 4 });
    expect(out.length).toBeGreaterThan(0);
    for (const s of out) expect(s.evidence.length, s.id).toBeGreaterThan(15);
    expect(out.find((s) => s.id === "cpl-2")?.evidence).toMatch(/30\.00 per lead versus USD 5\.00/);
    expect(out.find((s) => s.id === "data-3")).toBeTruthy();
    expect(out.find((s) => s.id === "tracking-mismatch")).toBeTruthy();
    expect(suggest({ comparable: false, reason: "x" })).toEqual([]);
  });

  it("previews are never executed, always need approval, and state the exact action and how to undo it", () => {
    const previews = [
      previewAction({ type: "pause_campaign", campaignId: "9", campaignName: "Spring" }),
      previewAction({ type: "resume_campaign", campaignId: "9", campaignName: "Spring" }),
      previewAction({ type: "change_budget", campaignId: "9", campaignName: "Spring", fromDaily: 10, toDaily: 20, currency: "USD" }),
      previewAction({ type: "edit_creative", campaignId: "9", campaignName: "Spring", summary: "new headline" }),
      previewAction({ type: "create_draft_campaign", campaignName: "New", objective: "LEADS" }),
      previewAction({ type: "publish_changes", campaignId: "9", campaignName: "Spring" }),
    ];
    for (const p of previews) {
      expect(p.executes).toBe(false);
      expect(p.requiresApproval).toBe(true);
      expect(p.exactAction.length).toBeGreaterThan(10);
      expect(p.recovery.length).toBeGreaterThan(5);
      expect(p.requiredChecks.join(" ")).toMatch(/signed in with permission/);
      expect(p.auditRecord).toMatchObject({ approvedBy: null, executedAt: null });
    }
    expect(previews[2]!.exactAction).toContain("from USD 10.00 to USD 20.00");
    expect(previews[2]!.recovery).toContain("USD 10.00");
  });

  it("only read requests to insight and structure endpoints are allowed", () => {
    expect(isReadOnlyMetaRequest("GET", "/v19.0/act_123/insights?fields=spend")).toBe(true);
    expect(isReadOnlyMetaRequest("GET", "/v19.0/act_123/campaigns")).toBe(true);
    expect(isReadOnlyMetaRequest("POST", "/v19.0/act_123/campaigns")).toBe(false);
    expect(isReadOnlyMetaRequest("DELETE", "/v19.0/123")).toBe(false);
    expect(isReadOnlyMetaRequest("GET", "/v19.0/act_123/insights?method=post")).toBe(false);
    expect(isReadOnlyMetaRequest("GET", "/v19.0/me/accounts")).toBe(false);
  });

  it("the module and the dashboard contain no Meta network call or write endpoint", () => {
    for (const file of ["src/lib/meta-agent.ts", "src/components/admin/MarketingChannels.tsx"]) {
      const source = read(file);
      expect(source, file).not.toMatch(/fetch\(|graph\.facebook\.com|XMLHttpRequest|access_token\s*=/);
    }
    expect(read("src/routes/admin.marketing.tsx")).not.toMatch(/graph\.facebook\.com/);
  });
});

/* -------------------------------------------------------------------------- */
/* SEO content agent                                                           */

describe("Marketing Hub channel tabs", () => {
  const hub = read("src/routes/admin.marketing.tsx");

  it("adds the Channel Report and Social Channels tabs, each with a panel", () => {
    for (const tab of ["channels", "social"]) {
      expect(hub).toContain(`<TabsContent value="${tab}">`);
      expect(hub).toMatch(new RegExp(`\["${tab}", "[^"]+", [A-Za-z0-9]+\]`));
    }
  });

  it("the channel modules do not touch lead forwarding, tracking, publishing or finance code", () => {
    for (const file of ["src/lib/marketing-channel-report.ts", "src/lib/marketing-social.ts", "src/lib/meta-agent.ts", "src/components/admin/MarketingChannels.tsx"]) {
      expect(read(file), file).not.toMatch(/sendLeadToGhl|deliverStoredLeadToGhl|postToGhl|from "[^"]*(analytics|attribution|purchases|lease-to-own|finance)"|upsertAutoseoArticle|setAutoseoPublished/);
    }
  });
});
