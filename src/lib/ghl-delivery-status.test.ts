import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GHL_STALE_SENDING_MS, getGhlDeliveryStatus, needsGhlFollowUp } from "./ghl-delivery-status";
import { STALE_CLAIM_MS } from "./ghl-delivery.server";

const NOW = Date.parse("2026-11-01T12:00:00.000Z");
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

function lead(details: Record<string, unknown> | null, leadType = "contact") {
  return { lead_type: leadType, details };
}

describe("GHL delivery status for the staff list", () => {
  it("shows each recorded delivery state", () => {
    expect(getGhlDeliveryStatus(lead({ ghl_delivery_state: "delivered" }), NOW)).toMatchObject({ kind: "delivered", label: "Delivered", needsFollowUp: false });
    expect(getGhlDeliveryStatus(lead({ ghl_delivery_state: "failed" }), NOW)).toMatchObject({ kind: "failed", label: "Failed", needsFollowUp: true });
    expect(getGhlDeliveryStatus(lead({ ghl_delivery_state: "unconfirmed" }), NOW)).toMatchObject({ kind: "unconfirmed", label: "Unconfirmed", needsFollowUp: true });
    expect(getGhlDeliveryStatus(lead({ ghl_delivery_state: "sending", ghl_delivery_at: iso(-10_000) }), NOW)).toMatchObject({ kind: "sending", label: "Sending", needsFollowUp: false });
  });

  it("treats leads without delivery metadata as Not tracked, never as failed", () => {
    for (const details of [null, {}, { lead_source: "Google" }, { ghl_delivery_state: "" }, { ghl_delivery_state: 7 }, { ghl_delivery_state: "something-else" }]) {
      const status = getGhlDeliveryStatus(lead(details as Record<string, unknown> | null), NOW);
      expect(status).toMatchObject({ kind: "not_tracked", label: "Not tracked", needsFollowUp: false });
    }
  });

  it("flags a sending state only after two minutes, and when its time is unknown", () => {
    const at = (ms: number) => lead({ ghl_delivery_state: "sending", ghl_delivery_at: iso(ms) });
    expect(needsGhlFollowUp(at(-(GHL_STALE_SENDING_MS - 1)), NOW)).toBe(false);
    expect(needsGhlFollowUp(at(-GHL_STALE_SENDING_MS), NOW)).toBe(false);
    expect(needsGhlFollowUp(at(-(GHL_STALE_SENDING_MS + 1)), NOW)).toBe(true);
    expect(getGhlDeliveryStatus(at(-(GHL_STALE_SENDING_MS + 1)), NOW).kind).toBe("stale_sending");
    expect(needsGhlFollowUp(lead({ ghl_delivery_state: "sending" }), NOW)).toBe(true);
    expect(needsGhlFollowUp(lead({ ghl_delivery_state: "sending", ghl_delivery_at: "not a date" }), NOW)).toBe(true);
  });

  it("uses the same stale limit as the server", () => {
    expect(GHL_STALE_SENDING_MS).toBe(STALE_CLAIM_MS);
  });

  it("does not report delivery for request types the website does not send to GHL", () => {
    expect(getGhlDeliveryStatus(lead({ ghl_delivery_state: "failed" }, "purchase_request"), NOW)).toMatchObject({ kind: "not_applicable", needsFollowUp: false });
  });

  it("covers every website lead type that is forwarded", () => {
    for (const type of ["finance", "availability", "trade", "appointment", "contact"]) {
      expect(needsGhlFollowUp(lead({ ghl_delivery_state: "unconfirmed" }, type), NOW)).toBe(true);
    }
  });

  it("exposes only fixed labels: no HTTP code, attempts, errors, URLs or customer data", () => {
    const status = getGhlDeliveryStatus(
      lead({
        ghl_delivery_state: "failed",
        ghl_delivery_http: "422",
        ghl_delivery_attempts: "3",
        error: "boom https://example.test/secret",
        email: "pat@example.test",
      }),
      NOW,
    );
    const text = JSON.stringify(status);
    expect(text).not.toMatch(/422|boom|example\.test|pat@|https?:/);
  });
});

