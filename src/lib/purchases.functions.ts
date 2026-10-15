import { createServerFn } from "@tanstack/react-start";
import {
  CUSTOMER_EDITABLE_FIELDS,
  PURCHASE_STEPS,
  canSubmit,
  type Purchase,
  type PurchaseEvent,
  type PurchaseStep,
} from "./purchase-flow";

const token = (input: unknown) => {
  const t = String((input as { accessToken?: string })?.accessToken ?? "");
  if (!t) throw new Error("Please sign in.");
  return t;
};

const clip = (v: unknown, max: number) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};
const numOrNull = (v: unknown) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export type VehicleSnapshot = {
  id: string;
  slug?: string | null;
  vin?: string | null;
  title: string;
  price_cents?: number | null;
  mileage?: number | null;
  photo?: string | null;
};

export const listMyPurchases = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => ({ accessToken: token(input) }))
  .handler(async ({ data }): Promise<Purchase[]> => {
    const { requireUser, rest } = await import("./purchases.server");
    const user = await requireUser(data.accessToken);
    return rest<Purchase[]>(`mc_purchases?select=*&user_id=eq.${user.id}&order=updated_at.desc`);
  });

export const getMyPurchase = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; id: number }) => ({
    accessToken: token(input),
    id: Number(input?.id),
  }))
  .handler(async ({ data }): Promise<{ purchase: Purchase; events: PurchaseEvent[] } | null> => {
    const { requireUser, getPurchaseRow, listEvents } = await import("./purchases.server");
    const user = await requireUser(data.accessToken);
    const purchase = await getPurchaseRow(data.id);
    if (!purchase || purchase.user_id !== user.id) return null;
    return { purchase, events: await listEvents(purchase.id, true) };
  });

/** Starts a purchase for a vehicle, or resumes the open one for the same vehicle. */
export const startPurchase = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; vehicle: VehicleSnapshot }) => {
    const v = input?.vehicle;
    if (!v?.id || !v?.title) throw new Error("Missing vehicle.");
    return {
      accessToken: token(input),
      vehicle: {
        id: String(v.id).slice(0, 80),
        slug: clip(v.slug, 200),
        vin: clip(v.vin, 40),
        title: String(v.title).slice(0, 255),
        price_cents: numOrNull(v.price_cents),
        mileage: numOrNull(v.mileage),
        photo: clip(v.photo, 1000),
      },
    };
  })
  .handler(async ({ data }): Promise<{ id: number; resumed: boolean }> => {
    const { requireUser, rest, addEvent } = await import("./purchases.server");
    const user = await requireUser(data.accessToken);
    const existing = await rest<Array<{ id: number }>>(
      `mc_purchases?select=id&user_id=eq.${user.id}&vehicle_id=eq.${encodeURIComponent(data.vehicle.id)}` +
        `&status=not.in.(completed,cancelled)&limit=1`,
    );
    if (existing?.[0]) return { id: existing[0].id, resumed: true };

    const profile = await rest<Array<{ full_name: string | null; phone: string | null }>>(
      `profiles?select=full_name,phone&id=eq.${user.id}&limit=1`,
      { profile: "public" },
    ).catch(() => []);

    const created = await rest<Array<{ id: number }>>("mc_purchases", {
      method: "POST",
      prefer: "return=representation",
      body: {
        user_id: user.id,
        status: "draft",
        current_step: "personal",
        email: user.email,
        full_name: profile?.[0]?.full_name ?? null,
        phone: profile?.[0]?.phone ?? null,
        vehicle_id: data.vehicle.id,
        vehicle_slug: data.vehicle.slug,
        vehicle_vin: data.vehicle.vin,
        vehicle_title: data.vehicle.title,
        vehicle_price_cents: data.vehicle.price_cents,
        vehicle_mileage: data.vehicle.mileage,
        vehicle_photo: data.vehicle.photo,
      },
    });
    const id = created[0]!.id;
    await addEvent({
      purchase_id: id,
      event_type: "created",
      message: `Purchase started for ${data.vehicle.title}.`,
      visible_to_customer: true,
      author: null,
    });
    return { id, resumed: false };
  });

