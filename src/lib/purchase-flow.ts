/**
 * My Car Corporation
 * Buy a Car — Shared Purchase Workflow
 *
 * Used by both browser and server.
 * Database: mycarco_db.mc_purchases
 */

// ============================================================
// 1. PURCHASE WORKFLOW STEPS
// ============================================================

export const PURCHASE_STEPS = [
  { key: "vehicle", label: "Vehicle" },
  { key: "personal", label: "Personal details" },
  { key: "payment", label: "Payment method" },
  { key: "trade", label: "Trade-in" },
  { key: "fulfillment", label: "Pickup or delivery" },
  { key: "license", label: "Driver's license" },
  { key: "review", label: "Review & submit" },
  { key: "schedule", label: "Appointment" },
  { key: "tracking", label: "Track purchase" },
] as const;

export type PurchaseStep = (typeof PURCHASE_STEPS)[number]["key"];

// ============================================================
// 2. PURCHASE STATUSES
// ============================================================

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

// ============================================================
// 3. PAYMENT METHODS
// ============================================================

export const PAYMENT_METHODS = [
  { key: "cash", label: "Cash" },
  { key: "mycar_financing", label: "My Car Financing" },
  { key: "outside_financing", label: "Outside Financing" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["key"];

// ============================================================
// 4. PICKUP OR DELIVERY METHODS
// ============================================================

export const FULFILLMENT_METHODS = [
  { key: "pickup", label: "Pickup at My Car" },
  { key: "delivery", label: "Home Delivery" },
] as const;

export type FulfillmentMethod = (typeof FULFILLMENT_METHODS)[number]["key"];

// ============================================================
// 5. DRIVER'S LICENSE STATUSES
// ============================================================

export const LICENSE_STATUSES = [
  { key: "not_submitted", label: "Not submitted" },
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under review" },
  { key: "approved", label: "Approved" },
  { key: "needs_correction", label: "Needs correction" },
] as const;

export type LicenseStatus = (typeof LICENSE_STATUSES)[number]["key"];

// ============================================================
// 6. APPOINTMENT STATUSES
// ============================================================

export const APPOINTMENT_STATUSES = [
  { key: "not_requested", label: "Not requested" },
  { key: "pending_confirmation", label: "Pending confirmation" },
  { key: "confirmed", label: "Confirmed" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]["key"];

// ============================================================
// 7. PURCHASE DATABASE TYPE
// ============================================================

export type Purchase = {
  // Purchase identification
  id: number;
  user_id: string;
  status: PurchaseStatus;
  current_step: PurchaseStep;

  // Customer personal details
  full_name: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;

  // Selected vehicle
  vehicle_id: string | null;
  vehicle_slug: string | null;
  vehicle_vin: string | null;
  vehicle_title: string | null;
  vehicle_price_cents: number | null;
  vehicle_mileage: number | null;
  vehicle_photo: string | null;

  // Payment and financing
  payment_method: PaymentMethod | null;
  lender_name: string | null;
  preapproval_amount: number | null;

  // New financing preferences
  down_payment_cents: number | null;
  finance_term_months: number | null;

  // Trade-in
  has_trade_in: boolean | null;
  trade_year_make_model: string | null;
  trade_mileage: number | null;
  trade_vin: string | null;
  trade_payoff: number | null;

  // Pickup or delivery
  fulfillment_method: FulfillmentMethod | null;
  delivery_address: string | null;

  // Driver's license verification
  license_status: LicenseStatus;

  // Appointment
  preferred_appointment_date: string | null;
  preferred_appointment_time: string | null;
  appointment_notes: string | null;
  appointment_status: AppointmentStatus;

  // Internal dealership management
  assigned_to: string | null;
  lead_id: string | null;

  // Timestamps
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================================
// 8. PURCHASE ACTIVITY EVENTS
// ============================================================

export type PurchaseEvent = {
  id: number;
  purchase_id: number;
  event_type: string;
  message: string | null;
  visible_to_customer: boolean;
  author: string | null;
  created_at: string;
};

// ============================================================
// 9. CUSTOMER EDITABLE FIELDS
// ============================================================

/**
 * Fields customers can change while the purchase is a draft.
 *
 * IMPORTANT:
 * Do not allow customers to directly change:
 * - Purchase approval status
 * - License verification status
 * - Appointment confirmation status
 * - Staff assignment
 * - Submitted timestamp
 */

export const CUSTOMER_EDITABLE_FIELDS = [
  // Personal details
  "full_name",
  "email",
  "phone",
  "date_of_birth",
  "address",
  "city",
  "state",
  "zip",

  // Payment and financing
  "payment_method",
  "lender_name",
  "preapproval_amount",
  "down_payment_cents",
  "finance_term_months",

  // Trade-in
  "has_trade_in",
  "trade_year_make_model",
  "trade_mileage",
  "trade_vin",
  "trade_payoff",

  // Pickup or delivery
  "fulfillment_method",
  "delivery_address",
] as const;

// ============================================================
// 10. VALIDATION HELPERS
// ============================================================

const filled = (value: unknown): boolean => {
  return value !== null && value !== undefined && String(value).trim() !== "";
};

type StepInput = Partial<Purchase>;

// ============================================================
// 11. CHECK IF A WORKFLOW STEP IS COMPLETE
// ============================================================

export function isStepComplete(purchase: StepInput, step: PurchaseStep): boolean {
  switch (step) {
    case "vehicle":
      return filled(purchase.vehicle_id) || filled(purchase.vehicle_title);

    case "personal":
      return (
        filled(purchase.full_name) &&
        filled(purchase.email) &&
        String(purchase.email).includes("@") &&
        filled(purchase.phone) &&
        filled(purchase.address) &&
        filled(purchase.zip)
      );

    case "payment":
      if (!PAYMENT_METHODS.some((method) => method.key === purchase.payment_method)) {
        return false;
      }

      if (purchase.payment_method === "outside_financing") {
        return filled(purchase.lender_name);
      }

      return true;

    case "trade":
      if (purchase.has_trade_in === false) {
        return true;
      }

      if (purchase.has_trade_in === true) {
        return filled(purchase.trade_year_make_model) && filled(purchase.trade_mileage);
      }

      return false;

    case "fulfillment":
      if (purchase.fulfillment_method === "pickup") {
        return true;
      }

      if (purchase.fulfillment_method === "delivery") {
        return filled(purchase.delivery_address);
      }

      return false;

    case "license":
      return (
        purchase.license_status === "submitted" ||
        purchase.license_status === "under_review" ||
        purchase.license_status === "approved"
      );

    case "review":
      return filled(purchase.submitted_at) || (purchase.status !== undefined && purchase.status !== "draft");

    case "schedule":
      return purchase.appointment_status === "pending_confirmation" || purchase.appointment_status === "confirmed";

    case "tracking":
      return purchase.status === "completed";

    default:
      return false;
  }
}

// ============================================================
// 12. CHECK WHETHER PURCHASE CAN BE SUBMITTED
// ============================================================

/**
 * All required customer intake steps must be completed
 * before submitting the purchase to My Car.
 *
 * Appointment scheduling takes place after submission.
 *
 * The license status must be set through a secure
 * server-side document upload or staff verification process.
 */

export function canSubmit(purchase: StepInput): boolean {
  const requiredSteps = ["vehicle", "personal", "payment", "trade", "fulfillment", "license"] as const;

  return requiredSteps.every((step) => isStepComplete(purchase, step));
}

// ============================================================
// 13. PURCHASE PROGRESS PERCENTAGE
// ============================================================

/**
 * Progress is based on completed milestones,
 * not merely which screens have been visited.
 */

export function progressPercent(purchase: StepInput): number {
  const completed = PURCHASE_STEPS.filter((step) => isStepComplete(purchase, step.key)).length;

  return Math.round((completed / PURCHASE_STEPS.length) * 100);
}

// ============================================================
// 14. STATUS VALIDATION
// ============================================================

export function isPurchaseStatus(value: unknown): value is PurchaseStatus {
  return PURCHASE_STATUSES.some((status) => status.key === value);
}

// ============================================================
// 15. CHECK IF PURCHASE IS STILL OPEN
// ============================================================

export function isOpenStatus(status: PurchaseStatus): boolean {
  return status !== "completed" && status !== "cancelled";
}

// ============================================================
// 16. DISPLAY LABEL HELPERS
// ============================================================

export const statusLabel = (status: string): string => {
  return PURCHASE_STATUSES.find((item) => item.key === status)?.label ?? status;
};

export const paymentLabel = (method: string | null): string => {
  return PAYMENT_METHODS.find((item) => item.key === method)?.label ?? "Not chosen";
};

export const fulfillmentLabel = (method: string | null): string => {
  return FULFILLMENT_METHODS.find((item) => item.key === method)?.label ?? "Not chosen";
};

export const licenseStatusLabel = (status: string): string => {
  return LICENSE_STATUSES.find((item) => item.key === status)?.label ?? status;
};

export const appointmentStatusLabel = (status: string): string => {
  return APPOINTMENT_STATUSES.find((item) => item.key === status)?.label ?? status;
};

// ============================================================
// 17. DATABASE SETUP ERROR CONSTANT
// ============================================================

export const PURCHASE_SETUP_PENDING = "PURCHASE_SETUP_PENDING";
