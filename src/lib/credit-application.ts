/**
 * Form 3 — Retail Motor Vehicle Credit Application: conditional sections,
 * state-notice applicability, For Dealer Use Only values, missing information
 * and signature/initials locations.
 *
 * Structure follows the three-page reference (field names and placement only).
 * Its legal wording, certification and notices are NOT reproduced: those stay
 * "approved template required". The form is a structured view of the existing
 * pre-qualification application (same Buyer / Co-Buyer records), plus only the
 * details that application did not collect.
 */
import type { SignatureRequirement } from "./bill-of-sale";
import { cents, fullName, text, type Deal } from "./deal-model";
import { formatCents } from "./money";
import type { CreditParty } from "./credit-application-fields";
import {
  computeDisclosures,
  computeItemization,
  formatAmount,
  readSchedule,
} from "./retail-installment";

export const CREDIT_APP_STRUCTURE_REVIEW =
  "The reference is a credit-sale application. Whether Lease to Own is a credit sale or a lease must be confirmed by management/legal before this form is used for a real deal.";

/** The reference asks for previous address / employer when under 2 years. Change only with approval. */
export const PREVIOUS_HISTORY_MONTHS = 24;

export const jointCreditRequested = (deal: Deal) => text(deal, "credit.creditType") === "joint";

const num = (deal: Deal, key: string): number | null => {
  const v = deal.fields[key]?.value;
  return typeof v === "number" ? v : null;
};

/** Total months from "years" and "months" fields; null when the years are unknown. */
export function durationMonths(deal: Deal, yearsKey: string, monthsKey: string): number | null {
  const y = num(deal, yearsKey);
  if (y === null) return null;
  return y * 12 + (num(deal, monthsKey) ?? 0);
}

/**
 * Previous address/employer apply when the current one is under the approved
 * threshold, when the duration is still unknown, or when details already exist.
 */
export function previousAddressApplies(deal: Deal, party: CreditParty): boolean {
  const m = durationMonths(deal, `${party}.yearsAtAddress`, `${party}.monthsAtAddress`);
  return m === null || m < PREVIOUS_HISTORY_MONTHS || Boolean(text(deal, `${party}.prevStreet`));
}
export function previousEmployerApplies(deal: Deal, party: CreditParty): boolean {
  const hasEmployer = Boolean(text(deal, `${party}.employer`));
  const m = durationMonths(deal, `${party}.yearsAtJob`, `${party}.monthsAtJob`);
  return (
    Boolean(text(deal, `${party}.prevEmployer`)) ||
    (hasEmployer && (m === null || m < PREVIOUS_HISTORY_MONTHS))
  );
}

// ------------------------------------------------------------
// State-specific notices (configurable applicability)
// ------------------------------------------------------------

export type StateNotice = { state: string; title: string };

/** Notice sections on the reference's page 2. Wording comes from the approved template. */
export const CREDIT_STATE_NOTICES: readonly StateNotice[] = [
  { state: "CA", title: "California Residents" },
  { state: "ME", title: "Maine Residents" },
  { state: "NH", title: "New Hampshire Residents" },
  { state: "NY", title: "New York Residents" },
  { state: "OH", title: "Ohio Residents" },
  { state: "WI", title: "Wisconsin Residents" },
];

/**
 * PROVISIONAL rule until counsel approves one: a state's notice applies when an
 * applicant on this application (A, or B when joint) lives in that state.
 */
export const NOTICE_RULE_STATUS = "Provisional rule (applicant residence) — approval required";

export function applicantStates(deal: Deal): string[] {
  const parties: CreditParty[] =
    jointCreditRequested(deal) && deal.coBuyerIncluded ? ["buyer", "coBuyer"] : ["buyer"];
  return [...new Set(parties.map((p) => text(deal, `${p}.state`).toUpperCase()).filter(Boolean))];
}

export function applicableStateNotices(deal: Deal): StateNotice[] {
  const states = applicantStates(deal);
  return CREDIT_STATE_NOTICES.filter((n) => states.includes(n.state));
}

export const wisconsinApplies = (deal: Deal) =>
  applicableStateNotices(deal).some((n) => n.state === "WI");

/** The non-joint spouse signs only for Wisconsin, a married/separated applicant, and a named spouse. */
export const wisconsinSpouseSigns = (deal: Deal) =>
  wisconsinApplies(deal) &&
  ["married", "separated"].includes(text(deal, "credit.wi.maritalStatus")) &&
  Boolean(text(deal, "credit.wi.spouseName"));

