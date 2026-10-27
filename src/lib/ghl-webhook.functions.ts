import { createServerFn } from "@tanstack/react-start";
import { logSafeError } from "./safe-log";
import type { GhlPostOutcome } from "./ghl-webhook.server";

/** Website lead types that mirror to GoHighLevel, mapped to their event_type. */
const EVENT_TYPES: Record<string, string> = {
  finance: "financing",
  availability: "check_availability",
  trade: "sell_or_trade",
  appointment: "book_a_visit",
  // Contact-page and Car Finder inquiries. Car Finder is told apart by details.request_type.
  contact: "website_contact",
};

const CAR_FINDER_EVENT_TYPE = "car_finder_request";

/** Car Finder budget: a plain non-negative number, as the form's numeric field allows. Anything else is dropped. */
function carFinderBudget(value: unknown): string {
  const text = str(value).trim();
  return /^\d{1,9}(\.\d{1,2})?$/.test(text) ? text : "";
}

/** Car Finder financing preference: only the form's three choices. */
function carFinderFinancingPreference(value: unknown): string {
  const text = str(value).trim();
  return text === "yes" || text === "no" || text === "unsure" ? text : "";
}

/** True for lead types the website mirrors to GoHighLevel. Finance-adjacent and CEO-owned flows have their own senders. */
export function isGhlForwardedLeadType(leadType: string): boolean {
  return Object.prototype.hasOwnProperty.call(EVENT_TYPES, leadType);
}

/** Keys the website sets itself; a form field with one of these names can never replace them. */
const RESERVED_KEYS = new Set(["event_type", "source", "submitted_at", "website_lead_id", "delivery_attempt", "full_name", "email", "phone", "message"]);

const MAX_FLAT_KEYS = 150;

/** Flattens a parsed JSON value into text fields named parent_child (arrays: parent_1_child). */
function flattenInto(out: Record<string, string>, prefix: string, value: unknown, depth: number): void {
  if (Object.keys(out).length >= MAX_FLAT_KEYS) return;
  if (value === null || value === undefined) return;
  if (typeof value === "object") {
    if (depth >= 4) return;
    const entries = Array.isArray(value) ? value.map((v, i) => [String(i + 1), v] as const) : Object.entries(value as Record<string, unknown>);
    for (const [k, v] of entries) flattenInto(out, `${prefix}_${k.replace(/[^A-Za-z0-9]+/g, "_")}`, v, depth + 1);
    return;
  }
  const text = String(value);
  if (text !== "") out[prefix] = text.slice(0, 5000);
}

/**
 * Every non-empty saved form field as text, except internal delivery state and the website's own fixed keys. A field
 * that holds JSON (an address, an employer, a list of references) is sent both as the original text and as separate
 * flat fields, for example current_address_street, so each part can be mapped in the CRM.
 */
export function allFormFields(details: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(details)) {
    if (RESERVED_KEYS.has(key) || key.startsWith("ghl_delivery_")) continue;
    if (value === null || value === undefined || typeof value === "object") continue;
    const text = String(value);
    if (text === "") continue;
    out[key] = text.slice(0, 5000);
    const trimmed = text.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        flattenInto(out, key, JSON.parse(trimmed), 0);
      } catch {
        // Not JSON: the original text is already included.
      }
    }
  }
  return out;
}

/** Contact leads split into a general contact and a Car Finder request. */
export function ghlEventTypeFor(leadType: string, details: Record<string, unknown> = {}): string | null {
  if (!isGhlForwardedLeadType(leadType)) return null;
  if (leadType === "contact" && details["request_type"] === "car_finder") return CAR_FINDER_EVENT_TYPE;
  return EVENT_TYPES[leadType]!;
}

/**
 * Per-instance guard against forwarding the same submission twice (for example a repeated client call).
 * Keyed by the opaque lead_event_id; released again if delivery fails so a later attempt is still possible.
 */
const LEAD_EVENT_ID = /^mc_[a-f0-9-]{16,40}$/;
const forwardedLeadEvents = new Set<string>();
export function resetGhlForwardingStateForTests(): void {
  forwardedLeadEvents.clear();
}

function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return { first_name: parts[0] ?? "", last_name: "" };
  return { first_name: parts[0]!, last_name: parts.slice(1).join(" ") };
}

function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).slice(0, 2000);
}

export type GhlLeadInput = {
  leadType: string;
  fullName: string;
  email: string;
  phone?: string | null;
  message?: string | null;
  vehicleUrl?: string | null;
  vehicle?: {
    id?: string | null;
    vin?: string | null;
    stock_number?: string | null;
    year?: number | string | null;
    make?: string | null;
    model?: string | null;
    trim?: string | null;
    price?: number | string | null;
  } | null;
  details?: Record<string, unknown>;
};

const LEAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fire-and-forget mirror of a saved lead to the GoHighLevel incoming webhook.
 * The caller supplies only the ID of a lead it just saved. The server loads that stored lead, forwards it at most
 * once (delivery state is kept on the lead itself) and never forwards caller-supplied contact data, so this
 * endpoint cannot be used to push arbitrary records into GHL. Never fails the submission.
 */
export const sendLeadToGhl = createServerFn({ method: "POST" })
  .inputValidator((input: { leadId: string }) => {
    const leadId = typeof input?.leadId === "string" ? input.leadId.trim() : "";
    if (!LEAD_ID.test(leadId)) throw new Error("Invalid lead");
    return { leadId: leadId.toLowerCase() };
  })
  .handler(async ({ data }) => {
    const { deliverStoredLeadToGhl } = await import("./ghl-delivery.server");
    return deliverStoredLeadToGhl(data.leadId);
  });

