// Server-only, durable delivery of a stored website lead to GoHighLevel.
//
// Delivery state lives on the lead's own `details` as flat string fields, so no schema change is needed:
//   ghl_delivery_state     sending | delivered | failed | unconfirmed
//   ghl_delivery_attempts  number of sends started
//   ghl_delivery_http      last HTTP status from GHL, when there was one
//   ghl_delivery_at        ISO time of the last state change
//
// A lead is claimed before it is sent, using an update that only succeeds if the row has not changed since it was
// read, so two callers (a repeated click, two server instances) can never both send it. "delivered", "sending"
// and "unconfirmed" are never sent again automatically: an unconfirmed delivery (timeout, network error or 5xx)
// may already have been processed by GHL, and a repeat could create a duplicate contact or alert. Only a lead GHL
// refused with a 4xx is eligible for another attempt, up to MAX_ATTEMPTS.
import { appAdminCreds } from "./app-admin.server";
import { deliverLeadToGhl, isGhlForwardedLeadType } from "./ghl-webhook.functions";
import { logSafeError } from "./safe-log";

export const MAX_ATTEMPTS = 3;
/** A lead is only forwarded shortly after it was saved, so the endpoint cannot replay old records. */
export const MAX_LEAD_AGE_MS = 15 * 60 * 1000;
/** A claim older than this was abandoned (for example the server stopped mid-send); it is not re-sent. */
export const STALE_CLAIM_MS = 2 * 60 * 1000;
const MAX_STATE_WRITES = 3;

export type StoredLeadResult = {
  delivered: boolean;
  state: "delivered" | "failed" | "unconfirmed" | "skipped" | "ineligible" | "not_configured";
  status: number | null;
};

