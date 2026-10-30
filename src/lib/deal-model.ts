/**
 * Lease to Own — shared deal model used by every contract form.
 *
 * One flat record of fields keyed like "buyer.firstName", "vehicle.vin" or
 * "line.1". Each field carries its provenance (where the value came from,
 * whether it is verified, who may edit it, whether staff changed it), so
 * Forms 1–10 read the same values instead of retyping them, and a later
 * update can never silently overwrite a staff-approved value.
 *
 * Buyer and Co-Buyer live under separate keys ("buyer.*" / "coBuyer.*") and
 * are never copied into each other.
 */
import { parseCents } from "./money";
import { CREDIT_APPLICATION_FIELD_DEFS } from "./credit-application-fields";
import { DELIVERY_CHECKLIST_FIELD_DEFS } from "./delivery-checklist-fields";
import { GPS_DISCLOSURE_FIELD_DEFS } from "./gps-disclosure-fields";
import { INSURANCE_AGREEMENT_FIELD_DEFS } from "./insurance-agreement-fields";
import { RETAIL_INSTALLMENT_FIELD_DEFS } from "./retail-installment-fields";

export type FieldSource =
  | "application" // entered by the applicant (self-reported)
  | "inventory" // My Car inventory record
  | "package" // Lease to Own package estimate
  | "dealer_profile" // My Car business details
  | "document" // a staff-reviewed uploaded document
  | "staff" // entered or corrected by authorized staff
  | "demo" // fictional local-demo value
  | "none";

/**
 * "money" is cents or blank. "amount" (Form 2) also records an explicit "N/A"
 * or "INCL.", so a blank stays unknown instead of silently counting as zero.
 */
export type FieldKind =
  "text" | "money" | "amount" | "percent" | "integer" | "date" | "choice" | "boolean";
/** Who may change a field. Customers never edit contract fields directly. */
export type FieldEditor = "staff" | "none";

export type FieldValue = string | number | boolean | null;

export type DealField = {
  value: FieldValue;
  source: FieldSource;
  verified: boolean;
  editable: FieldEditor;
  /** Changed by staff after prefill; protected from automatic updates. */
  edited: boolean;
  required: boolean;
};

export type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  editable?: FieldEditor;
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** Range for "integer" fields (default 1–999). */
  min?: number;
  max?: number;
};

const party = (prefix: "buyer" | "coBuyer", required: boolean): FieldDef[] => [
  { key: `${prefix}.firstName`, label: "First name", kind: "text", required },
  { key: `${prefix}.lastName`, label: "Last name", kind: "text", required },
  { key: `${prefix}.phone`, label: "Phone", kind: "text", required },
  { key: `${prefix}.email`, label: "Email", kind: "text" },
  { key: `${prefix}.street`, label: "Street address", kind: "text", required },
  { key: `${prefix}.city`, label: "City", kind: "text", required },
  { key: `${prefix}.state`, label: "State", kind: "text", required },
  { key: `${prefix}.zip`, label: "ZIP", kind: "text", required },
];

const tradeIn = (n: 1 | 2): FieldDef[] =>
  [
    ["year", "Year"],
    ["make", "Make"],
    ["model", "Model"],
    ["bodyStyle", "Body Style"],
    ["vin", "VIN"],
    ["licenseNumber", "Lic. No."],
    ["odometer", "Odometer Reading"],
    ["color", "Color"],
    ["lienholderName", "Lienholder Name"],
    ["lienholderAddress", "Address"],
    ["lienholderPhone", "Phone"],
  ]
    .map(([k, label]): FieldDef => ({ key: `tradeIn${n}.${k}`, label: label!, kind: "text" }))
    .concat([
      { key: `tradeIn${n}.payoff`, label: "Payoff", kind: "text" },
      { key: `tradeIn${n}.payoffGoodThrough`, label: "Payoff good through", kind: "date" },
      { key: `tradeIn${n}.approved`, label: "Approved", kind: "text" },
    ]);

