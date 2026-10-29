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

// ------------------------------------------------------------
// Pre-qualification applicants (Buyer and optional Co-Buyer)
// ------------------------------------------------------------

export type ApplicantRole = "buyer" | "co_buyer";
export const APPLICANT_ROLE_LABELS: Record<ApplicantRole, string> = {
  buyer: "Buyer",
  co_buyer: "Co-Buyer",
};

/** Existing program rule (applicants must be adults). Change only with management approval. */
export const MIN_APPLICANT_AGE = 18;
/**
 * The license number and issuing state were required before the Buyer/Co-Buyer
 * form and still are; issue and expiration dates are optional. Flip this only
 * with management approval.
 */
export const LICENSE_REQUIRED = true;

/** Same housing choices as the /finance application. */
export const HOUSING_TYPES = [
  { value: "rent", label: "Rent" },
  { value: "own", label: "Own" },
  { value: "mortgage", label: "Mortgage" },
  { value: "family", label: "Family" },
  { value: "military", label: "Military" },
  { value: "other", label: "Other" },
] as const;

/**
 * Same employment statuses as the /finance application. `employer` says whether
 * employer details apply; statuses without an employer collect income only, so
 * retired, unemployed and other applicants are never forced to invent a job.
 * These are form rules, not qualification rules.
 */
export const EMPLOYMENT_STATUSES = [
  { value: "Employed - Full-Time", employer: true },
  { value: "Employed - Part-Time", employer: true },
  { value: "Temporary / Seasonal", employer: true },
  { value: "Active Military", employer: true },
  { value: "Self-Employed", employer: true },
  { value: "SSI / Retired", employer: false },
  { value: "Unemployed", employer: false },
  { value: "Other", employer: false },
] as const;

export function employmentNeedsEmployer(status: string): boolean {
  return EMPLOYMENT_STATUSES.find((s) => s.value === status)?.employer ?? true;
}

/**
 * Fields collected for each applicant by the ordinary form. SSN/ITIN is
 * deliberately NOT part of this type: it may only be collected through an
 * approved secure identity provider's hosted field, which returns a reference.
 */
export type ApplicantProfile = {
  firstName: string;
  lastName: string;
  email: string;
  cellPhone: string;
  homePhone: string;
  dateOfBirth: string;
  driversLicenseNumber: string;
  driversLicenseState: string;
  driversLicenseIssueDate: string;
  driversLicenseExpiryDate: string;
  street: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  housingType: string;
  monthlyHousingPayment: string;
  hasPreviousAddress: boolean;
  previousStreet: string;
  previousCity: string;
  previousState: string;
  previousZip: string;
  employmentStatus: string;
  employerName: string;
  jobTitle: string;
  employerPhone: string;
  monthlyIncome: string;
  yearsAtJob: string;
  monthsAtJob: string;
  incomeSource: string;
  hasPreviousEmployment: boolean;
  previousEmployerName: string;
  previousJobTitle: string;
  previousEmployerPhone: string;
  previousYearsAtJob: string;
  previousMonthsAtJob: string;
};

/** The text fields of an applicant (everything except the two "add previous" switches). */
export type ApplicantField = {
  [K in keyof ApplicantProfile]: ApplicantProfile[K] extends string ? K : never;
}[keyof ApplicantProfile];
export type ApplicantErrors = Partial<Record<ApplicantField, string>>;