type GhlLeadData = {
  leadType: string;
  fullName: string;
  email: string;
  phone: string;
  message: string;
  vehicleUrl: string;
  vehicle: GhlLeadInput["vehicle"];
  details: Record<string, unknown>;
  /** The stored lead's ID: sent to GHL as website_lead_id so a repeat can be recognised there. */
  leadId?: string;
  attempt?: number;
};

export type GhlDeliveryResult = {
  delivered: boolean;
  status: number | null;
  outcome: GhlPostOutcome;
};

/** Exported so error handling can be tested without the Start runtime. */
export async function deliverLeadToGhl(data: GhlLeadData): Promise<GhlDeliveryResult> {
  const event_type = ghlEventTypeFor(data.leadType, data.details)!;
  const d = data.details;
  const v = data.vehicle ?? {};
  const rawEventId = d["lead_event_id"];
  const eventId = typeof rawEventId === "string" && LEAD_EVENT_ID.test(rawEventId) ? rawEventId : null;
  if (eventId && forwardedLeadEvents.has(eventId)) return { delivered: true, status: null, outcome: "delivered" };

  const base: Record<string, unknown> = {
    event_type,
    source: "MyCar Website",
    full_name: data.fullName,
    ...splitName(data.fullName),
    email: data.email,
    phone: data.phone,
    message: data.message,
    submitted_at: new Date().toISOString(),
    ...(data.leadId ? { website_lead_id: data.leadId, delivery_attempt: String(data.attempt ?? 1) } : {}),
  };
  // Attribution fields (lead_source, utm_*, click IDs, first_/last_touch_*).
  for (const [k, val] of Object.entries(d)) {
    if (
      /^(lead_source|lead_medium|channel$|utm_|referrer$|landing_page$|conversion_page$|first_touch_|last_touch_)/.test(k) ||
      ["fbclid", "gclid", "gbraid", "wbraid", "ttclid", "li_fat_id", "rdt_cid", "msclkid"].includes(k)
    ) {
      base[k] = str(val);
    }
  }

  const vehicleFields: Record<string, unknown> = {
    vehicle_id: str(v.id),
    vin: str(v.vin),
    stock_number: str(v.stock_number),
    year: str(v.year),
    make: str(v.make),
    model: str(v.model),
    trim: str(v.trim),
    vehicle_url: data.vehicleUrl,
  };

  let payload: Record<string, unknown>;
  if (event_type === "financing") {
    payload = {
      ...base,
      ...vehicleFields,
      vehicle_of_interest: str(d["vehicle_of_interest"]),
      employment: str(d["employment"]),
      income_band: str(d["income_band"]),
      desired_payment: str(d["desired_payment"]),
      vehicle_price: str(d["vehicle_price"]),
      down_payment: str(d["down_payment"]),
      loan_term: str(d["loan_term"]),
      apr: str(d["apr"]),
    };
  } else if (event_type === "website_contact") {
    payload = { ...base };
  } else if (event_type === CAR_FINDER_EVENT_TYPE) {
    payload = {
      ...base,
      request_type: "car_finder",
      preferred_make: str(d["preferred_make"]),
      preferred_model: str(d["preferred_model"]),
      preferred_year_min: str(d["preferred_year_min"]),
      preferred_year_max: str(d["preferred_year_max"]),
      preferred_body_style: str(d["preferred_body_style"]),
      maximum_budget: carFinderBudget(d["maximum_budget"]),
      financing_needed: carFinderFinancingPreference(d["financing_needed"]),
      must_have_features: str(d["must_have_features"]),
    };
  } else if (event_type === "check_availability") {
    payload = { ...base, ...vehicleFields, vehicle_price: str(v.price) };
  } else if (event_type === "sell_or_trade") {
    const ymmParts = str(d["year_make_model"]).trim().split(/\s+/).filter(Boolean);
    payload = {
      ...base,
      vehicle_year: ymmParts[0] ?? "",
      vehicle_make: ymmParts[1] ?? "",
      vehicle_model: ymmParts.slice(2).join(" "),
      year_make_model: str(d["year_make_model"]),
      vin: str(d["vin"]),
      license_plate: str(d["plate"]),
      mileage: str(d["mileage"]),
      zip: str(d["zip"]),
      condition: str(d["condition"]),
      title_status: str(d["title_status"]),
      intent: str(d["intent"]),
    };
  } else {
    payload = {
      ...base,
      preferred_date: str(d["preferred_date"]),
      preferred_time: str(d["preferred_time"]),
      appointment_type: str(d["appointment_type"]),
      vehicle_of_interest: str(d["vehicle_of_interest"]),
      ...vehicleFields,
    };
  }

  // Every saved form field is sent for every form (management decision). The fixed fields built above win on a clash,
  // which keeps validated values (for example the Car Finder budget) and the website's own keys intact.
  payload = { ...allFormFields(d), ...payload };

  if (eventId) forwardedLeadEvents.add(eventId);
  try {
    const { postToGhlTimed } = await import("./ghl-webhook.server");
    const { status, outcome } = await postToGhlTimed(payload);
    // Only a refusal (4xx) frees the guard: an unconfirmed delivery may already have been processed, so a repeat
    // could create a duplicate contact or alert.
    if (outcome === "rejected" && eventId) forwardedLeadEvents.delete(eventId);
    if (eventId && forwardedLeadEvents.size > 500) forwardedLeadEvents.clear();
    return { delivered: outcome === "delivered", status, outcome };
  } catch (error) {
    logSafeError("ghl-webhook.request", error);
    return { delivered: false, status: null, outcome: "unconfirmed" };
  }
}