/** Configurable labels for itemization lines that the reference leaves blank. */
export const CONFIGURABLE_LINE_LABELS = [13, 14, 17, 18, 19, 20, 21, 22] as const;
/** Itemization lines entered by staff (the rest are calculated). */
export const INPUT_LINES = [
  1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 25, 26, 28, 29,
] as const;

export const DEAL_FIELD_DEFS: readonly FieldDef[] = [
  // Dealer / Seller
  { key: "dealer.legalName", label: "Dealer/Seller name", kind: "text", required: true },
  { key: "dealer.street", label: "Street", kind: "text", required: true },
  { key: "dealer.city", label: "City", kind: "text", required: true },
  { key: "dealer.state", label: "State", kind: "text", required: true },
  { key: "dealer.zip", label: "ZIP", kind: "text", required: true },
  { key: "dealer.phone", label: "Phone", kind: "text", required: true },
  { key: "dealer.licenseNumber", label: "Dealer license no.", kind: "text" },
  { key: "dealer.salesperson", label: "Salesperson", kind: "text", required: true },
  {
    key: "dealer.authorizedSigner",
    label: "Authorized dealer signer",
    kind: "text",
    required: true,
  },
  // Transaction
  { key: "deal.date", label: "Date", kind: "date", required: true },
  { key: "deal.stockNumber", label: "Stock No.", kind: "text", required: true },
  { key: "deal.appNumber", label: "App No.", kind: "text", required: true },
  { key: "deal.contractNumber", label: "Contract No.", kind: "text", required: true },
  // Parties
  ...party("buyer", true),
  ...party("coBuyer", false),
  // Vehicle
  {
    key: "vehicle.condition",
    label: "Condition",
    kind: "choice",
    required: true,
    options: [
      { value: "new", label: "New" },
      { value: "used", label: "Used" },
      { value: "demo", label: "Demo" },
    ],
  },
  { key: "vehicle.year", label: "Year", kind: "text", required: true },
  { key: "vehicle.make", label: "Make", kind: "text", required: true },
  { key: "vehicle.model", label: "Model", kind: "text", required: true },
  { key: "vehicle.bodyStyle", label: "Body Style", kind: "text" },
  { key: "vehicle.vin", label: "VIN", kind: "text", required: true },
  { key: "vehicle.licenseNumber", label: "Lic. No.", kind: "text" },
  { key: "vehicle.odometer", label: "Odometer Reading", kind: "text", required: true },
  { key: "vehicle.color", label: "Color", kind: "text" },
  { key: "vehicle.other", label: "Other", kind: "text" },
  // Insurance
  { key: "insurance.company", label: "Insurance Company", kind: "text" },
  { key: "insurance.policyNumber", label: "Policy No.", kind: "text" },
  {
    key: "insurance.status",
    label: "Insurance status",
    kind: "choice",
    options: [
      { value: "not_provided", label: "Not provided" },
      { value: "information_entered", label: "Information entered" },
      { value: "provided_unverified", label: "Document uploaded — not verified" },
      { value: "pending_verification", label: "Pending verification" },
      { value: "verified", label: "Verified by staff" },
      { value: "expired", label: "Expired" },
      { value: "rejected", label: "Verification rejected" },
    ],
  },
  // Trade-ins
  ...tradeIn(1),
  ...tradeIn(2),
  // Itemization: entered lines and their configurable labels
  ...INPUT_LINES.map((n) => ({ key: `line.${n}`, label: `Line ${n}`, kind: "money" as const })),
  ...CONFIGURABLE_LINE_LABELS.map((n) => ({
    key: `lineLabel.${n}`,
    label: `Line ${n} label`,
    kind: "text" as const,
  })),
  { key: "asIs", label: '"AS IS" acknowledgment', kind: "boolean" },
  // Page 3 notice checkboxes (staff mark which apply; wording comes from the approved template).
  { key: "notice.demonstrator", label: "Demonstrator mileage notice applies", kind: "boolean" },
  { key: "notice.financing", label: "Financing notice applies", kind: "boolean" },
  { key: "notice.arbitration", label: "Separate arbitration agreement", kind: "boolean" },
  // Form 2 — Retail Installment Contract (see retail-installment-fields.ts)
  ...RETAIL_INSTALLMENT_FIELD_DEFS,
  // Form 3 — Credit Application (see credit-application-fields.ts)
  ...CREDIT_APPLICATION_FIELD_DEFS,
  // Form 4 — GPS Disclosure (see gps-disclosure-fields.ts)
  ...GPS_DISCLOSURE_FIELD_DEFS,
  // Form 5 — Delivery Checklist (see delivery-checklist-fields.ts)
  ...DELIVERY_CHECKLIST_FIELD_DEFS,
  // Form 6 — Insurance Agreement (see insurance-agreement-fields.ts)
  ...INSURANCE_AGREEMENT_FIELD_DEFS,
];

