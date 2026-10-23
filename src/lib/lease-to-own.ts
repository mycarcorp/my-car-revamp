/**
 * My Car Corporation
 * Lease to Own — shared program rules, estimates and validation.
 *
 * Used by both browser and server. Contains no customer data.
 *
 * IMPORTANT: The package multipliers below come from the reference prototype
 * (1.30 / 1.32 / 1.40). They are NOT approved lender terms, APRs or
 * disclosures. They only drive a nonbinding preview until management supplies
 * approved finance calculations.
 */

// ============================================================
// 1. PACKAGES
// ============================================================

export type LeaseTierKey = "premier-monthly" | "payday-flex" | "weekly-express";
export type PaymentFrequency = "monthly" | "biweekly" | "weekly";

export type LeaseTier = {
  key: LeaseTierKey;
  tierNumber: 1 | 2 | 3;
  name: string;
  frequency: PaymentFrequency;
  frequencyLabel: string;
  perLabel: string;
  installments: number;
  installmentsLabel: string;
  /** Reference down payment at the $10,000 example vehicle. */
  referenceDown: number;
  downPercent: number;
  minimumDown: number;
  /** Reference prototype multiplier — illustrative only. */
  referenceMultiplier: number;
  badge: string;
  highlight: string;
  audience: string;
  downNote: string;
  benefits: string[];
  cta: string;
  featured?: boolean;
};

export const LEASE_TIERS: readonly LeaseTier[] = [
  {
    key: "premier-monthly",
    tierNumber: 1,
    name: "Premier Monthly",
    frequency: "monthly",
    frequencyLabel: "Monthly",
    perLabel: "month",
    installments: 14,
    installmentsLabel: "14 monthly installments",
    referenceDown: 3000,
    downPercent: 0.3,
    minimumDown: 0,
    referenceMultiplier: 1.3,
    badge: "Tier 1 • Monthly",
    highlight: "Largest down payment",
    audience: "For salaried households and those with steady 30-day budgeting.",
    downNote: "30% of the vehicle value, paid up front",
    benefits: [
      "Cars Protection Plus powertrain warranty",
      "Free 90-day scheduled checkups",
      "14,000 annual mileage allowance",
      "$100 title buyout at the end of the term",
    ],
    cta: "Apply for Premier Monthly",
  },
  {
    key: "payday-flex",
    tierNumber: 2,
    name: "Payday Flex",
    frequency: "biweekly",
    frequencyLabel: "Biweekly",
    perLabel: "2 weeks",
    installments: 24,
    installmentsLabel: "24 biweekly installments (about 11 months)",
    referenceDown: 2000,
    downPercent: 0.2,
    minimumDown: 0,
    referenceMultiplier: 1.32,
    badge: "Tier 2 • Biweekly",
    highlight: "Scheduled around payday",
    audience: "Payments scheduled to follow your biweekly direct deposit.",
    downNote: "20% of the vehicle value, paid up front",
    benefits: [
      "About 11 months of scheduled payments",
      "Cars Protection Plus powertrain warranty",
      "Free 90-day scheduled checkups",
      "Emergency mobility assistance program",
    ],
    cta: "Choose Payday Flex",
    featured: true,
  },
  {
    key: "weekly-express",
    tierNumber: 3,
    name: "Weekly Express",
    frequency: "weekly",
    frequencyLabel: "Weekly",
    perLabel: "week",
    installments: 48,
    installmentsLabel: "48 weekly installments (about 11 months)",
    referenceDown: 1000,
    downPercent: 0.1,
    minimumDown: 1000,
    referenceMultiplier: 1.4,
    badge: "Tier 3 • Weekly",
    highlight: "Lowest down payment",
    audience: "For 1099 contractors, gig workers and weekly paycheck earners.",
    downNote: "10% of the vehicle value, $1,000 minimum",
    benefits: [
      "Lowest down payment of the three packages",
      "Cars Protection Plus powertrain warranty",
      "Free 90-day scheduled checkups",
      "4G GPS telematics with vehicle health alerts",
    ],
    cta: "Apply for Weekly Express",
  },
] as const;

