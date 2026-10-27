// Read-only view of a lead's GoHighLevel delivery state, for the staff Customers list.
//
// The state is written by the server (ghl-delivery.server.ts) onto the lead's own details. This module only
// reads it: it never sends, retries or updates anything, and it exposes fixed labels only (no HTTP codes, errors or URLs).
import { isGhlForwardedLeadType } from "./ghl-webhook.functions";

/** A "sending" claim older than this was abandoned. Kept equal to STALE_CLAIM_MS on the server (a test checks it). */
export const GHL_STALE_SENDING_MS = 2 * 60 * 1000;

export type GhlDeliveryKind =
  | "delivered"
  | "sending"
  | "stale_sending"
  | "failed"
  | "unconfirmed"
  | "not_tracked"
  | "not_applicable";

export type GhlDeliveryStatus = {
  kind: GhlDeliveryKind;
  label: string;
  /** Short fixed explanation for a tooltip. */
  hint: string;
  needsFollowUp: boolean;
};

type LeadLike = { lead_type: string; details?: Record<string, unknown> | null };

const STATUSES: Record<GhlDeliveryKind, Omit<GhlDeliveryStatus, "kind">> = {
  delivered: { label: "Delivered", hint: "GoHighLevel accepted this lead.", needsFollowUp: false },
  sending: { label: "Sending", hint: "Delivery to GoHighLevel is in progress.", needsFollowUp: false },
  stale_sending: {
    label: "Sending (stalled)",
    hint: "Delivery started more than 2 minutes ago and was never confirmed. Check GoHighLevel.",
    needsFollowUp: true,
  },
  failed: { label: "Failed", hint: "GoHighLevel refused this lead. Check GoHighLevel and contact the customer.", needsFollowUp: true },
  unconfirmed: {
    label: "Unconfirmed",
    hint: "GoHighLevel may or may not have received this lead. Check GoHighLevel before contacting the customer.",
    needsFollowUp: true,
  },
  not_tracked: { label: "Not tracked", hint: "Submitted before delivery tracking, or no delivery recorded.", needsFollowUp: false },
  not_applicable: { label: "—", hint: "This request type is not sent to GoHighLevel from the website.", needsFollowUp: false },
};

function result(kind: GhlDeliveryKind): GhlDeliveryStatus {
  return { kind, ...STATUSES[kind] };
}

/**
 * Missing or unrecognized delivery metadata is "Not tracked", never a failure. A "sending" state whose time is
 * missing or unreadable cannot be shown to be recent, so it is treated as stalled.
 */
export function getGhlDeliveryStatus(lead: LeadLike, now: number = Date.now()): GhlDeliveryStatus {
  if (!isGhlForwardedLeadType(lead.lead_type)) return result("not_applicable");
  const details = lead.details ?? {};
  const raw = details["ghl_delivery_state"];
  const state = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  switch (state) {
    case "delivered":
      return result("delivered");
    case "failed":
      return result("failed");
    case "unconfirmed":
      return result("unconfirmed");
    case "sending": {
      const at = details["ghl_delivery_at"];
      const since = typeof at === "string" ? Date.parse(at) : Number.NaN;
      return result(Number.isFinite(since) && now - since <= GHL_STALE_SENDING_MS ? "sending" : "stale_sending");
    }
    default:
      return result("not_tracked");
  }
}

/** True for failed, unconfirmed, and sending states older than two minutes. */
export function needsGhlFollowUp(lead: LeadLike, now: number = Date.now()): boolean {
  return getGhlDeliveryStatus(lead, now).needsFollowUp;
}