export const EMPTY_APPLICANT: ApplicantProfile = {
  firstName: "",
  lastName: "",
  email: "",
  cellPhone: "",
  homePhone: "",
  dateOfBirth: "",
  driversLicenseNumber: "",
  driversLicenseState: "",
  driversLicenseIssueDate: "",
  driversLicenseExpiryDate: "",
  street: "",
  unit: "",
  city: "",
  state: "",
  zip: "",
  housingType: "",
  monthlyHousingPayment: "",
  hasPreviousAddress: false,
  previousStreet: "",
  previousCity: "",
  previousState: "",
  previousZip: "",
  employmentStatus: "",
  employerName: "",
  jobTitle: "",
  employerPhone: "",
  monthlyIncome: "",
  yearsAtJob: "",
  monthsAtJob: "",
  incomeSource: "",
  hasPreviousEmployment: false,
  previousEmployerName: "",
  previousJobTitle: "",
  previousEmployerPhone: "",
  previousYearsAtJob: "",
  previousMonthsAtJob: "",
};

export const digitsOnly = (value: string) => value.replace(/\D/g, "");

export function formatSsnInput(value: string): string {
  const d = digitsOnly(value).slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

/** 10-digit US number; a leading country code 1 is dropped. */
export function normalizePhone(value: string): string {
  const d = digitsOnly(value);
  return (d.length === 11 && d.startsWith("1") ? d.slice(1) : d).slice(0, 10);
}

export function formatPhoneInput(value: string): string {
  const d = normalizePhone(value);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** North American numbers: 10 digits, area code and exchange don't start with 0 or 1. */
export function isValidUsPhone(value: string): boolean {
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(normalizePhone(value));
}

/** Whole dollars or dollars and cents ("1,250", "1250.50"). Null when not a valid amount. */
export function parseMoney(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** Leading three ZIP digits for each state (USPS sectional centers), including known cross-border prefixes. */
const STATE_ZIP3: Record<string, Array<[number, number]>> = {
  AL: [[350, 369]],
  AK: [[995, 999]],
  AZ: [[850, 865]],
  AR: [[716, 729]],
  CA: [[900, 961]],
  CO: [[800, 816]],
  CT: [[60, 69]],
  DE: [[197, 199]],
  DC: [
    [200, 200],
    [202, 205],
    [569, 569],
  ],
  FL: [[320, 349]],
  GA: [
    [300, 319],
    [398, 399],
  ],
  HI: [[967, 968]],
  ID: [[832, 838]],
  IL: [[600, 629]],
  IN: [[460, 479]],
  IA: [[500, 528]],
  KS: [[660, 679]],
  KY: [[400, 427]],
  LA: [[700, 714]],
  ME: [[39, 49]],
  MD: [[206, 219]],
  MA: [
    [10, 27],
    [55, 55],
  ],
  MI: [[480, 499]],
  MN: [[550, 567]],
  MS: [[386, 397]],
  MO: [[630, 658]],
  MT: [[590, 599]],
  NE: [[680, 693]],
  NV: [[889, 898]],
  NH: [[30, 38]],
  NJ: [[70, 89]],
  NM: [[870, 884]],
  NY: [
    [5, 5],
    [63, 63],
    [100, 149],
  ],
  NC: [[270, 289]],
  ND: [[580, 588]],
  OH: [[430, 459]],
  OK: [
    [730, 732],
    [734, 749],
  ],
  OR: [[970, 979]],
  PA: [[150, 196]],
  RI: [[28, 29]],
  SC: [[290, 299]],
  SD: [[570, 577]],
  TN: [[370, 385]],
  TX: [
    [733, 733],
    [750, 799],
    [885, 885],
  ],
  UT: [[840, 847]],
  VT: [[50, 59]],
  VA: [
    [201, 201],
    [220, 246],
  ],
  WA: [[980, 994]],
  WV: [[247, 268]],
  WI: [[530, 549]],
  WY: [
    [820, 831],
    [834, 834],
  ],
};

export const isValidZip = (zip: string) => /^\d{5}(-?\d{4})?$/.test(zip.trim());

/** True/false when the state's ZIP prefixes are known; null when they can't be checked. */
export function zipMatchesState(zip: string, state: string): boolean | null {
  const ranges = STATE_ZIP3[state];
  if (!ranges || !isValidZip(zip)) return null;
  const prefix = Number(zip.trim().slice(0, 3));
  return ranges.some(([from, to]) => prefix >= from && prefix <= to);
}

const isIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

/**
 * Normalizes one untrusted applicant. Unknown keys (including any `ssn`) are
 * dropped, so a raw SSN can never reach storage through this path. Fields that
 * belong to a hidden section (no previous address, no employer) are cleared.
 */
export function normalizeApplicantProfile(raw: unknown): ApplicantProfile {
  const a = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = (key: keyof ApplicantProfile, max: number) =>
    String(a[key] ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, max);
  const upper2 = (key: keyof ApplicantProfile) => text(key, 2).toUpperCase();
  const hasPreviousAddress = a["hasPreviousAddress"] === true;
  const hasPreviousEmployment = a["hasPreviousEmployment"] === true;
  const employmentStatus = text("employmentStatus", 60);
  const employer = employmentNeedsEmployer(employmentStatus);
  const ifPrev = (on: boolean, value: string) => (on ? value : "");
  return {
    firstName: text("firstName", 80),
    lastName: text("lastName", 80),
    email: text("email", 255).toLowerCase(),
    cellPhone: normalizePhone(text("cellPhone", 20)),
    homePhone: normalizePhone(text("homePhone", 20)),
    dateOfBirth: text("dateOfBirth", 10),
    driversLicenseNumber: normalizeLicenseNumber(text("driversLicenseNumber", 40)).slice(0, 20),
    driversLicenseState: upper2("driversLicenseState"),
    driversLicenseIssueDate: text("driversLicenseIssueDate", 10),
    driversLicenseExpiryDate: text("driversLicenseExpiryDate", 10),
    street: text("street", 255),
    unit: text("unit", 40),
    city: text("city", 120),
    state: upper2("state"),
    zip: text("zip", 10),
    housingType: text("housingType", 20),
    monthlyHousingPayment: text("monthlyHousingPayment", 16),
    hasPreviousAddress,
    previousStreet: ifPrev(hasPreviousAddress, text("previousStreet", 255)),
    previousCity: ifPrev(hasPreviousAddress, text("previousCity", 120)),
    previousState: ifPrev(hasPreviousAddress, upper2("previousState")),
    previousZip: ifPrev(hasPreviousAddress, text("previousZip", 10)),
    employmentStatus,
    employerName: ifPrev(employer, text("employerName", 160)),
    jobTitle: ifPrev(employer, text("jobTitle", 120)),
    employerPhone: ifPrev(employer, normalizePhone(text("employerPhone", 20))),
    monthlyIncome: text("monthlyIncome", 16),
    yearsAtJob: ifPrev(employer, text("yearsAtJob", 2)),
    monthsAtJob: ifPrev(employer, text("monthsAtJob", 2)),
    incomeSource: ifPrev(!employer, text("incomeSource", 120)),
    hasPreviousEmployment,
    previousEmployerName: ifPrev(hasPreviousEmployment, text("previousEmployerName", 160)),
    previousJobTitle: ifPrev(hasPreviousEmployment, text("previousJobTitle", 120)),
    previousEmployerPhone: ifPrev(
      hasPreviousEmployment,
      normalizePhone(text("previousEmployerPhone", 20)),
    ),
    previousYearsAtJob: ifPrev(hasPreviousEmployment, text("previousYearsAtJob", 2)),
    previousMonthsAtJob: ifPrev(hasPreviousEmployment, text("previousMonthsAtJob", 2)),
  };
}

function wholeNumberError(value: string, max: number, label: string): string | null {
  if (!/^\d{1,2}$/.test(value.trim()) || Number(value) > max) return `Enter ${label} (0–${max}).`;
  return null;
}

/** Validates one applicant. Every message is safe to show next to its field. */
export function validateApplicantProfile(p: ApplicantProfile, today = new Date()): ApplicantErrors {
  const errors: ApplicantErrors = {};
  const todayIso = today.toISOString().slice(0, 10);

  if (!p.firstName.trim()) errors.firstName = "Enter a first name.";
  if (!p.lastName.trim()) errors.lastName = "Enter a last name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email.trim()))
    errors.email = "Enter a valid email address.";
  if (!isValidUsPhone(p.cellPhone)) errors.cellPhone = "Enter a valid 10-digit cell phone number.";
  if (p.homePhone.trim() && !isValidUsPhone(p.homePhone))
    errors.homePhone = "Enter a valid 10-digit phone number or leave it blank.";

  const age = ageOn(p.dateOfBirth, today);
  if (age === null) errors.dateOfBirth = "Enter a valid date of birth.";
  else if (p.dateOfBirth > todayIso) errors.dateOfBirth = "Date of birth can't be in the future.";
  else if (age < MIN_APPLICANT_AGE)
    errors.dateOfBirth = `Applicants must be at least ${MIN_APPLICANT_AGE} years old.`;
  else if (age > 120) errors.dateOfBirth = "Enter a valid date of birth.";

  const anyLicense =
    p.driversLicenseNumber ||
    p.driversLicenseState ||
    p.driversLicenseIssueDate ||
    p.driversLicenseExpiryDate;
  if (LICENSE_REQUIRED || anyLicense) {
    const dlError = licenseNumberError(p.driversLicenseNumber);
    if (dlError) errors.driversLicenseNumber = dlError;
    if (!isState(p.driversLicenseState)) errors.driversLicenseState = "Select the issuing state.";
  }
  if (p.driversLicenseIssueDate) {
    if (!isIsoDate(p.driversLicenseIssueDate))
      errors.driversLicenseIssueDate = "Enter a valid issue date.";
    else if (p.driversLicenseIssueDate > todayIso)
      errors.driversLicenseIssueDate = "Issue date can't be in the future.";
    else if (isIsoDate(p.dateOfBirth) && p.driversLicenseIssueDate < p.dateOfBirth)
      errors.driversLicenseIssueDate = "Issue date can't be before the date of birth.";
  }
  if (p.driversLicenseExpiryDate) {
    if (!isIsoDate(p.driversLicenseExpiryDate))
      errors.driversLicenseExpiryDate = "Enter a valid expiration date.";
    else if (
      isIsoDate(p.driversLicenseIssueDate) &&
      p.driversLicenseExpiryDate < p.driversLicenseIssueDate
    )
      errors.driversLicenseExpiryDate = "Expiration date can't be before the issue date.";
  }

  addressErrors(errors, p.street, p.city, p.state, p.zip, {
    street: "street",
    city: "city",
    state: "state",
    zip: "zip",
  });
  if (!HOUSING_TYPES.some((h) => h.value === p.housingType))
    errors.housingType = "Select a housing type.";
  if (parseMoney(p.monthlyHousingPayment) === null)
    errors.monthlyHousingPayment = "Enter the monthly amount (enter 0 if none).";
  if (p.hasPreviousAddress)
    addressErrors(errors, p.previousStreet, p.previousCity, p.previousState, p.previousZip, {
      street: "previousStreet",
      city: "previousCity",
      state: "previousState",
      zip: "previousZip",
    });

  if (!EMPLOYMENT_STATUSES.some((s) => s.value === p.employmentStatus))
    errors.employmentStatus = "Select an employment status.";
  else if (employmentNeedsEmployer(p.employmentStatus)) {
    if (!p.employerName.trim()) errors.employerName = "Enter the employer name.";
    if (!p.jobTitle.trim()) errors.jobTitle = "Enter a title or position.";
    if (!isValidUsPhone(p.employerPhone))
      errors.employerPhone = "Enter a valid 10-digit employer phone number.";
    const years = wholeNumberError(p.yearsAtJob, 60, "years at this job");
    if (years) errors.yearsAtJob = years;
    if (p.monthsAtJob.trim()) {
      const months = wholeNumberError(p.monthsAtJob, 11, "months");
      if (months) errors.monthsAtJob = months;
    }
  }
  if (parseMoney(p.monthlyIncome) === null)
    errors.monthlyIncome = "Enter monthly gross income before taxes (enter 0 if none).";

  if (p.hasPreviousEmployment) {
    if (!p.previousEmployerName.trim())
      errors.previousEmployerName = "Enter the previous employer name.";
    if (!p.previousJobTitle.trim()) errors.previousJobTitle = "Enter the previous title.";
    if (p.previousEmployerPhone.trim() && !isValidUsPhone(p.previousEmployerPhone))
      errors.previousEmployerPhone = "Enter a valid 10-digit phone number or leave it blank.";
    if (p.previousYearsAtJob.trim()) {
      const years = wholeNumberError(p.previousYearsAtJob, 60, "years");
      if (years) errors.previousYearsAtJob = years;
    }
    if (p.previousMonthsAtJob.trim()) {
      const months = wholeNumberError(p.previousMonthsAtJob, 11, "months");
      if (months) errors.previousMonthsAtJob = months;
    }
  }
  return errors;
}

function addressErrors(
  errors: ApplicantErrors,
  street: string,
  city: string,
  state: string,
  zip: string,
  keys: {
    street: ApplicantField;
    city: ApplicantField;
    state: ApplicantField;
    zip: ApplicantField;
  },
) {
  if (street.trim().length < 3) errors[keys.street] = "Enter the street address.";
  if (city.trim().length < 2) errors[keys.city] = "Enter the city.";
  if (!isState(state)) errors[keys.state] = "Select the state.";
  if (!isValidZip(zip)) errors[keys.zip] = "Enter a 5-digit ZIP code.";
  else if (zipMatchesState(zip, state) === false)
    errors[keys.zip] = "This ZIP code doesn't match the selected state.";
}

/** A Co-Buyer must be reachable on their own: their email can't be the Buyer's. */
export function coBuyerErrors(buyer: ApplicantProfile, coBuyer: ApplicantProfile): ApplicantErrors {
  const errors: ApplicantErrors = {};
  if (
    coBuyer.email.trim() &&
    coBuyer.email.trim().toLowerCase() === buyer.email.trim().toLowerCase()
  )
    errors.email = "The Co-Buyer needs their own email address.";
  return errors;
}

// ------------------------------------------------------------
// Interested vehicle and optional trade-in
// ------------------------------------------------------------

/** What the applicant would like when no in-stock vehicle is chosen. Never prices anything. */
export type VehiclePreferences = {
  year: string;
  make: string;
  model: string;
  exteriorColor: string;
  interiorColor: string;
};
export const EMPTY_VEHICLE_PREFERENCES: VehiclePreferences = {
  year: "",
  make: "",
  model: "",
  exteriorColor: "",
  interiorColor: "",
};

export type TradeIn = {
  year: string;
  make: string;
  model: string;
  mileage: string;
  payoff: string;
};
export const EMPTY_TRADE_IN: TradeIn = { year: "", make: "", model: "", mileage: "", payoff: "" };
export type TradeInErrors = Partial<Record<keyof TradeIn, string>>;

export function normalizeVehiclePreferences(raw: unknown): VehiclePreferences {
  const a = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = (key: keyof VehiclePreferences, max: number) =>
    String(a[key] ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, max);
  return {
    year: text("year", 4),
    make: text("make", 60),
    model: text("model", 80),
    exteriorColor: text("exteriorColor", 60),
    interiorColor: text("interiorColor", 60),
  };
}

export function validateVehiclePreferences(
  p: VehiclePreferences,
  today = new Date(),
): Partial<Record<keyof VehiclePreferences, string>> {
  if (p.year && !isModelYear(p.year, today)) return { year: "Enter a 4-digit model year." };
  return {};
}

export function normalizeTradeIn(raw: unknown): TradeIn {
  const a = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = (key: keyof TradeIn, max: number) =>
    String(a[key] ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, max);
  return {
    year: text("year", 4),
    make: text("make", 60),
    model: text("model", 80),
    mileage: digitsOnly(text("mileage", 12)).slice(0, 7),
    payoff: text("payoff", 16),
  };
}

const isModelYear = (year: string, today: Date) =>
  /^\d{4}$/.test(year) && Number(year) >= 1950 && Number(year) <= today.getUTCFullYear() + 2;

export function validateTradeIn(t: TradeIn, today = new Date()): TradeInErrors {
  const errors: TradeInErrors = {};
  if (!isModelYear(t.year, today)) errors.year = "Enter the trade-in's 4-digit model year.";
  if (!t.make.trim()) errors.make = "Enter the make.";
  if (!t.model.trim()) errors.model = "Enter the model.";
  if (t.mileage && !/^\d{1,7}$/.test(t.mileage)) errors.mileage = "Enter mileage in whole miles.";
  if (t.payoff && parseMoney(t.payoff) === null)
    errors.payoff = "Enter the amount still owed, or leave it blank.";
  return errors;
}

// ------------------------------------------------------------
// Consents (wording lives in lease-to-own-content.ts)
// ------------------------------------------------------------

export const LEASE_CONSENT_TYPES = [
  "marketing_sms",
  "transactional_sms",
  "credit_authorization",
  "application_certification",
] as const;
export type LeaseConsentType = (typeof LEASE_CONSENT_TYPES)[number];
export type ConsentChoices = Record<LeaseConsentType, boolean>;

/** Optional consents start unchecked and are never required to apply. */
export const REQUIRED_CONSENTS: readonly LeaseConsentType[] = [
  "credit_authorization",
  "application_certification",
];

export const EMPTY_CONSENTS: ConsentChoices = {
  marketing_sms: false,
  transactional_sms: false,
  credit_authorization: false,
  application_certification: false,
};

/** Only literal `true` counts as consent; anything else is a "no". */
export function normalizeConsents(raw: unknown): ConsentChoices {
  const a = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(
    LEASE_CONSENT_TYPES.map((type) => [type, a[type] === true]),
  ) as ConsentChoices;
}

export function missingRequiredConsents(choices: ConsentChoices): LeaseConsentType[] {
  return REQUIRED_CONSENTS.filter((type) => !choices[type]);
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

export function isApplicantRole(value: unknown): value is ApplicantRole {
  return value === "buyer" || value === "co_buyer";
}

/**
 * Current status of each customer document for one applicant (newest first in
 * `documents`). The Buyer also owns unassigned rows, which predate Co-Buyers.
 */
export function applicantDocumentStatuses(
  documents: ReadonlyArray<{
    doc_type: string;
    status: LeaseDocStatus;
    source: string;
    applicant_id: number | null;
  }>,
  applicantId: number | null,
  isBuyer: boolean,
): Partial<Record<LeaseDocType, LeaseDocStatus>> {
  const out: Partial<Record<LeaseDocType, LeaseDocStatus>> = {};
  for (const doc of documents) {
    if (doc.source !== "customer" || doc.status === "pending" || !isLeaseDocType(doc.doc_type))
      continue;
    const mine = doc.applicant_id === applicantId || (isBuyer && doc.applicant_id === null);
    if (mine && !out[doc.doc_type]) out[doc.doc_type] = doc.status;
  }
  return out;
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
/** Thrown by the production server until counsel approves the required consent wording. */
export const LEASE_CONSENTS_PENDING_APPROVAL = "LEASE_CONSENTS_PENDING_APPROVAL";
/** Version of the Buyer / Co-Buyer pre-qualification form, stored with each application. */
export const PREQUAL_FORM_VERSION = "prequal-2026-10";

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