export const DEFAULT_TIER: LeaseTierKey = "payday-flex";

export function isLeaseTierKey(value: unknown): value is LeaseTierKey {
  return LEASE_TIERS.some((tier) => tier.key === value);
}

export function getLeaseTier(key: LeaseTierKey): LeaseTier {
  return LEASE_TIERS.find((tier) => tier.key === key) ?? LEASE_TIERS[1]!;
}

// ============================================================
// 2. VEHICLE VALUE SLIDER
// ============================================================

export const VEHICLE_VALUE = { min: 6000, max: 25000, step: 500, default: 10000 } as const;

export function clampVehicleValue(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return VEHICLE_VALUE.default;
  const stepped = Math.round(n / VEHICLE_VALUE.step) * VEHICLE_VALUE.step;
  return Math.min(VEHICLE_VALUE.max, Math.max(VEHICLE_VALUE.min, stepped));
}

export const TITLE_BUYOUT = 100;

/** Payments per year for each schedule. */
export const PAYMENTS_PER_YEAR: Record<PaymentFrequency, number> = {
  monthly: 12,
  biweekly: 26,
  weekly: 52,
};

export type PackageEstimate = {
  tier: LeaseTierKey;
  vehicleValue: number;
  downPayment: number;
  /** Vehicle value less the down payment. */
  balanceAfterDown: number;
  payment: number;
  frequency: PaymentFrequency;
  installments: number;
  totalOfPayments: number;
  /** Down payment + all installments + title buyout. */
  totalCost: number;
  termMonths: number;
  basis: "reference_assumption";
};

/**
 * Nonbinding package preview using the reference prototype formulas:
 *   down    = vehicle value × down %   (Tier 3 has a $1,000 minimum)
 *   payment = (value − down) × reference multiplier ÷ installments
 */
export function estimatePackage(tierKey: LeaseTierKey, vehicleValue: number): PackageEstimate {
  const tier = getLeaseTier(tierKey);
  const value = clampVehicleValue(vehicleValue);
  const downPayment = Math.max(tier.minimumDown, Math.round(value * tier.downPercent));
  const balanceAfterDown = Math.max(0, value - downPayment);
  const payment = Math.round((balanceAfterDown * tier.referenceMultiplier) / tier.installments);
  const totalOfPayments = payment * tier.installments;
  return {
    tier: tier.key,
    vehicleValue: value,
    downPayment,
    balanceAfterDown,
    payment,
    frequency: tier.frequency,
    installments: tier.installments,
    totalOfPayments,
    totalCost: downPayment + totalOfPayments + TITLE_BUYOUT,
    termMonths: Math.round((tier.installments / PAYMENTS_PER_YEAR[tier.frequency]) * 12 * 10) / 10,
    basis: "reference_assumption",
  };
}

/** Share of the scheduled obligation (down + installments + buyout) paid after `installmentsPaid`. */
export function equityProgress(estimate: PackageEstimate, installmentsPaid: number): number {
  if (estimate.totalCost <= 0) return 0;
  const paid =
    estimate.downPayment +
    Math.min(estimate.installments, Math.max(0, installmentsPaid)) * estimate.payment;
  return Math.min(1, paid / estimate.totalCost);
}

// ============================================================
// 3. RIDESHARE VS. OWNERSHIP SIMULATOR
// ============================================================

export const RIDESHARE_DAILY = { min: 10, max: 70, step: 1, default: 28 } as const;
export const DAYS_PER_MONTH = 30;
export const COMPARISON_MONTHS = 14;
/** Illustrative annual depreciation for a used vehicle. Not an appraisal. */
export const ASSUMED_ANNUAL_DEPRECIATION = 0.15;

export type RideshareSpend = {
  daily: number;
  monthly: number;
  yearly: number;
  fourteenMonth: number;
};