// ------------------------------------------------------------
// For Dealer Use Only
// ------------------------------------------------------------

export type DealerUseValue = {
  label: string;
  /** Shown value; "" when unknown. */
  value: string;
  /** Where the value comes from. */
  source: string;
  /** Staff-editable deal field, when this form owns the value. */
  editKey?: string;
};

const money = (c: number | null) => (c === null ? "" : `$${formatCents(c)}`);

/**
 * Financial values come from Forms 1–2 where the meaning is the same; values
 * no other form holds (book value, cash selling price, products & fees) are
 * entered by staff here. The contract rate and the APR are shown separately.
 */
export function dealerUseFinancials(deal: Deal): DealerUseValue[] {
  const items = computeItemization(deal);
  const tila = computeDisclosures(deal);
  const installments = readSchedule(deal).rows.filter((r) => r.kind === "installment");
  const term = installments.reduce((n, r) => n + r.count, 0);
  const rate = num(deal, "ric.contractRate");
  return [
    {
      label: "Cash selling price",
      value: money(cents(deal, "credit.dealer.cashSellingPrice")),
      source: "Staff entry",
      editKey: "credit.dealer.cashSellingPrice",
    },
    { label: "Net trade", value: formatAmount(items.d.amount), source: "Form 2, row d" },
    { label: "Cash down", value: formatAmount(items.e.amount), source: "Form 2, row e" },
    {
      label: "Products & fees",
      value: money(cents(deal, "credit.dealer.productsAndFees")),
      source: "Staff entry",
      editKey: "credit.dealer.productsAndFees",
    },
    { label: "Amount financed", value: formatAmount(items.aa.amount), source: "Form 2, row aa" },
    {
      label: "Term",
      value: term ? `${term}` : "",
      source: "Form 2 payment schedule (installments)",
    },
    {
      label: "Contract rate",
      value: rate === null ? "" : `${rate}%`,
      source: "Form 2 Sales Agreement rate (not the APR)",
    },
    {
      label: "APR (reference only)",
      value:
        tila.aprPercent === null || tila.status === "pending"
          ? ""
          : `${tila.aprPercent.toFixed(2)}%`,
      source: "Form 2 Truth-In-Lending Disclosure",
    },
  ];
}

export function dealerUseTradeIn(deal: Deal): DealerUseValue[] {
  const items = computeItemization(deal);
  return [
    { label: "Trade in year", value: text(deal, "tradeIn1.year"), source: "Trade-in 1 (Form 1)" },
    { label: "Make", value: text(deal, "tradeIn1.make"), source: "Trade-in 1 (Form 1)" },
    { label: "Model", value: text(deal, "tradeIn1.model"), source: "Trade-in 1 (Form 1)" },
    { label: "Body style", value: text(deal, "tradeIn1.bodyStyle"), source: "Trade-in 1 (Form 1)" },
    {
      label: "Lienholder",
      value: text(deal, "tradeIn1.lienholderName"),
      source: "Trade-in 1 (Form 1)",
    },
    {
      label: "Allowance",
      value: formatAmount(items.b.amount),
      source: "Form 2 row b / Form 1 line 25",
    },
    {
      label: "Payoff",
      value: formatAmount(items.c.amount),
      source: "Form 2 row c / Form 1 line 26",
    },
  ];
}

// ------------------------------------------------------------
// Checks and missing information
// ------------------------------------------------------------

export type CreditAppIssue = { id: string; message: string };

export function creditApplicationIssues(deal: Deal): CreditAppIssue[] {
  const issues: CreditAppIssue[] = [];
  const type = text(deal, "credit.creditType");
  if (type === "joint" && !deal.coBuyerIncluded)
    issues.push({
      id: "joint-without-b",
      message: "Joint credit is selected, but there is no Joint Applicant on this deal.",
    });
  if (type && type !== "joint" && deal.coBuyerIncluded)
    issues.push({
      id: "cobuyer-not-joint",
      message:
        "A Co-Buyer is on the deal, but joint credit is not requested. Confirm with both applicants; joint credit is never assumed.",
    });
  for (const n of [1, 2]) {
    const party = text(deal, `credit.otherIncome.${n}.party`);
    if (party === "b" && !deal.coBuyerIncluded)
      issues.push({
        id: `other-income-${n}`,
        message: `Other income row ${n} is attributed to (B), but there is no Joint Applicant.`,
      });
    if (cents(deal, `credit.otherIncome.${n}.amount`) !== null && !party)
      issues.push({
        id: `other-income-${n}-party`,
        message: `Other income row ${n}: choose (A) or (B).`,
      });
  }
  return issues;
}