describe("Needs GHL Follow-up filter combined with the existing filters", () => {
  type Row = { id: string; lead_type: string; full_name: string; details: Record<string, unknown> };
  const rows: Row[] = [
    { id: "a", lead_type: "contact", full_name: "Alex Rivera", details: { ghl_delivery_state: "delivered" } },
    { id: "b", lead_type: "contact", full_name: "Blair Chen", details: { ghl_delivery_state: "failed" } },
    { id: "c", lead_type: "trade", full_name: "Casey Blair", details: { ghl_delivery_state: "unconfirmed" } },
    { id: "d", lead_type: "appointment", full_name: "Drew Lee", details: { ghl_delivery_state: "sending", ghl_delivery_at: iso(-5 * 60_000) } },
    { id: "e", lead_type: "appointment", full_name: "Eli Park", details: { ghl_delivery_state: "sending", ghl_delivery_at: iso(-5_000) } },
    { id: "f", lead_type: "finance", full_name: "Old Lead", details: {} },
  ];

  // Mirrors the route's filter order: type, follow-up, then search over visible text including the badge label.
  function filter(options: { type?: string; followUpOnly?: boolean; search?: string }) {
    const needle = (options.search ?? "").trim().toLowerCase();
    return rows
      .filter((row) => !options.type || row.lead_type === options.type)
      .filter((row) => !options.followUpOnly || needsGhlFollowUp(row, NOW))
      .filter((row) => !needle || `${row.full_name} ${getGhlDeliveryStatus(row, NOW).label}`.toLowerCase().includes(needle))
      .map((row) => row.id);
  }

  it("lists failed, unconfirmed and stalled sending leads only", () => {
    expect(filter({ followUpOnly: true })).toEqual(["b", "c", "d"]);
  });

  it("leaves delivered, recent sending, and old untracked leads out", () => {
    const ids = filter({ followUpOnly: true });
    for (const excluded of ["a", "e", "f"]) expect(ids).not.toContain(excluded);
  });

  it("narrows with the request type and with search", () => {
    expect(filter({ followUpOnly: true, type: "contact" })).toEqual(["b"]);
    expect(filter({ followUpOnly: true, search: "blair" })).toEqual(["b", "c"]);
    expect(filter({ followUpOnly: true, search: "unconfirmed" })).toEqual(["c"]);
    expect(filter({ followUpOnly: true, type: "appointment", search: "lee" })).toEqual(["d"]);
  });

  it("is off by default, so the list is unchanged", () => {
    expect(filter({})).toEqual(["a", "b", "c", "d", "e", "f"]);
  });
});

describe("the staff view is read-only", () => {
  const route = readFileSync("src/routes/admin.customers.tsx", "utf8");
  const statusModule = readFileSync("src/lib/ghl-delivery-status.ts", "utf8");

  it("the status module has no network, database or server-function access", () => {
    expect(statusModule).not.toMatch(/fetch\(|supabase|createServerFn|process\.env|\.server"|sendLeadToGhl|deliverLeadToGhl|postToGhl/);
  });

  it("the Customers route adds no resend, retry or lead update", () => {
    expect(route).not.toMatch(/sendLeadToGhl|deliverStoredLeadToGhl|deliverLeadToGhl|postToGhl|ghl-webhook\.server|ghl-delivery\.server/);
    expect(route).not.toMatch(/\.update\(/);
    // The only database write in the route is the existing lead removal.
    expect((route.match(/supabase\s*\n?\s*\.from\("leads"\)/g) ?? []).length).toBe(1);
  });

  it("wires the follow-up toggle into the same list as type, date and search", () => {
    expect(route).toContain("if (followUpOnly && !needsGhlFollowUp(lead, now)) return false;");
    expect(route).toContain("followUpOnly, setFollowUpOnly");
    expect(route).toMatch(/\[leads, type, dateFilter, selectedCalendarDate, search, followUpOnly\]/);
    expect(route).toContain("Needs GHL Follow-up");
  });

  it("shows the badge on both the mobile list and the desktop table, using the fixed-label component", () => {
    expect((route.match(/<GhlDeliveryBadge/g) ?? []).length).toBe(2);
    expect(route).toContain("GHL delivery");
  });
});