export function rideshareSpend(daily: number): RideshareSpend {
  const d = Math.min(
    RIDESHARE_DAILY.max,
    Math.max(RIDESHARE_DAILY.min, Number.isFinite(daily) ? daily : RIDESHARE_DAILY.default),
  );
  const monthly = d * DAYS_PER_MONTH;
  return { daily: d, monthly, yearly: monthly * 12, fourteenMonth: monthly * COMPARISON_MONTHS };
}

export type ComparisonPoint = {
  month: number;
  /** Cumulative rideshare spending. */
  rideshareSpent: number;
  /** Cumulative cash paid toward the vehicle (down + installments + buyout when due). */
  ownershipPaid: number;
  /** Illustrative depreciated vehicle value. */
  vehicleValue: number;
  /** Scheduled payments still owed, including the title buyout. */
  remainingObligation: number;
  /** Vehicle value minus remaining obligation. Can be negative early on. */
  estimatedEquity: number;
};

/**
 * Month-by-month comparison used by the chart. Everything is derived from the
 * inputs — nothing is hand-drawn — and equity accounts for both the remaining
 * obligation and depreciation.
 */
export function buildComparisonSeries(
  daily: number,
  estimate: PackageEstimate,
  months = COMPARISON_MONTHS,
  annualDepreciation = ASSUMED_ANNUAL_DEPRECIATION,
): ComparisonPoint[] {
  const spend = rideshareSpend(daily);
  const perMonth = PAYMENTS_PER_YEAR[estimate.frequency] / 12;
  const points: ComparisonPoint[] = [];
  for (let month = 0; month <= months; month += 1) {
    const paidInstallments = Math.min(estimate.installments, Math.floor(month * perMonth + 1e-9));
    const finished = paidInstallments >= estimate.installments;
    const buyoutPaid = finished ? TITLE_BUYOUT : 0;
    const ownershipPaid = estimate.downPayment + paidInstallments * estimate.payment + buyoutPaid;
    const remainingObligation =
      (estimate.installments - paidInstallments) * estimate.payment + (finished ? 0 : TITLE_BUYOUT);
    const vehicleValue = Math.round(
      estimate.vehicleValue * Math.pow(1 - annualDepreciation, month / 12),
    );
    points.push({
      month,
      rideshareSpent: spend.monthly * month,
      ownershipPaid,
      vehicleValue,
      remainingObligation,
      estimatedEquity: vehicleValue - remainingObligation,
    });
  }
  return points;
}

// ============================================================
// 4. FORMATTING
// ============================================================

export function usd(amount: number, cents = false): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(amount);
}

export function paymentLabel(estimate: Pick<PackageEstimate, "payment" | "frequency">): string {
  const tier = LEASE_TIERS.find((t) => t.frequency === estimate.frequency);
  return `${usd(estimate.payment)} / ${tier?.perLabel ?? estimate.frequency}`;
}

// ============================================================
// 5. APPLICATION (STEP 1) VALIDATION
// ============================================================

export const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
] as const;

/**
 * Fields collected by the ordinary application form. SSN/ITIN is deliberately
 * NOT part of this type: it may only be collected through an approved secure
 * identity provider's hosted field, which returns a reference instead.
 */
export type ApplicantInput = {
  fullLegalName: string;
  dateOfBirth: string;
  cellPhone: string;
  email: string;
  driversLicenseNumber: string;
  driversLicenseState: string;
  street: string;
  city: string;
  state: string;
  zip: string;
};

export const EMPTY_APPLICANT: ApplicantInput = {
  fullLegalName: "",
  dateOfBirth: "",
  cellPhone: "",
  email: "",
  driversLicenseNumber: "",
  driversLicenseState: "",
  street: "",
  city: "",
  state: "",
  zip: "",
};

export type ApplicantErrors = Partial<Record<keyof ApplicantInput, string>>;

