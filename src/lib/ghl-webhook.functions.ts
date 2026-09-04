import { createServerFn } from "@tanstack/react-start";

/** Website lead types that mirror to GoHighLevel, mapped to their event_type. */
const EVENT_TYPES: Record<string, string> = {
  finance: "financing",
  availability: "check_availability",
  trade: "sell_or_trade",
  appointment: "book_a_visit",
};

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
  } | null;
  details?: Record<string, unknown>;
};

/**
 * Fire-and-forget mirror of a saved lead to the GoHighLevel incoming webhook.
 * Runs only after the Supabase insert succeeded; never fails the submission.
 */
export const sendLeadToGhl = createServerFn({ method: "POST" })
  .inputValidator((input: GhlLeadInput) => {
    const leadType = str(input?.leadType);
    if (!EVENT_TYPES[leadType]) throw new Error("Unsupported lead type");
    return {
      leadType,
      fullName: str(input?.fullName),
      email: str(input?.email),
      phone: str(input?.phone),
      message: str(input?.message),
      vehicleUrl: str(input?.vehicleUrl),
      vehicle: (input?.vehicle ?? null) as GhlLeadInput["vehicle"],
      details:
        input?.details && typeof input.details === "object"
          ? (input.details as Record<string, unknown>)
          : {},
    };
  })
  .handler(async ({ data }): Promise<{ delivered: boolean; status: number | null }> => {
    const event_type = EVENT_TYPES[data.leadType]!;
    const d = data.details;
    const v = data.vehicle ?? {};

    const base: Record<string, unknown> = {
      event_type,
      source: "MyCar Website",
      full_name: data.fullName,
      ...splitName(data.fullName),
      email: data.email,
      phone: data.phone,
      message: data.message,
      submitted_at: new Date().toISOString(),
    };

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
    } else if (event_type === "check_availability") {
      payload = { ...base, ...vehicleFields };
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

    try {
      const { postToGhl } = await import("./ghl-webhook.server");
      const status = await postToGhl(payload);
      return { delivered: status >= 200 && status < 300, status };
    } catch (error) {
      console.error("[ghl-webhook] request threw", error);
      return { delivered: false, status: null };
    }
  });
