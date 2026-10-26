import { createServerFn } from "@tanstack/react-start";
import { logSafeError } from "./safe-log";

type LeadType = "finance" | "trade" | "appointment" | "contact" | "availability";

const LEAD_TYPES: LeadType[] = ["finance", "trade", "appointment", "contact", "availability"];

/**
 * Mirror a submitted lead into the legacy tables:
 * contact-style leads → mycarco_db.mc_contacts, finance leads → mycarco_db.mc_financing.
 * The modern public.leads insert stays exactly as it is; this only adds the copy.
 */
export const mirrorLeadToLegacy = createServerFn({ method: "POST" })
  .inputValidator((input: {
    leadType: string;
    fullName: string;
    email: string;
    phone?: string | null;
    message?: string | null;
    vehicleId?: string | null;
    userId?: string | null;
    details?: Record<string, unknown>;
  }) => {
    const leadType = String(input?.leadType ?? "") as LeadType;
    if (!LEAD_TYPES.includes(leadType)) throw new Error("Invalid lead type");
    const email = String(input?.email ?? "").trim().toLowerCase();
    const fullName = String(input?.fullName ?? "").trim();
    if (!email.includes("@") || !fullName) throw new Error("Invalid contact details");
    return {
      leadType,
      fullName: fullName.slice(0, 255),
      email: email.slice(0, 255),
      phone: input?.phone ? String(input.phone).slice(0, 40) : null,
      message: input?.message ? String(input.message).slice(0, 5000) : null,
      vehicleId: input?.vehicleId ? String(input.vehicleId) : null,
      userId: input?.userId ? String(input.userId) : null,
      details:
        input?.details && typeof input.details === "object"
          ? (input.details as Record<string, unknown>)
          : {},
    };
  })
  .handler(({ data }) => mirrorLeadSubmission(data));

type MirrorLeadData = {
  leadType: LeadType;
  fullName: string;
  email: string;
  phone: string | null;
  message: string | null;
  vehicleId: string | null;
  userId: string | null;
  details: Record<string, unknown>;
};

/** Exported so error handling can be tested without the Start runtime. */
export async function mirrorLeadSubmission(data: MirrorLeadData): Promise<{ mirrored: boolean }> {
  const { mirrorContactRow, mirrorFinancingRow, mirrorTradeRow } = await import("./legacy-mirror.server");
  try {
    if (data.leadType === "finance") {
      await mirrorFinancingRow(data);
    } else if (data.leadType === "trade") {
      // Full appraisal worksheet + a contact row so the lead stays visible.
      await mirrorTradeRow(data);
      await mirrorContactRow(data).catch(() => undefined);
    } else {
      await mirrorContactRow(data);
    }
    return { mirrored: true };
  } catch (error) {
    // Mirroring must never break the customer-facing submission.
    logSafeError("legacy-mirror.lead", error);
    return { mirrored: false };
  }
}

/** Mirror a save/unsave of a vehicle into mycarco_db.mc_saved_cars. */
export const mirrorSavedVehicleToLegacy = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; vehicleId: string; action: string }) => {
    const accessToken = String(input?.accessToken ?? "");
    const vehicleId = String(input?.vehicleId ?? "");
    const action = input?.action === "unsave" ? "unsave" : "save";
    if (!accessToken || !vehicleId) throw new Error("Invalid input");
    return { accessToken, vehicleId, action: action as "save" | "unsave" };
  })
  .handler(async ({ data }): Promise<{ mirrored: boolean }> => {
    const { verifyAppUser, mirrorSavedCar } = await import("./legacy-mirror.server");
    try {
      const user = await verifyAppUser(data.accessToken);
      if (!user) return { mirrored: false };
      return await mirrorSavedCar(user.id, data.vehicleId, data.action);
    } catch (error) {
      logSafeError("legacy-mirror.saved-car", error);
      return { mirrored: false };
    }
  });
