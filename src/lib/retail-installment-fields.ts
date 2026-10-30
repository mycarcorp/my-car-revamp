/**
 * Form 2 — Retail Installment Contract and Security Agreement: the deal fields
 * that only this form uses ("ric.*"). Parties, dealer, vehicle, trade-ins and
 * the contract number/date are shared with Form 1 and are NOT repeated here.
 *
 * Kept free of runtime imports so deal-model.ts can include these definitions
 * without an import cycle. Nothing here has a default value: optional products,
 * insurance and acknowledgments start unselected and unchecked.
 */
import type { FieldDef } from "./deal-model";

/** Itemization of Amount Financed rows entered by staff (the others are calculated). */
export const RIC_INPUT_ROWS = [
  "a",
  "b",
  "c",
  "e",
  "f",
  "g",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "z",
] as const;
export type RicInputRow = (typeof RIC_INPUT_ROWS)[number];

/** "To:" rows o–x name an approved product or payee. */
export const RIC_PAYEE_ROWS = ["o", "p", "q", "r", "s", "t", "u", "v", "w", "x"] as const;

/** Payment schedule rows, as on the reference (three lines). */
export const RIC_SCHEDULE_ROWS = [1, 2, 3] as const;

export const PAYMENT_FREQUENCIES = [
  { value: "once", label: "One payment" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "semimonthly", label: "Twice a month" },
  { value: "monthly", label: "Monthly" },
] as const;
export type PaymentFrequency = (typeof PAYMENT_FREQUENCIES)[number]["value"];

const coverage = [
  { value: "single", label: "Single" },
  { value: "joint", label: "Joint" },
  { value: "none", label: "None" },
];

const creditInsurance = (prefix: "creditLife" | "creditDisability", title: string): FieldDef[] => [
  { key: `ric.${prefix}.coverage`, label: `${title} coverage`, kind: "choice", options: coverage },
  { key: `ric.${prefix}.premium`, label: `${title} premium`, kind: "money" },
  { key: `ric.${prefix}.term`, label: `${title} term`, kind: "text" },
  { key: `ric.${prefix}.insured`, label: `${title} insured`, kind: "text" },
];

const protection = (prefix: "svc" | "gap" | "otherProtection", title: string): FieldDef[] => [
  { key: `ric.${prefix}.selected`, label: `${title} selected`, kind: "boolean" },
  { key: `ric.${prefix}.term`, label: "Term", kind: "text" },
  { key: `ric.${prefix}.price`, label: "Price", kind: "money" },
  { key: `ric.${prefix}.coverage`, label: "Coverage", kind: "text" },
];

const premiumLine = (key: string, title: string, deductible: boolean): FieldDef[] => [
  { key: `ric.propIns.${key}`, label: title, kind: "boolean" },
  ...(deductible
    ? [
        {
          key: `ric.propIns.${key}Deductible`,
          label: `${title} deductible`,
          kind: "money" as const,
        },
      ]
    : []),
  { key: `ric.propIns.${key}Premium`, label: `${title} premium`, kind: "amount" },
];