const DEF_BY_KEY = new Map(DEAL_FIELD_DEFS.map((d) => [d.key, d]));

export function fieldDef(key: string): FieldDef | undefined {
  return DEF_BY_KEY.get(key);
}

export type Deal = {
  applicationId: number | null;
  coBuyerIncluded: boolean;
  /** Set when staff lock the financial terms; further changes need staff review. */
  financialsLocked: boolean;
  fields: Record<string, DealField>;
};

function blankField(def: FieldDef, coBuyerIncluded: boolean): DealField {
  return {
    value:
      def.kind === "boolean"
        ? false
        : ["money", "amount", "percent", "integer"].includes(def.kind)
          ? null
          : "",
    source: "none",
    verified: false,
    editable: def.editable ?? "staff",
    edited: false,
    required: Boolean(def.required) && (coBuyerIncluded || !def.key.startsWith("coBuyer.")),
  };
}

// ------------------------------------------------------------
// Prefill from the existing application, applicants and inventory
// ------------------------------------------------------------

export type DealSourceParty = {
  applicantId: number;
  firstName: string;
  lastName: string;
  email: string;
  /** The applicant's cell phone from the pre-qualification. */
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  /** Credit-application details the pre-qualification already collected (Form 3). */
  credit?: DealSourceCredit;
};

/**
 * Applicant details from mc_lease_applicants. Identity numbers arrive masked
 * only: the license as its last 4 digits, SSN/ITIN as the secure provider's
 * status and last 4. A raw SSN or full license number is never part of a deal.
 */
export type DealSourceCredit = {
  dateOfBirth: string;
  dlLast4: string;
  dlState: string;
  dlIssueDate: string;
  dlExpiryDate: string;
  ssnStatus: "not_collected" | "pending" | "collected" | "verified" | "failed";
  ssnLast4: string | null;
  homePhone: string;
  unit: string;
  /** Pre-qualification housing type: rent, own, mortgage, family, military, other. */
  housingType: string;
  monthlyHousingCents: number | null;
  previousAddress: { street: string; city: string; state: string; zip: string } | null;
  employmentStatus: string;
  /** False for statuses without an employer (retired, unemployed, other). */
  hasEmployer: boolean;
  employerName: string;
  jobTitle: string;
  employerPhone: string;
  monthlyIncomeCents: number | null;
  yearsAtJob: string;
  monthsAtJob: string;
  incomeSource: string;
  previousEmployment: { employerName: string; employerPhone: string } | null;
  consents: { creditAuthorization: boolean; applicationCertification: boolean };
};

/** Pre-qualification housing type → credit application residential status (same meaning only). */
const RESIDENTIAL_STATUS: Record<string, string> = {
  rent: "rent",
  own: "own",
  mortgage: "own",
  family: "relatives",
  military: "other",
  other: "other",
};

