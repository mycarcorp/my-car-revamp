// Shared (browser + server) rules for the Buy a Car workflow.

export const PURCHASE_STEPS = [
  { key: "vehicle", label: "Vehicle" },
  { key: "personal", label: "Personal details" },
  { key: "payment", label: "Payment method" },
  { key: "trade", label: "Trade-in" },
  { key: "review", label: "Review & submit" },
] as const;
export type PurchaseStep = (typeof PURCHASE_STEPS)[number]["key"];

export const PURCHASE_STATUSES = [
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "in_review", label: "In review" },
  { key: "approved", label: "Approved" },
  { key: "docs_needed", label: "Docs needed" },
  { key: "ready_for_delivery", label: "Ready for delivery" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number]["key"];

export const PAYMENT_METHODS = [
  { key: "cash", label: "Cash" },
  { key: "mycar_financing", label: "My Car Financing" },
  { key: "outside_financing", label: "Outside Financing" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["key"];

export type Purchase = {
  id: number;
  user_id: string;
  status: PurchaseStatus;
  current_step: PurchaseStep;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  vehicle_id: string | null;
  vehicle_slug: string | null;
  vehicle_vin: string | null;
  vehicle_title: string | null;
  vehicle_price_cents: number | null;
  vehicle_mileage: number | null;
  vehicle_photo: string | null;
  payment_method: PaymentMethod | null;
  lender_name: string | null;
  preapproval_amount: number | null;
  has_trade_in: boolean | null;
  trade_year_make_model: string | null;
  trade_mileage: number | null;
  trade_vin: string | null;
  trade_payoff: number | null;
  assigned_to: string | null;
  lead_id: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseEvent = {
  id: number;
  purchase_id: number;
  event_type: string;
  message: string | null;
  visible_to_customer: boolean;
  author: string | null;
  created_at: string;
};

/** Fields a customer may edit while the purchase is a draft. */
export const CUSTOMER_EDITABLE_FIELDS = [
  "full_name",
  "email",
  "phone",
  "date_of_birth",
  "address",
  "city",
  "state",
  "zip",
  "payment_method",
  "lender_name",
  "preapproval_amount",
  "has_trade_in",
  "trade_year_make_model",
  "trade_mileage",
  "trade_vin",
  "trade_payoff",
] as const;

const filled = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";

type StepInput = Partial<Purchase>;

export function isStepComplete(p: StepInput, step: PurchaseStep): boolean {
  switch (step) {
    case "vehicle":
      return filled(p.vehicle_id) || filled(p.vehicle_title);
    case "personal":
      return (
        filled(p.full_name) &&
        filled(p.email) &&
        String(p.email).includes("@") &&
        filled(p.phone) &&
        filled(p.address) &&
        filled(p.zip)
      );
    case "payment":
      if (!filled(p.payment_method)) return false;
      if (p.payment_method === "outside_financing") return filled(p.lender_name);
      return PAYMENT_METHODS.some((m) => m.key === p.payment_method);
    case "trade":
      if (p.has_trade_in === false) return true;
      if (p.has_trade_in === true) return filled(p.trade_year_make_model) && filled(p.trade_mileage);
      return false;
    case "review":
      return filled(p.submitted_at) || (p.status !== undefined && p.status !== "draft");
  }
}

/** Steps 1–4 must be complete before the customer can submit. */
export function canSubmit(p: StepInput): boolean {
  return (["vehicle", "personal", "payment", "trade"] as const).every((s) => isStepComplete(p, s));
}

export function progressPercent(p: StepInput): number {
  const done = PURCHASE_STEPS.filter((s) => isStepComplete(p, s.key)).length;
  return Math.round((done / PURCHASE_STEPS.length) * 100);
}

export function isPurchaseStatus(v: unknown): v is PurchaseStatus {
  return PURCHASE_STATUSES.some((s) => s.key === v);
}

export function isOpenStatus(s: PurchaseStatus): boolean {
  return s !== "completed" && s !== "cancelled";
}

export const statusLabel = (s: string) => PURCHASE_STATUSES.find((x) => x.key === s)?.label ?? s;
export const paymentLabel = (s: string | null) =>
  PAYMENT_METHODS.find((x) => x.key === s)?.label ?? "Not chosen";

export const PURCHASE_SETUP_PENDING = "PURCHASE_SETUP_PENDING";