const PARTY_LABEL: Record<CreditParty, string> = {
  buyer: "Applicant (A)",
  coBuyer: "Joint Applicant (B)",
};

/** Details still needed, per applicant. Only the gaps, never the whole application again. */
export function creditApplicationMissing(deal: Deal): string[] {
  const missing: string[] = [];
  if (!text(deal, "credit.saleOrLease")) missing.push("Credit Sale / Lease");
  if (!text(deal, "credit.creditType")) missing.push("Type of credit requested");
  const parties: CreditParty[] =
    jointCreditRequested(deal) && deal.coBuyerIncluded ? ["buyer", "coBuyer"] : ["buyer"];
  for (const p of parties) {
    const who = PARTY_LABEL[p];
    const need = (suffix: string, label: string) =>
      !text(deal, `${p}.${suffix}`) && missing.push(`${who}: ${label}`);
    if (!fullName(deal, p)) missing.push(`${who}: full name`);
    need("dob", "date of birth");
    need("idType", "Gov't ID type");
    need("idLast4", "Gov't ID (secure storage)");
    if (!["collected", "verified"].includes(text(deal, `${p}.ssnStatus`)))
      missing.push(`${who}: SSN/ITIN — secure identity integration required`);
    need("street", "street address");
    need("yearsAtAddress", "time at address");
    need("residentialStatus", "residential status");
    if (
      previousAddressApplies(deal, p) &&
      durationMonths(deal, `${p}.yearsAtAddress`, `${p}.monthsAtAddress`) !== null
    )
      need("prevStreet", "previous address (under 2 years)");
    const otherIncome = [1, 2].some(
      (n) => text(deal, `credit.otherIncome.${n}.party`) === (p === "buyer" ? "a" : "b"),
    );
    if (!text(deal, `${p}.employer`) && !otherIncome)
      missing.push(`${who}: employer or other income`);
    if (text(deal, `${p}.employer`)) need("yearsAtJob", "time at employer");
  }
  if (wisconsinApplies(deal) && !text(deal, "credit.wi.maritalStatus"))
    missing.push("Wisconsin: applicant's marital status");
  return missing;
}

// ------------------------------------------------------------
// Signatures and initials (from the reference layout)
// ------------------------------------------------------------

const initials = (page: number): SignatureRequirement[] => [
  {
    id: `ca-p${page}-inits-buyer`,
    role: "buyer",
    page,
    location: `Page ${page} footer — Applicant initials`,
    mark: "initials",
  },
  {
    id: `ca-p${page}-inits-cobuyer`,
    role: "co_buyer",
    page,
    location: `Page ${page} footer — Joint Applicant initials`,
    mark: "initials",
    conditional: "joint_credit",
  },
];

export const CREDIT_APPLICATION_SIGNATURES: readonly SignatureRequirement[] = [
  {
    id: "ca-p1-joint-buyer",
    role: "buyer",
    page: 1,
    location: "Type of credit requested — Joint: Applicant initials",
    mark: "initials",
    conditional: "joint_credit",
  },
  {
    id: "ca-p1-joint-cobuyer",
    role: "co_buyer",
    page: 1,
    location: "Type of credit requested — Joint: Joint Applicant initials",
    mark: "initials",
    conditional: "joint_credit",
  },
  ...initials(1),
  {
    id: "ca-p2-buyer",
    role: "buyer",
    page: 2,
    location: "Signatures — Applicant's Signature / Date / DL #",
  },
  {
    id: "ca-p2-cobuyer",
    role: "co_buyer",
    page: 2,
    location: "Signatures — Jt. Applicant's or Other Party's Signature / Date / DL #",
    conditional: "joint_credit",
  },
  {
    id: "ca-p2-wi-spouse",
    role: "non_joint_spouse",
    page: 2,
    location: "Wisconsin — Signature of Non-Joint Applicant Spouse / Date",
    conditional: "wisconsin_spouse",
  },
  ...initials(2),
  {
    id: "ca-p3-buyer",
    role: "buyer",
    page: 3,
    location: "All Applicants — Applicant's Signature / Date",
  },
  {
    id: "ca-p3-cobuyer",
    role: "co_buyer",
    page: 3,
    location: "All Applicants — Jt. Applicant's Signature / Date",
    conditional: "joint_credit",
  },
  ...initials(3),
];

/** "Demo Co-Buyer" → "DC". */
export function initialsOf(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join("")
    .slice(0, 4);
}