export type DealSource = {
  applicationId: number;
  appNumber: string;
  buyer: DealSourceParty;
  coBuyer: DealSourceParty | null;
  /** The selected inventory vehicle, if one was chosen. */
  vehicle: {
    stockNumber: string;
    vin: string;
    year: string;
    make: string;
    model: string;
    bodyStyle: string;
    mileage: string;
    color: string;
    condition: "new" | "used" | "demo";
    priceCents: number;
  } | null;
  /** Trade-in the applicant described on the pre-qualification form. */
  tradeIn: {
    year: string;
    make: string;
    model: string;
    mileage: string;
    payoffCents: number | null;
  } | null;
  /** Down payment from the selected Lease to Own package. */
  packageDownCents: number | null;
  /** Insurance declaration document status, from the existing upload/review flow. */
  insuranceDocument: { status: "missing" | "uploaded" | "verified"; documentId: number | null };
  dealer: {
    legalName: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
  };
  date: string;
};

/** Builds a deal from existing records. Nothing is invented: unknown values stay blank. */
export function buildDealFromApplication(src: DealSource): Deal {
  const coBuyerIncluded = Boolean(src.coBuyer);
  const fields: Record<string, DealField> = {};
  for (const def of DEAL_FIELD_DEFS) fields[def.key] = blankField(def, coBuyerIncluded);
  const set = (key: string, value: FieldValue, source: FieldSource, verified = false) => {
    const field = fields[key];
    if (!field || value === "" || value === null || value === undefined) return;
    fields[key] = { ...field, value, source, verified };
  };

  set("dealer.legalName", src.dealer.legalName, "dealer_profile");
  set("dealer.street", src.dealer.street, "dealer_profile");
  set("dealer.city", src.dealer.city, "dealer_profile");
  set("dealer.state", src.dealer.state, "dealer_profile");
  set("dealer.zip", src.dealer.zip, "dealer_profile");
  set("dealer.phone", src.dealer.phone, "dealer_profile");
  set("deal.date", src.date, "application");
  set("deal.appNumber", src.appNumber, "application", true);

  const setParty = (prefix: "buyer" | "coBuyer", p: DealSourceParty) => {
    set(`${prefix}.firstName`, p.firstName, "application");
    set(`${prefix}.lastName`, p.lastName, "application");
    set(`${prefix}.phone`, p.phone, "application");
    set(`${prefix}.email`, p.email, "application");
    set(`${prefix}.street`, p.street, "application");
    set(`${prefix}.city`, p.city, "application");
    set(`${prefix}.state`, p.state, "application");
    set(`${prefix}.zip`, p.zip, "application");
    const c = p.credit;
    if (!c) return;
    const k = (suffix: string) => `${prefix}.${suffix}`;
    set(k("dob"), c.dateOfBirth, "application");
    if (c.dlLast4) {
      set(k("idType"), "drivers_license", "application");
      set(k("idLast4"), c.dlLast4, "application");
    }
    set(k("idIssuedBy"), c.dlState, "application");
    set(k("idIssueDate"), c.dlIssueDate, "application");
    set(k("idExpiryDate"), c.dlExpiryDate, "application");
    set(k("ssnStatus"), c.ssnStatus, "application", c.ssnStatus === "verified");
    set(k("ssnLast4"), c.ssnLast4, "application", c.ssnStatus === "verified");
    set(k("phoneCell"), Boolean(p.phone), "application");
    set(k("secondPhone"), c.homePhone, "application");
    set(k("unit"), c.unit, "application");
    set(k("residentialStatus"), RESIDENTIAL_STATUS[c.housingType] ?? "", "application");
    set(k("monthlyHousing"), c.monthlyHousingCents, "application");
    if (c.previousAddress) {
      set(k("prevStreet"), c.previousAddress.street, "application");
      set(k("prevCity"), c.previousAddress.city, "application");
      set(k("prevState"), c.previousAddress.state, "application");
      set(k("prevZip"), c.previousAddress.zip, "application");
    }
    set(k("employmentStatus"), c.employmentStatus, "application");
    if (c.hasEmployer) {
      set(k("employer"), c.employerName, "application");
      set(k("jobTitle"), c.jobTitle, "application");
      set(k("workPhone"), c.employerPhone, "application");
      set(k("income"), c.monthlyIncomeCents, "application");
      const yrs = Number(c.yearsAtJob);
      const mos = Number(c.monthsAtJob);
      if (c.yearsAtJob !== "" && Number.isInteger(yrs)) set(k("yearsAtJob"), yrs, "application");
      if (c.monthsAtJob !== "" && Number.isInteger(mos)) set(k("monthsAtJob"), mos, "application");
    } else if (c.monthlyIncomeCents !== null) {
      // No employer: the income is other income attributed to this applicant, never a fake job.
      const row = prefix === "buyer" ? 1 : 2;
      set(`credit.otherIncome.${row}.party`, prefix === "buyer" ? "a" : "b", "application");
      set(`credit.otherIncome.${row}.amount`, c.monthlyIncomeCents, "application");
      set(`credit.otherIncome.${row}.source`, c.incomeSource || c.employmentStatus, "application");
    }
    if (c.previousEmployment) {
      set(k("prevEmployer"), c.previousEmployment.employerName, "application");
      set(k("prevEmployerPhone"), c.previousEmployment.employerPhone, "application");
    }
    set(k("consentCreditAuthorization"), c.consents.creditAuthorization, "application", true);
    set(k("consentCertification"), c.consents.applicationCertification, "application", true);
  };
  setParty("buyer", src.buyer);
  if (src.coBuyer) setParty("coBuyer", src.coBuyer);

  if (src.vehicle) {
    const v = src.vehicle;
    set("deal.stockNumber", v.stockNumber, "inventory", true);
    set("vehicle.condition", v.condition, "inventory", true);
    set("vehicle.year", v.year, "inventory", true);
    set("vehicle.make", v.make, "inventory", true);
    set("vehicle.model", v.model, "inventory", true);
    set("vehicle.bodyStyle", v.bodyStyle, "inventory", true);
    set("vehicle.vin", v.vin, "inventory", true);
    set("vehicle.odometer", v.mileage, "inventory");
    set("vehicle.color", v.color, "inventory", true);
    // The listed price is a starting point; staff confirm the approved price.
    set("line.1", v.priceCents, "inventory");
  }
  if (src.tradeIn) {
    set("tradeIn1.year", src.tradeIn.year, "application");
    set("tradeIn1.make", src.tradeIn.make, "application");
    set("tradeIn1.model", src.tradeIn.model, "application");
    set("tradeIn1.odometer", src.tradeIn.mileage, "application");
    if (src.tradeIn.payoffCents !== null) set("line.26", src.tradeIn.payoffCents, "application");
  }
  set("line.28", src.packageDownCents, "package");
  set(
    "insurance.status",
    src.insuranceDocument.status === "verified"
      ? "verified"
      : src.insuranceDocument.status === "uploaded"
        ? "provided_unverified"
        : "not_provided",
    "document",
    src.insuranceDocument.status === "verified",
  );
  if (src.insuranceDocument.documentId !== null)
    set("insurance.documentId", String(src.insuranceDocument.documentId), "document");
  return { applicationId: src.applicationId, coBuyerIncluded, financialsLocked: false, fields };
}