type StoredLead = {
  id: string;
  lead_type: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  vehicle_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS = "id,lead_type,full_name,email,phone,message,vehicle_id,details,created_at,updated_at";

function headers(key: string, write: boolean): Record<string, string> {
  const out: Record<string, string> = { apikey: key, Accept: "application/json" };
  // New-style keys are opaque; only JWT-style keys are also sent as a bearer token.
  if (key.split(".").length === 3) out["Authorization"] = `Bearer ${key}`;
  if (write) {
    out["Content-Type"] = "application/json";
    out["Content-Profile"] = "public";
    out["Prefer"] = "return=representation";
  } else {
    out["Accept-Profile"] = "public";
  }
  return out;
}

async function readLead(creds: { url: string; key: string }, id: string): Promise<StoredLead | null> {
  const res = await fetch(`${creds.url}/rest/v1/leads?id=eq.${encodeURIComponent(id)}&select=${COLUMNS}&limit=1`, {
    headers: headers(creds.key, false),
  });
  if (!res.ok) throw new Error(`lead read failed (${res.status})`);
  const rows = (await res.json()) as StoredLead[];
  return rows[0] ?? null;
}

/**
 * Writes new details only if the row is unchanged since `row` was read. Returns the new row, or null if it changed.
 * Two independent conditions apply inside one UPDATE: the row's update time and its stored delivery state. The state
 * condition alone makes a claim single-winner (the loser's UPDATE re-checks it against the committed row), so the
 * guarantee does not depend on the update-time trigger.
 */
async function writeDetails(
  creds: { url: string; key: string },
  row: StoredLead,
  details: Record<string, unknown>,
): Promise<StoredLead | null> {
  const currentState = detailString(row.details ?? {}, "ghl_delivery_state");
  const stateFilter = currentState === "" ? "is.null" : `eq.${encodeURIComponent(currentState)}`;
  const query =
    `id=eq.${encodeURIComponent(row.id)}&updated_at=eq.${encodeURIComponent(row.updated_at)}` +
    `&details->>ghl_delivery_state=${stateFilter}`;
  const res = await fetch(`${creds.url}/rest/v1/leads?${query}&select=${COLUMNS}`, {
    method: "PATCH",
    headers: headers(creds.key, true),
    body: JSON.stringify({ details }),
  });
  if (!res.ok) throw new Error(`lead write failed (${res.status})`);
  const rows = (await res.json()) as StoredLead[];
  return rows[0] ?? null;
}

function detailString(details: Record<string, unknown>, key: string): string {
  const value = details[key];
  return typeof value === "string" ? value : "";
}

function withState(
  details: Record<string, unknown>,
  state: string,
  attempts: number,
  http: number | null,
  now: Date,
): Record<string, unknown> {
  return {
    ...details,
    ghl_delivery_state: state,
    ghl_delivery_attempts: String(attempts),
    ghl_delivery_http: http === null ? "" : String(http),
    ghl_delivery_at: now.toISOString(),
  };
}

/**
 * Re-reads the lead and applies a state change if `allowed` still holds. A concurrent change (including a staff
 * edit) only causes a re-read, up to a few times.
 */
async function transition(
  creds: { url: string; key: string },
  id: string,
  allowed: (row: StoredLead) => boolean,
  next: (row: StoredLead) => Record<string, unknown>,
): Promise<StoredLead | null> {
  for (let attempt = 0; attempt < MAX_STATE_WRITES; attempt += 1) {
    const row = await readLead(creds, id);
    if (!row || !allowed(row)) return null;
    const written = await writeDetails(creds, row, next(row));
    if (written) return written;
  }
  return null;
}

function vehicleFrom(row: StoredLead, details: Record<string, unknown>) {
  const pick = (key: string) => (details[key] === undefined || details[key] === null ? null : String(details[key]));
  if (!row.vehicle_id && !pick("vehicle_id") && !pick("vehicle_vin") && !pick("vehicle_make") && !pick("vehicle_stock_number")) return null;
  return {
    id: row.vehicle_id ?? pick("vehicle_id"),
    vin: pick("vehicle_vin"),
    stock_number: pick("vehicle_stock_number"),
    year: pick("vehicle_year"),
    make: pick("vehicle_make"),
    model: pick("vehicle_model"),
    trim: pick("vehicle_trim"),
    price: pick("vehicle_price"),
  };
}

export type InventoryVehicle = {
  id: string;
  vin: string;
  stock_number: string;
  year: number | string;
  make: string;
  model: string;
  trim: string | null;
  mileage: number | null;
  price_cents: number | null;
  slug: string;
};

/** Reads one vehicle from the public inventory by its ID. Read-only; returns null when it is not found. */
export type VehicleLookup = (vehicleId: string) => Promise<InventoryVehicle | null>;

const SITE_ORIGIN = "https://mycarcorp.com";

async function inventoryVehicleLookup(vehicleId: string): Promise<InventoryVehicle | null> {
  const { listPublicLegacyInventory } = await import("./legacy-inventory.server");
  const data = await listPublicLegacyInventory({ page: 1, pageSize: 10000 });
  const found = (data.vehicles ?? []).find((v) => v.id === vehicleId);
  return found
    ? { id: found.id, vin: found.vin, stock_number: found.stock_number, year: found.year, make: found.make, model: found.model, trim: found.trim ?? null, mileage: found.mileage ?? null, price_cents: found.price_cents == null ? null : Number(found.price_cents), slug: found.slug }
    : null;
}

/**
 * Adds the real inventory record for the chosen car to what is sent, so the car's details never depend on form fields.
 * Nothing is written to the lead. If the lookup fails, the details saved with the lead are sent unchanged.
 */
export async function withInventoryVehicle(
  row: Pick<StoredLead, "vehicle_id">,
  details: Record<string, unknown>,
  lookup: VehicleLookup,
): Promise<Record<string, unknown>> {
  const id = row.vehicle_id ?? detailString(details, "vehicle_id");
  if (!id) return details;
  let vehicle: InventoryVehicle | null = null;
  try {
    vehicle = await lookup(id);
  } catch {
    console.error("[ghl-delivery] vehicle lookup failed; sending the saved details");
    return details;
  }
  if (!vehicle) return details;
  const title = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
  const inventoryPrice = vehicle.price_cents === null || !Number.isFinite(vehicle.price_cents) ? "" : String(vehicle.price_cents / 100);
  // The price the customer used in the estimator is kept when they typed one in themselves.
  const keepPrice = detailString(details, "vehicle_price_source") === "manual" && detailString(details, "vehicle_price") !== "";
  return {
    ...details,
    vehicle_id: vehicle.id,
    vehicle_vin: vehicle.vin,
    vehicle_stock_number: vehicle.stock_number,
    vehicle_year: String(vehicle.year),
    vehicle_make: vehicle.make,
    vehicle_model: vehicle.model,
    vehicle_trim: vehicle.trim ?? "",
    vehicle_title: title,
    vehicle_of_interest: title,
    vehicle_mileage: vehicle.mileage === null ? "" : String(vehicle.mileage),
    vehicle_inventory_price: inventoryPrice,
    vehicle_price: keepPrice ? detailString(details, "vehicle_price") : inventoryPrice || detailString(details, "vehicle_price"),
    vehicle_url: `${SITE_ORIGIN}/inventory/${encodeURIComponent(vehicle.slug)}`,
  };
}

/**
 * Forwards one stored lead to GHL at most once. Exported for tests; the public server function only passes the ID.
 */
export async function deliverStoredLeadToGhl(
  leadId: string,
  now: () => Date = () => new Date(),
  lookupVehicle: VehicleLookup = inventoryVehicleLookup,
): Promise<StoredLeadResult> {
  let creds: { url: string; key: string };
  try {
    creds = appAdminCreds();
  } catch {
    console.error("[ghl-delivery] backend credentials are not configured");
    return { delivered: false, state: "not_configured", status: null };
  }

  try {
    const first = await readLead(creds, leadId);
    if (!first || !isGhlForwardedLeadType(first.lead_type)) return { delivered: false, state: "ineligible", status: null };
    const age = now().getTime() - Date.parse(first.created_at);
    if (!Number.isFinite(age) || age > MAX_LEAD_AGE_MS || age < -MAX_LEAD_AGE_MS) {
      return { delivered: false, state: "ineligible", status: null };
    }

    const canSend = (row: StoredLead): boolean => {
      const d = row.details ?? {};
      const state = detailString(d, "ghl_delivery_state");
      if (state === "") return true;
      // Only a refusal by GHL may be tried again; anything else might already have been processed.
      return state === "failed" && Number(detailString(d, "ghl_delivery_attempts") || "0") < MAX_ATTEMPTS;
    };

    // Claim the lead; only one caller can win. A stale "sending" claim is recorded as unconfirmed, never re-sent.
    const claimed = await transition(creds, leadId, canSend, (row) => {
      const d = row.details ?? {};
      const attempts = Number(detailString(d, "ghl_delivery_attempts") || "0") + 1;
      return withState(d, "sending", attempts, null, now());
    });
    if (!claimed) {
      const current = await readLead(creds, leadId);
      const d = current?.details ?? {};
      const state = detailString(d, "ghl_delivery_state");
      if (state === "sending") {
        const since = Date.parse(detailString(d, "ghl_delivery_at"));
        if (current && Number.isFinite(since) && now().getTime() - since > STALE_CLAIM_MS) {
          await transition(
            creds,
            leadId,
            (row) => detailString(row.details ?? {}, "ghl_delivery_state") === "sending",
            (row) => withState(row.details ?? {}, "unconfirmed", Number(detailString(row.details ?? {}, "ghl_delivery_attempts") || "1"), null, now()),
          );
        }
      }
      return { delivered: state === "delivered", state: "skipped", status: null };
    }

    const details = await withInventoryVehicle(claimed, claimed.details ?? {}, lookupVehicle);
    const attempts = Number(detailString(details, "ghl_delivery_attempts") || "1");
    const result = await deliverLeadToGhl({
      leadType: claimed.lead_type,
      fullName: claimed.full_name ?? "",
      email: claimed.email ?? "",
      phone: claimed.phone ?? "",
      message: claimed.message ?? "",
      vehicleUrl: detailString(details, "vehicle_url") || detailString(details, "conversion_page"),
      vehicle: vehicleFrom(claimed, details),
      details,
      leadId,
      attempt: attempts,
    });

    const state = result.outcome === "delivered" ? "delivered" : result.outcome === "rejected" ? "failed" : "unconfirmed";
    const recorded = await transition(
      creds,
      leadId,
      (row) => detailString(row.details ?? {}, "ghl_delivery_state") === "sending",
      (row) => withState(row.details ?? {}, state, attempts, result.status, now()),
    );
    if (!recorded) console.error("[ghl-delivery] could not record the delivery state");
    return { delivered: result.delivered, state, status: result.status };
  } catch (error) {
    logSafeError("ghl-delivery.stored-lead", error);
    return { delivered: false, state: "unconfirmed", status: null };
  }
}