export const RETAIL_INSTALLMENT_FIELD_DEFS: readonly FieldDef[] = [
  // Page 1 — contract summary, payment schedule and disclosures
  {
    key: "ric.businessPurpose",
    label: "Business, commercial or agricultural purpose Contract",
    kind: "boolean",
  },
  ...RIC_SCHEDULE_ROWS.flatMap((n): FieldDef[] => [
    { key: `ric.schedule.${n}.count`, label: `Row ${n} number of payments`, kind: "integer" },
    { key: `ric.schedule.${n}.amount`, label: `Row ${n} amount of payments`, kind: "money" },
    {
      key: `ric.schedule.${n}.frequency`,
      label: `Row ${n} frequency`,
      kind: "choice",
      options: PAYMENT_FREQUENCIES,
    },
    { key: `ric.schedule.${n}.firstDue`, label: `Row ${n} first payment due`, kind: "date" },
    {
      key: `ric.schedule.${n}.kind`,
      label: `Row ${n} payment type`,
      kind: "choice",
      options: [
        { value: "installment", label: "Installment" },
        { value: "deferred_down", label: "Deferred down payment" },
      ],
    },
  ]),
  { key: "ric.lateCharge", label: "Late charge applies", kind: "boolean" },
  { key: "ric.lateChargeDays", label: "Days late before the charge", kind: "integer" },
  { key: "ric.lateChargeTerms", label: "Late charge (amount or percentage)", kind: "text" },
  { key: "ric.noLiabilityInsurance", label: "No Liability Insurance Included", kind: "boolean" },
  { key: "ric.conditionalDelivery", label: "Conditional Delivery", kind: "boolean" },
  {
    key: "ric.conditionalDeliveryAgreement",
    label: "Conditional delivery agreement reference",
    kind: "text",
  },
  { key: "ric.contractRate", label: "Finance charge rate (% per year)", kind: "percent" },
  { key: "ric.postMaturityRate", label: "Post-maturity rate (% per year)", kind: "percent" },
  {
    key: "ric.financingApproved",
    label: "Financing terms approved by authorized staff",
    kind: "boolean",
  },
  // Page 2 — additional charge, itemization, insurance
  { key: "ric.addlCharge", label: "Additional charge applies", kind: "boolean" },
  { key: "ric.addlChargeDescription", label: "Fee description", kind: "text" },
  { key: "ric.addlChargeAmount", label: "Fee amount", kind: "money" },
  {
    key: "ric.addlChargePayment",
    label: "Fee paid",
    kind: "choice",
    options: [
      { value: "cash", label: "Paid in cash" },
      { value: "financed", label: "Financed over the term of the Contract" },
    ],
  },
  ...RIC_INPUT_ROWS.map((row): FieldDef => ({
    key: `ric.item.${row}`,
    label: `Row ${row}`,
    kind: "amount",
  })),
  { key: "ric.item.aTax", label: "Sales tax included in row a", kind: "amount" },
  { key: "ric.item.cPayee", label: "Row c paid to", kind: "text" },
  { key: "ric.item.gDescription", label: "Row g description", kind: "text" },
  { key: "ric.item.mPayee", label: "Row m paid to", kind: "text" },
  ...RIC_PAYEE_ROWS.map((row): FieldDef => ({
    key: `ric.item.${row}Payee`,
    label: `Row ${row} to`,
    kind: "text",
  })),
  ...creditInsurance("creditLife", "Credit Life"),
  ...creditInsurance("creditDisability", "Credit Disability"),
  { key: "ric.creditIns.buyerDob", label: "Buyer date of birth", kind: "date" },
  { key: "ric.creditIns.coBuyerDob", label: "Co-Buyer date of birth", kind: "date" },
  { key: "ric.propIns.maxDeductible", label: "Maximum collision deductible", kind: "money" },
  { key: "ric.propIns.premium", label: "Premium if bought from or through us", kind: "amount" },
  { key: "ric.propIns.term", label: "Term of coverage", kind: "text" },
  ...premiumLine("collision", "Collision", true),
  ...premiumLine("comprehensive", "Comprehensive", true),
  ...premiumLine("fireTheft", "Fire-Theft and Combined Additional Coverage", false),
  ...premiumLine("other", "Other coverage", false),
  { key: "ric.propIns.otherDescription", label: "Other coverage description", kind: "text" },
  { key: "ric.singleInterest", label: "Single-Interest Insurance required", kind: "boolean" },
  { key: "ric.singleInterest.provider", label: "Insurance provider", kind: "text" },
  { key: "ric.singleInterest.premium", label: "Premium", kind: "amount" },
  { key: "ric.singleInterest.term", label: "Term of coverage", kind: "text" },
  // Page 3 — Additional Protections (voluntary)
  ...protection("svc", "Service Contract"),
  { key: "ric.svc.provider", label: "Provider", kind: "text" },
  ...protection("gap", "Gap"),
  {
    key: "ric.gap.type",
    label: "Gap type",
    kind: "choice",
    options: [
      { value: "waiver", label: "Gap Waiver" },
      { value: "insurance", label: "Gap Insurance" },
    ],
  },
  ...protection("otherProtection", "Other protection"),
  { key: "ric.otherProtection.description", label: "Product", kind: "text" },
  // Page 4 — Third Party Owner (not a Buyer)
  {
    key: "ric.thirdParty.included",
    label: "Verified Third Party Owner on this deal",
    kind: "boolean",
  },
  { key: "ric.thirdParty.name", label: "Third Party Owner legal name", kind: "text" },
  // Page 5 — acknowledgment and assignment
  {
    key: "ric.esignAck",
    label: "Electronic Signature Acknowledgment applies",
    kind: "boolean",
  },
  { key: "ric.assign.assigneeName", label: "Assignee legal name", kind: "text" },
  { key: "ric.assign.assigneeAddress", label: "Assignee address", kind: "text" },
  { key: "ric.assign.assigneePhone", label: "Assignee phone", kind: "text" },
  { key: "ric.assign.recourse", label: "Assignment made with recourse", kind: "boolean" },
  {
    key: "ric.assign.status",
    label: "Assignment status",
    kind: "choice",
    options: [
      { value: "not_assigned", label: "Not assigned" },
      { value: "pending", label: "Pending assignee acceptance" },
      { value: "assigned", label: "Assigned (accepted)" },
    ],
  },
];