// ------------------------------------------------------------
// Editing, propagation and checks
// ------------------------------------------------------------

export type EditActor = "staff" | "customer";

const FINANCIAL_PREFIXES = [
  "line.",
  "lineLabel.",
  "ric.item.",
  "ric.schedule.",
  "ric.contractRate",
  "ric.postMaturityRate",
  "ric.addlCharge",
  "credit.dealer.",
];
const isFinancialKey = (key: string) => FINANCIAL_PREFIXES.some((p) => key.startsWith(p));

/** Applies one edit, enforcing who may edit and the financial lock. */
export function editDealField(
  deal: Deal,
  key: string,
  raw: string | boolean,
  actor: EditActor,
): { deal: Deal; error?: string } {
  const def = fieldDef(key);
  const field = deal.fields[key];
  if (!def || !field) return { deal, error: "Unknown field." };
  if (actor !== "staff" || field.editable !== "staff")
    return { deal, error: "Only authorized staff can change contract fields." };
  if (deal.financialsLocked && isFinancialKey(key))
    return {
      deal,
      error: "Financial terms are locked. A staff review is required to change them.",
    };
  let value: FieldValue;
  if (def.kind === "money") {
    const text = String(raw).trim();
    if (text === "" || /^n\/?a$/i.test(text)) value = null;
    else {
      const cents = parseCents(text);
      if (cents === null) return { deal, error: "Enter an amount like 1,250.00." };
      if (cents < 0) return { deal, error: "Amounts can't be negative." };
      value = cents;
    }
  } else if (def.kind === "amount") {
    const text = String(raw).trim();
    if (text === "") value = null;
    else if (/^n\/?a$/i.test(text)) value = "N/A";
    else if (/^incl\.?$/i.test(text)) value = "INCL.";
    else {
      const cents = parseCents(text);
      if (cents === null) return { deal, error: "Enter an amount like 1,250.00, or N/A." };
      if (cents < 0) return { deal, error: "Amounts can't be negative." };
      value = cents;
    }
  } else if (def.kind === "percent") {
    const text = String(raw).trim().replace(/%$/, "");
    if (text === "") value = null;
    else if (!/^\d{1,2}(\.\d{1,3})?$/.test(text))
      return { deal, error: "Enter a rate like 12.5 (up to 3 decimals)." };
    else value = Number(text);
  } else if (def.kind === "integer") {
    const text = String(raw).trim();
    if (text === "") value = null;
    else if (
      !/^\d{1,3}$/.test(text) ||
      Number(text) < (def.min ?? 1) ||
      Number(text) > (def.max ?? 999)
    )
      return {
        deal,
        error: `Enter a whole number from ${def.min ?? 1} to ${def.max ?? 999}.`,
      };
    else value = Number(text);
  } else if (def.kind === "boolean") value = raw === true;
  else if (def.kind === "choice") {
    value = String(raw);
    if (value !== "" && !def.options?.some((o) => o.value === value))
      return { deal, error: "Choose one of the listed options." };
  } else value = String(raw).slice(0, 200);
  return {
    deal: {
      ...deal,
      fields: {
        ...deal.fields,
        [key]: { ...field, value, source: "staff", verified: false, edited: true },
      },
    },
  };
}