export const digitsOnly = (value: string) => value.replace(/\D/g, "");

export function formatSsnInput(value: string): string {
  const d = digitsOnly(value).slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

export function formatPhoneInput(value: string): string {
  const d = digitsOnly(value).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/**
 * Normalizes untrusted applicant input. Unknown keys (including any `ssn`) are
 * dropped, so a raw SSN can never reach storage through this path.
 */
export function normalizeApplicantInput(raw: unknown): ApplicantInput {
  const a = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = (key: string, max: number) =>
    String(a[key] ?? "")
      .trim()
      .slice(0, max);
  return {
    fullLegalName: text("fullLegalName", 160).replace(/\s+/g, " "),
    dateOfBirth: text("dateOfBirth", 10),
    cellPhone: digitsOnly(text("cellPhone", 20)),
    email: text("email", 255).toLowerCase(),
    driversLicenseNumber: normalizeLicenseNumber(text("driversLicenseNumber", 40)).slice(0, 20),
    driversLicenseState: text("driversLicenseState", 2).toUpperCase(),
    street: text("street", 255),
    city: text("city", 120),
    state: text("state", 2).toUpperCase(),
    zip: text("zip", 10),
  };
}

// ------------------------------------------------------------
// SSN / ITIN — provider-only collection
// ------------------------------------------------------------

/** Lifecycle of SSN/ITIN collection through a secure identity provider. */
export const SSN_COLLECTION_STATUSES = [
  "not_collected",
  "pending",
  "collected",
  "verified",
  "failed",
] as const;
export type SsnCollectionStatus = (typeof SSN_COLLECTION_STATUSES)[number];

/**
 * Fictional numbers the local test-only mock accepts (SSA reserved
 * 987-65-4320 … 987-65-4329). Anything else is refused so real numbers are
 * never typed into a development build.
 */
export function ssnTestMockError(value: string): string | null {
  const d = digitsOnly(value);
  if (!d) return "Enter a fictional test number.";
  if (d.length !== 9) return "SSN/ITIN numbers are 9 digits.";
  if (!isValidTaxpayerId(d)) return "That isn't a valid SSN or ITIN format.";
  if (!/^98765432\d$/.test(d))
    return "Test mock only accepts fictional numbers 987-65-4320 to 987-65-4329.";
  return null;
}

/** SSN or ITIN: 9 digits, no all-zero groups, not 666 / 9xx-area SSNs unless a valid ITIN. */
export function isValidTaxpayerId(value: string): boolean {
  const d = digitsOnly(value);
  if (d.length !== 9) return false;
  const area = d.slice(0, 3);
  const group = d.slice(3, 5);
  const serial = d.slice(5);
  if (area.startsWith("9")) {
    // ITIN: 9XX-[50-65|70-88|90-92|94-99]-XXXX
    const g = Number(group);
    return (
      (g >= 50 && g <= 65) || (g >= 70 && g <= 88) || (g >= 90 && g <= 92) || (g >= 94 && g <= 99)
    );
  }
  return area !== "000" && area !== "666" && group !== "00" && serial !== "0000";
}

export function ageOn(dateOfBirth: string, today = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const [y, m, d] = dateOfBirth.split("-").map(Number) as [number, number, number];
  const dob = new Date(Date.UTC(y, m - 1, d));
  if (dob.getUTCFullYear() !== y || dob.getUTCMonth() !== m - 1 || dob.getUTCDate() !== d)
    return null;
  let age = today.getUTCFullYear() - y;
  const beforeBirthday =
    today.getUTCMonth() < m - 1 || (today.getUTCMonth() === m - 1 && today.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

const isState = (value: string) => (US_STATES as readonly string[]).includes(value);

/** Uppercases and removes the spaces and dashes people type for readability. */
export function normalizeLicenseNumber(value: string): string {
  return value.toUpperCase().replace(/[\s-]/g, "");
}

/**
 * License formats differ by state (e.g. 1 letter + 1–8 digits, 7–9 digits,
 * 13 alphanumerics), so this checks only what holds everywhere: letters and
 * digits, at least one digit, 2–20 characters. Format checks against the
 * issuing state belong to an identity-verification provider.
 */
export function licenseNumberError(value: string): string | null {
  const dl = normalizeLicenseNumber(value);
  if (!dl) return "Enter your driver's license number.";
  if (!/^[A-Z0-9]+$/.test(dl)) return "Use letters and numbers only.";
  if (!/\d/.test(dl)) return "License numbers include at least one digit.";
  if (dl.length < 2 || dl.length > 20) return "License numbers are 2–20 characters.";
  return null;
}

export function validateApplicant(input: ApplicantInput, today = new Date()): ApplicantErrors {
  const errors: ApplicantErrors = {};
  const name = input.fullLegalName.trim();
  if (name.length < 3 || !/\s/.test(name))
    errors.fullLegalName = "Enter your full legal name (first and last).";
  else if (name.length > 160) errors.fullLegalName = "Name is too long.";

  const age = ageOn(input.dateOfBirth, today);
  if (age === null) errors.dateOfBirth = "Enter a valid date of birth.";
  else if (age < 18) errors.dateOfBirth = "Applicants must be at least 18 years old.";
  else if (age > 120) errors.dateOfBirth = "Enter a valid date of birth.";

  if (digitsOnly(input.cellPhone).length !== 10)
    errors.cellPhone = "Enter a 10-digit cell phone number.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.email.trim()))
    errors.email = "Enter a valid email address.";

  const dlError = licenseNumberError(input.driversLicenseNumber);
  if (dlError) errors.driversLicenseNumber = dlError;
  if (!isState(input.driversLicenseState)) errors.driversLicenseState = "Select the issuing state.";

  if (input.street.trim().length < 3) errors.street = "Enter your street address.";
  if (input.city.trim().length < 2) errors.city = "Enter your city.";
  if (!isState(input.state)) errors.state = "Select your state.";
  if (!/^\d{5}(-\d{4})?$/.test(input.zip.trim())) errors.zip = "Enter a 5-digit ZIP code.";
  return errors;
}

// ============================================================
// 6. DOCUMENT VERIFICATION (STEP 2)
// ============================================================

export type LeaseDocType =
  "government_id" | "paystub" | "bank_statement" | "insurance_declaration" | "ach_authorization";

export const LEASE_DOCUMENTS: ReadonlyArray<{
  key: LeaseDocType;
  label: string;
  description: string;
}> = [
  {
    key: "government_id",
    label: "Government ID / Driver's License",
    description: "Front of a valid, unexpired government-issued photo ID.",
  },
  {
    key: "paystub",
    label: "30-Day Paystub",
    description: "Paystub(s) covering the most recent 30 days of income.",
  },
  {
    key: "bank_statement",
    label: "60-Day Bank Statement",
    description: "Statements covering the most recent 60 days.",
  },
  {
    key: "insurance_declaration",
    label: "Insurance Declaration Page",
    description: "Current auto insurance declarations page.",
  },
  {
    key: "ach_authorization",
    label: "Voided Check / ACH Pre-Authorization",
    description: "A voided check or bank letter for automatic payments.",
  },
];

/** Customer-uploaded application documents plus staff-issued vault documents. */
export type LeaseVaultDocType =
  LeaseDocType | "executed_agreement" | "receipt" | "warranty" | "inspection_record";

export const VAULT_DOC_LABELS: Record<LeaseVaultDocType, string> = {
  government_id: "Government ID",
  paystub: "Paystub",
  bank_statement: "Bank statement",
  insurance_declaration: "Insurance declaration",
  ach_authorization: "ACH authorization",
  executed_agreement: "Executed agreement",
  receipt: "Receipt",
  warranty: "Warranty document",
  inspection_record: "Inspection record",
};

export const LEASE_DOC_STATUSES = [
  "pending",
  "uploaded",
  "under_review",
  "verified",
  "rejected",
] as const;
export type LeaseDocStatus = (typeof LEASE_DOC_STATUSES)[number];

export const DOC_STATUS_LABELS: Record<LeaseDocStatus, string> = {
  pending: "Pending",
  uploaded: "Uploaded",
  under_review: "Under review",
  verified: "Approved",
  rejected: "Rejected",
};

export const ACCEPTED_DOC_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
] as const;
export const ACCEPTED_DOC_EXTENSIONS = ".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp";
export const MAX_DOC_BYTES = 10 * 1024 * 1024;

export function isLeaseDocType(value: unknown): value is LeaseDocType {
  return LEASE_DOCUMENTS.some((doc) => doc.key === value);
}

export function validateDocumentFile(file: { type: string; size: number }): string | null {
  if (!(ACCEPTED_DOC_MIME_TYPES as readonly string[]).includes(file.type))
    return "Upload a PDF, JPG, PNG, HEIC or WEBP file.";
  if (file.size <= 0) return "That file is empty.";
  if (file.size > MAX_DOC_BYTES) return "Files must be 10 MB or smaller.";
  return null;
}

/** Signing may start only when every required document is on file and none was rejected. */
export function documentsReadyForSigning(
  statuses: Partial<Record<LeaseDocType, LeaseDocStatus>>,
): boolean {
  return LEASE_DOCUMENTS.every((doc) => {
    const status = statuses[doc.key];
    return status === "uploaded" || status === "under_review" || status === "verified";
  });
}

// ============================================================
// 7. APPLICATION STATUSES
// ============================================================

export const LEASE_APPLICATION_STATUSES = [
  { key: "submitted", label: "Submitted" },
  { key: "documents_pending", label: "Documents pending" },
  { key: "under_review", label: "Under review" },
  { key: "approved", label: "Approved" },
  { key: "declined", label: "Declined" },
  { key: "withdrawn", label: "Withdrawn" },
] as const;
export type LeaseApplicationStatus = (typeof LEASE_APPLICATION_STATUSES)[number]["key"];

export function isLeaseApplicationStatus(value: unknown): value is LeaseApplicationStatus {
  return LEASE_APPLICATION_STATUSES.some((s) => s.key === value);
}

export function applicationStatusLabel(status: string): string {
  return LEASE_APPLICATION_STATUSES.find((s) => s.key === status)?.label ?? status;
}

/** Thrown by the server until the Lease to Own SQL has been run. */
export const LEASE_SETUP_PENDING = "LEASE_SETUP_PENDING";
/** Thrown by the server when driver's license encryption is not configured. */
export const LEASE_SECURE_COLLECTION_UNAVAILABLE = "LEASE_SECURE_COLLECTION_UNAVAILABLE";

export const SERVICE_LOCATION = "4720 Harrison Rd, Fredericksburg, VA 22408";
export const MAINTENANCE_TIME_WINDOWS = [
  "Morning (9:00 AM – 12:00 PM)",
  "Afternoon (1:00 PM – 4:00 PM)",
] as const;
export const ANNUAL_MILEAGE_ALLOWANCE = 14000;

/** Remaining-installment payoff date estimate from the next scheduled payment. */
export function estimatePayoffDate(
  nextPaymentDate: string | null,
  remainingInstallments: number,
  frequency: PaymentFrequency,
): string | null {
  if (!nextPaymentDate || !/^\d{4}-\d{2}-\d{2}/.test(nextPaymentDate) || remainingInstallments <= 0)
    return null;
  const date = new Date(`${nextPaymentDate.slice(0, 10)}T12:00:00Z`);
  const steps = remainingInstallments - 1;
  if (frequency === "monthly") date.setUTCMonth(date.getUTCMonth() + steps);
  else date.setUTCDate(date.getUTCDate() + steps * (frequency === "weekly" ? 7 : 14));
  return date.toISOString().slice(0, 10);
}