export const saveMyPurchase = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { accessToken: string; id: number; patch: Record<string, unknown>; step?: string }) => {
      const patch: Record<string, unknown> = {};
      for (const f of CUSTOMER_EDITABLE_FIELDS) {
        if (!(f in (input?.patch ?? {}))) continue;
        const v = input.patch[f];
        if (f === "has_trade_in") patch[f] = v === null ? null : Boolean(v);
        else if (["preapproval_amount", "trade_mileage", "trade_payoff"].includes(f)) patch[f] = numOrNull(v);
        else if (f === "date_of_birth") patch[f] = /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? v : null;
        else patch[f] = clip(v, f === "address" ? 500 : 255);
      }
      const step = PURCHASE_STEPS.some((s) => s.key === input?.step) ? (input.step as PurchaseStep) : undefined;
      return { accessToken: token(input), id: Number(input?.id), patch, step };
    },
  )
  .handler(async ({ data }): Promise<Purchase> => {
    const { requireUser, getPurchaseRow, rest } = await import("./purchases.server");
    const user = await requireUser(data.accessToken);
    const p = await getPurchaseRow(data.id);
    if (!p || p.user_id !== user.id) throw new Error("Purchase not found.");
    if (p.status !== "draft") throw new Error("This purchase was already submitted. Contact us to make changes.");
    const body: Record<string, unknown> = { ...data.patch, updated_at: new Date().toISOString() };
    if (data.step) body["current_step"] = data.step;
    const rows = await rest<Purchase[]>(`mc_purchases?id=eq.${p.id}`, {
      method: "PATCH",
      prefer: "return=representation",
      body,
    });
    return rows[0]!;
  });

export const submitMyPurchase = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; id: number; attribution?: Record<string, string> }) => {
    const attribution: Record<string, string> = {};
    for (const [k, v] of Object.entries(input?.attribution ?? {}).slice(0, 60)) {
      attribution[String(k).slice(0, 60)] = String(v ?? "").slice(0, 500);
    }
    return { accessToken: token(input), id: Number(input?.id), attribution };
  })
  .handler(async ({ data }): Promise<Purchase> => {
    const { requireUser, getPurchaseRow, rest, addEvent } = await import("./purchases.server");
    const user = await requireUser(data.accessToken);
    const p = await getPurchaseRow(data.id);
    if (!p || p.user_id !== user.id) throw new Error("Purchase not found.");
    if (p.status !== "draft") return p;
    if (!canSubmit(p)) throw new Error("Please complete every step before submitting.");

    const now = new Date().toISOString();
    const details = {
      purchase_id: p.id,
      vehicle_title: p.vehicle_title,
      vehicle_vin: p.vehicle_vin,
      vehicle_price: p.vehicle_price_cents != null ? (p.vehicle_price_cents / 100).toFixed(2) : null,
      payment_method: p.payment_method,
      lender_name: p.lender_name,
      preapproval_amount: p.preapproval_amount,
      has_trade_in: p.has_trade_in,
      trade_year_make_model: p.trade_year_make_model,
      trade_mileage: p.trade_mileage,
      trade_payoff: p.trade_payoff,
      ...data.attribution,
    };

    // A lead keeps purchases visible in Customers / Opportunities.
    let leadId: string | null = null;
    const isUuid = /^[0-9a-f-]{36}$/i.test(p.vehicle_id ?? "");
    const leadBody = {
      status: "new",
      full_name: p.full_name ?? "Customer",
      email: p.email ?? user.email ?? "",
      phone: p.phone,
      message: `Buy a car: ${p.vehicle_title ?? ""}`,
      user_id: user.id,
      vehicle_id: isUuid ? p.vehicle_id : null,
      details,
    };
    for (const lead_type of ["purchase", "availability"]) {
      try {
        const rows = await rest<Array<{ id: string }>>("leads", {
          method: "POST",
          profile: "public",
          prefer: "return=representation",
          body: { ...leadBody, lead_type, details: { ...details, request_kind: "purchase" } },
        });
        leadId = rows?.[0]?.id ?? null;
        break;
      } catch (e) {
        console.error("[purchases] lead insert failed", lead_type, e);
      }
    }

    const rows = await rest<Purchase[]>(`mc_purchases?id=eq.${p.id}`, {
      method: "PATCH",
      prefer: "return=representation",
      body: { status: "submitted", current_step: "review", submitted_at: now, updated_at: now, lead_id: leadId },
    });
    await addEvent({
      purchase_id: p.id,
      event_type: "submitted",
      message: "You submitted your purchase. Our team will review it shortly.",
      visible_to_customer: true,
      author: null,
    });

    try {
      const { postToGhl } = await import("./ghl-webhook.server");
      const [first, ...rest_] = String(p.full_name ?? "").trim().split(/\s+/);
      await postToGhl({
        event_type: "purchase_submitted",
        source: "MyCar Website",
        full_name: p.full_name,
        first_name: first ?? "",
        last_name: rest_.join(" "),
        email: p.email,
        phone: p.phone,
        address: p.address,
        city: p.city,
        state: p.state,
        zip: p.zip,
        vehicle_id: p.vehicle_id,
        vin: p.vehicle_vin,
        vehicle_title: p.vehicle_title,
        vehicle_price: details.vehicle_price,
        payment_method: p.payment_method,
        lender_name: p.lender_name,
        has_trade_in: p.has_trade_in ? "yes" : "no",
        trade_year_make_model: p.trade_year_make_model,
        submitted_at: now,
        ...data.attribution,
      });
    } catch (e) {
      console.error("[purchases] GHL delivery failed", e);
    }
    return rows[0]!;
  });