export type FieldConflict = { key: string; current: FieldValue; incoming: FieldValue };

/**
 * Applies newer values from the shared records (e.g. a corrected application)
 * without silently overwriting staff-edited fields: those come back as
 * conflicts for staff to resolve.
 */
export function mergeSharedValues(
  deal: Deal,
  incoming: Record<string, { value: FieldValue; source: FieldSource; verified?: boolean }>,
): { deal: Deal; conflicts: FieldConflict[] } {
  const fields = { ...deal.fields };
  const conflicts: FieldConflict[] = [];
  for (const [key, next] of Object.entries(incoming)) {
    const field = fields[key];
    if (!field || field.value === next.value) continue;
    if (field.edited || (deal.financialsLocked && isFinancialKey(key))) {
      conflicts.push({ key, current: field.value, incoming: next.value });
      continue;
    }
    fields[key] = {
      ...field,
      value: next.value,
      source: next.source,
      verified: Boolean(next.verified),
    };
  }
  return { deal: { ...deal, fields }, conflicts };
}

export function fieldIsEmpty(field: DealField): boolean {
  return field.value === null || field.value === "" || field.value === false;
}

/** Required fields that are still blank, as their keys. */
export function missingRequiredFields(deal: Deal, keys?: readonly string[]): string[] {
  return (keys ?? Object.keys(deal.fields)).filter((key) => {
    const field = deal.fields[key];
    return field?.required && fieldIsEmpty(field);
  });
}

export const text = (deal: Deal, key: string): string => {
  const v = deal.fields[key]?.value;
  return v === null || v === undefined || v === false ? "" : String(v);
};
export const cents = (deal: Deal, key: string): number | null => {
  const v = deal.fields[key]?.value;
  return typeof v === "number" ? v : null;
};
export const fullName = (deal: Deal, prefix: "buyer" | "coBuyer"): string =>
  [text(deal, `${prefix}.firstName`), text(deal, `${prefix}.lastName`)].filter(Boolean).join(" ");
