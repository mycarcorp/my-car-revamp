import { describe, expect, it } from "vitest";
import {
  aggregateLeadAttribution,
  buildAttributionCsv,
  resolveAttributionRange,
  type AttributionLeadRow,
} from "./marketing-attribution";

describe("marketing attribution date ranges", () => {
  it("resolves presets and custom end dates to UTC exclusive boundaries", () => {
    const preset = resolveAttributionRange({ preset: 7 }, new Date("2026-10-21T15:30:00.000Z"));
    expect(preset).toMatchObject({
      startDate: "2026-10-15",
      endDate: "2026-10-21",
      startInclusive: "2026-10-15T00:00:00.000Z",
      endExclusive: "2026-10-22T00:00:00.000Z",
    });
    expect(resolveAttributionRange(
      { preset: "custom", startDate: "2024-02-29", endDate: "2024-03-01" },
      new Date("2026-10-21T00:00:00.000Z"),
    ).endExclusive).toBe("2024-03-02T00:00:00.000Z");
  });

  it("rejects invalid, future, reversed, and unbounded custom ranges", () => {
    const now = new Date("2026-10-21T12:00:00.000Z");
    expect(() => resolveAttributionRange({ preset: "custom", startDate: "2026-02-30", endDate: "2026-03-01" }, now)).toThrow();
    expect(() => resolveAttributionRange({ preset: "custom", startDate: "2026-10-22", endDate: "2026-10-22" }, now)).toThrow();
    expect(() => resolveAttributionRange({ preset: "custom", startDate: "2026-10-02", endDate: "2026-10-01" }, now)).toThrow();
    expect(() => resolveAttributionRange({ preset: "custom", startDate: "2025-10-20", endDate: "2026-10-21" }, now)).toThrow();
  });
});

describe("marketing attribution aggregation", () => {
  const rows: AttributionLeadRow[] = [
    {
      lead_type: "trade",
      created_at: "2026-10-20T23:30:00-04:00",
      details: {
        lead_source: "Google Ads",
        lead_medium: "cpc",
        utm_source: "google",
        utm_medium: "CPC",
        utm_campaign: "vehicle_campaign",
        source_evidence: "inferred",
        first_touch_source: "Google Organic",
        first_touch_medium: "organic",
        first_touch_utm_campaign: "seo_campaign",
        first_touch_source_evidence: "inferred",
        last_touch_source: "Google Ads",
        last_touch_medium: "cpc",
        last_touch_utm_campaign: "vehicle_campaign",
        last_touch_source_evidence: "inferred",
        intent: "trade",
      },
    },
    {
      lead_type: "finance",
      created_at: "2026-10-21T11:00:00Z",
      details: {
        lead_source: "google ads",
        lead_medium: "cpc",
        utm_source: "google_ads_campaign",
        source_evidence: "confirmed",
      },
    },
    {
      lead_type: "trade",
      created_at: "2026-10-21T10:00:00Z",
      details: {
        lead_source: "Direct Traffic",
        source_evidence: "unknown",
        utm_source: "",
        intent: "sell",
        request_kind: "sell_offer",
      },
    },
    {
      lead_type: "availability",
      created_at: "2026-10-21T12:00:00Z",
      details: null,
    },
  ];

  it("aggregates source evidence, raw UTMs, forms, intent, touch gaps, and real UTC days", () => {
    const report = aggregateLeadAttribution(rows, { startDate: "2026-10-20", endDate: "2026-10-21" }, 4, "2026-10-21T13:00:00Z");
    expect(report).toMatchObject({
      scanned: 4,
      total: 4,
      complete: true,
      timezone: "UTC",
      bySource: [
        { source: "Direct Traffic", count: 1, evidence: "unknown", rawUtmSources: [{ label: "Unattributed", count: 1 }] },
        {
          source: "Google Ads",
          count: 1,
          evidence: "inferred",
          rawUtmSources: [{ label: "google", count: 1 }],
          rawUtmMediums: [{ label: "CPC", count: 1 }],
          rawUtmCampaigns: [{ label: "vehicle_campaign", count: 1 }],
        },
        { source: "Google Ads", count: 1, evidence: "confirmed", rawUtmSources: [{ label: "google_ads_campaign", count: 1 }] },
        { source: "Unattributed", count: 1, evidence: "unknown" },
      ],
      byLeadType: [{ leadType: "trade", count: 2 }, { leadType: "availability", count: 1 }, { leadType: "finance", count: 1 }],
      byIntent: [{ intent: "Unspecified", count: 2 }, { intent: "sell", count: 1 }, { intent: "trade", count: 1 }],
      byRequestKind: [{ requestKind: "Unspecified", count: 3 }, { requestKind: "sell_offer", count: 1 }],
      firstTouch: {
        missing: 3,
        bySource: [{ source: "Google Organic", count: 1, evidence: "inferred" }],
      },
      lastTouch: {
        missing: 1,
        bySource: [
          { source: "Direct Traffic", count: 1, evidence: "unknown" },
          { source: "Google Ads", count: 1, evidence: "confirmed" },
          { source: "Google Ads", count: 1, evidence: "inferred" },
        ],
      },
      daily: [{ date: "2026-10-21", count: 4 }],
    });
  });

  it("retains exact total and marks all breakdowns partial when row coverage is capped", () => {
    const report = aggregateLeadAttribution(rows.slice(0, 1), { startDate: "2026-10-20", endDate: "2026-10-21" }, 12000);
    expect(report).toMatchObject({ scanned: 1, total: 12000, complete: false });
  });

  it("exports a PII-free CSV and neutralizes formula-leading values", () => {
    const report = aggregateLeadAttribution([
      {
        lead_type: "trade",
        created_at: "2026-10-21T12:00:00Z",
        details: {
          lead_source: "=HYPERLINK(\"https://bad\")",
          lead_medium: "+cmd",
          utm_source: "=SUM(1,1)",
          utm_campaign: "-danger",
          source_evidence: "unknown",
          full_name: "Customer Name",
          email: "private@example.com",
          phone: "5405550123",
        },
      },
    ], { startDate: "2026-10-21", endDate: "2026-10-21" }, 1);
    const csv = buildAttributionCsv(report);
    expect(csv).toContain("'=SUM(1,1)");
    expect(csv).toContain("'+cmd");
    expect(csv).toContain("'-danger");
    expect(csv).not.toContain("Customer Name");
    expect(csv).not.toContain("private@example.com");
    expect(csv).not.toContain("5405550123");
    expect(csv.split("\r\n")[0]).not.toMatch(/full_name|email|phone/i);
    const columns = csv.split("\r\n")[0]!.split(",").length;
    expect(csv.split("\r\n").every((line) => (line.match(/","/g) ?? []).length === columns - 1)).toBe(true);
    expect(csv).toContain('"coverage"');
    expect(csv).toContain('"generated_at_utc"');
  });
});