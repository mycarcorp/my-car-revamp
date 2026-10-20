import { describe, expect, it } from "vitest";
import {
  aggregateLeadAttribution,
  aggregateLeadOutcomes,
  buildAttributionCsv,
  filterLeadsByCreatedRange,
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

describe("verified marketing outcomes", () => {
  const leads: AttributionLeadRow[] = [
    {
      id: "lead-appointment",
      lead_type: "appointment",
      created_at: "2026-10-20T23:59:59.999Z",
      details: {
        first_touch_source: "Google Organic",
        first_touch_source_evidence: "inferred",
        last_touch_source: "TikTok",
        last_touch_source_evidence: "confirmed",
      },
    },
    {
      id: "lead-purchase",
      lead_type: "purchase",
      created_at: "2026-10-21T00:00:00.000Z",
      details: { lead_source: "Direct Traffic", source_evidence: "unknown" },
    },
    { id: "lead-no-attribution", lead_type: "appointment", details: null },
  ];

  it("separates appointment requests from confirmed linked appointment rows", () => {
    const report = aggregateLeadOutcomes({
      leads,
      appointmentRequestsTotal: 2,
      appointmentRequestsAvailable: true,
      appointmentRequestsComplete: true,
      appointments: [
        { id: "appt-1", lead_id: "lead-appointment", confirmed: true },
        { id: "appt-1", lead_id: "lead-appointment", confirmed: true },
        { id: "appt-pending", lead_id: "lead-appointment", confirmed: false },
        { id: "appt-wrong-lead", lead_id: "lead-purchase", confirmed: true },
      ],
      confirmedAppointmentMissingRelationship: 1,
      appointmentsComplete: true,
      purchases: [],
      unlinkedCompletedPurchases: 0,
      completedPurchaseMissingRelationship: 0,
      purchasesComplete: true,
      leadCohortComplete: true,
    });

    expect(report.appointmentRequests.count).toBe(2);
    expect(report.appointmentRequestsWithoutRecord).toMatchObject({ count: 1, status: "available" });
    expect(report.confirmedAppointments.count).toBe(1);
    expect(report.confirmedAppointments.missingRelationship).toBe(2);
    expect(report.confirmedAppointments.byFirstTouchSource).toMatchObject([
      { source: "Google Organic", evidence: "inferred", count: 1 },
    ]);
    expect(report.confirmedAppointments.byLastTouchSource).toMatchObject([
      { source: "TikTok", evidence: "confirmed", count: 1 },
    ]);
  });

  it("counts completed linked purchases once, excludes pending and isolates unlinked completed", () => {
    const report = aggregateLeadOutcomes({
      leads: [...leads,
        { id: "purchase-fallback", lead_type: "availability", details: { request_kind: "purchase", lead_source: "TikTok", source_evidence: "inferred" } },
        { id: "ordinary-availability", lead_type: "availability", details: { request_kind: "vehicle_availability", lead_source: "Reddit" } },
      ],
      appointmentRequestsTotal: 2,
      appointmentRequestsAvailable: true,
      appointmentRequestsComplete: true,
      appointments: [],
      confirmedAppointmentMissingRelationship: 0,
      appointmentsComplete: true,
      purchases: [
        { id: 5, lead_id: "lead-purchase", status: "completed" },
        { id: 5, lead_id: "lead-purchase", status: "completed" },
        { id: 6, lead_id: "lead-purchase", status: "submitted" },
        { id: 7, lead_id: null, status: "completed" },
        { id: 8, lead_id: "lead-appointment", status: "completed" },
        { id: 9, lead_id: "lead-no-attribution", status: "completed" },
        { id: 10, lead_id: "purchase-fallback", status: "completed" },
        { id: 11, lead_id: "ordinary-availability", status: "completed" },
      ],
      unlinkedCompletedPurchases: 1,
      completedPurchaseMissingRelationship: 1,
      purchasesComplete: true,
      leadCohortComplete: true,
    });

    expect(report.completedPurchases.count).toBe(2);
    expect(report.completedPurchases.unlinkedCompleted).toBe(1);
    expect(report.completedPurchases.missingRelationship).toBe(5);
    expect(report.completedPurchases.unknownAttribution).toBe(1);
    expect(report.completedPurchases.byLastTouchSource).toMatchObject([
      { source: "Direct Traffic", evidence: "unknown", count: 1 },
      { source: "TikTok", evidence: "inferred", count: 1 },
    ]);
  });

  it("returns unavailable rather than zero when outcome schema access is missing", () => {
    const report = aggregateLeadOutcomes({
      leads,
      appointmentRequestsTotal: 2,
      appointmentRequestsAvailable: true,
      appointmentRequestsComplete: true,
      appointments: null,
      confirmedAppointmentMissingRelationship: null,
      appointmentsComplete: false,
      purchases: null,
      unlinkedCompletedPurchases: null,
      completedPurchaseMissingRelationship: null,
      purchasesComplete: false,
      leadCohortComplete: true,
    });

    expect(report.confirmedAppointments).toMatchObject({ status: "unavailable", count: null });
    expect(report.appointmentRequestsWithoutRecord).toMatchObject({ status: "unavailable", count: null });
    expect(report.completedPurchases).toMatchObject({ status: "unavailable", count: null, unlinkedStatus: "unavailable", unlinkedCompleted: null });
  });

  it("reports request totals unavailable when the exact lead count cannot be read", () => {
    const report = aggregateLeadOutcomes({
      leads,
      appointmentRequestsTotal: null,
      appointmentRequestsAvailable: false,
      appointmentRequestsComplete: false,
      appointments: [],
      confirmedAppointmentMissingRelationship: 0,
      appointmentsComplete: true,
      purchases: [],
      unlinkedCompletedPurchases: 0,
      completedPurchaseMissingRelationship: 0,
      purchasesComplete: true,
      leadCohortComplete: false,
    });
    expect(report.appointmentRequests).toMatchObject({ status: "unavailable", count: null, complete: false });
  });

  it("uses inclusive lead-created start and exclusive end for the outcome cohort", () => {
    const range = resolveAttributionRange(
      { preset: "custom", startDate: "2026-10-20", endDate: "2026-10-20" },
      new Date("2026-10-21T12:00:00Z"),
    );
    const cohort = filterLeadsByCreatedRange([
      { id: "before", created_at: "2026-10-19T23:59:59.999Z" },
      { id: "start", created_at: "2026-10-20T00:00:00.000Z" },
      { id: "end", created_at: "2026-10-20T23:59:59.999Z" },
      { id: "after", created_at: "2026-10-21T00:00:00.000Z" },
    ], range);
    expect(cohort.map((lead) => lead.id)).toEqual(["start", "end"]);
  });

  it("keeps appointment availability independent from purchase-schema availability", () => {
    const report = aggregateLeadOutcomes({
      leads,
      appointmentRequestsTotal: 2,
      appointmentRequestsAvailable: true,
      appointmentRequestsComplete: true,
      appointments: [],
      confirmedAppointmentMissingRelationship: 0,
      appointmentsComplete: true,
      purchases: null,
      unlinkedCompletedPurchases: null,
      completedPurchaseMissingRelationship: null,
      purchasesComplete: false,
      leadCohortComplete: true,
    });
    expect(report.confirmedAppointments).toMatchObject({ status: "available", count: 0, complete: true });
    expect(report.completedPurchases).toMatchObject({ status: "unavailable", count: null, complete: false });
  });
});