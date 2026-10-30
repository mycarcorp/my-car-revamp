/**
 * Form 3 — Retail Motor Vehicle Credit Application: deal fields used by this
 * form beyond the shared parties, dealer and vehicle.
 *
 * Applicant-level fields extend the existing Buyer ("buyer.*") and Co-Buyer
 * ("coBuyer.*") records — the same people the pre-qualification collected —
 * so the credit application is a structured view of that application, not a
 * second record. Application-level choices live under "credit.*".
 *
 * Sensitive identifiers: no raw SSN/ITIN or full ID number exists here. Only
 * the secure provider's collection status and masked last 4 digits, which no
 * one can edit from the browser ("editable: none").
 *
 * Kept free of runtime imports so deal-model.ts can include these definitions.
 */
import type { FieldDef } from "./deal-model";

export type CreditParty = "buyer" | "coBuyer";

const years = { min: 0, max: 99 };
const months = { min: 0, max: 11 };

/** [suffix, label, kind, extra] for each applicant, in reference order. */
const PARTY_FIELDS: ReadonlyArray<[string, string, FieldDef["kind"], Partial<FieldDef>?]> = [
  ["middleName", "Middle name", "text"],
  ["dob", "Date of birth", "date"],
  [
    "idType",
    "Gov't ID type",
    "choice",
    {
      options: [
        { value: "drivers_license", label: "Driver's license" },
        { value: "state_id", label: "State ID" },
        { value: "passport", label: "Passport" },
        { value: "other", label: "Other" },
      ],
    },
  ],
  ["idLast4", "Gov't ID no. (last 4, secure storage)", "text", { editable: "none" }],
  ["idIssuedBy", "Gov't ID issued by", "text"],
  ["idIssueDate", "Gov't ID issue date", "date"],
  ["idExpiryDate", "Gov't ID exp. date", "date"],
  [
    "ssnStatus",
    "SSN/ITIN collection status",
    "choice",
    {
      editable: "none",
      options: [
        { value: "not_collected", label: "Not collected" },
        { value: "pending", label: "Pending" },
        { value: "collected", label: "Collected" },
        { value: "verified", label: "Verified" },
        { value: "failed", label: "Failed" },
      ],
    },
  ],
  ["ssnLast4", "SSN/ITIN (last 4, secure provider)", "text", { editable: "none" }],
  ["phoneCell", "Primary phone is a cell", "boolean"],
  ["secondPhone", "Second phone", "text"],
  ["secondPhoneCell", "Second phone is a cell", "boolean"],
  ["unit", "Apt #", "text"],
  ["yearsAtAddress", "How long? (years)", "integer", years],
  ["monthsAtAddress", "How long? (months)", "integer", months],
  ["mailingStreet", "Mailing address (if different)", "text"],
  ["mailingUnit", "Apt #", "text"],
  ["mailingCity", "City", "text"],
  ["mailingState", "State", "text"],
  ["mailingZip", "ZIP", "text"],
  ["monthlyHousing", "Monthly rent or mortgage payment", "money"],
  [
    "residentialStatus",
    "Residential status",
    "choice",
    {
      options: [
        { value: "own", label: "Own" },
        { value: "rent", label: "Rent" },
        { value: "relatives", label: "With relatives" },
        { value: "friends", label: "With friends" },
        { value: "other", label: "Other" },
      ],
    },
  ],
  ["landlord", "Landlord/Mortgage", "text"],
  ["landlordPhone", "Landlord phone", "text"],
  ["prevStreet", "Previous address", "text"],
  ["prevUnit", "Apt #", "text"],
  ["prevCity", "City", "text"],
  ["prevState", "State", "text"],
  ["prevZip", "ZIP", "text"],
  ["prevYears", "How long? (years)", "integer", years],
  ["prevMonths", "How long? (months)", "integer", months],
  ["employmentStatus", "Employment status (from application)", "text"],
  ["employer", "Current employer", "text"],
  ["income", "Gross monthly salary", "money"],
  ["employerStreet", "Current employer's address", "text"],
  ["employerCity", "City", "text"],
  ["employerState", "State", "text"],
  ["employerZip", "ZIP", "text"],
  ["workPhone", "Work phone", "text"],
  ["yearsAtJob", "How long? (years)", "integer", years],
  ["monthsAtJob", "How long? (months)", "integer", months],
  ["jobTitle", "Occupation/Job title", "text"],
  ["prevEmployer", "Previous employer", "text"],
  ["prevEmployerIncome", "Gross monthly salary", "money"],
  ["prevEmployerAddress", "Previous employer's full address", "text"],
  ["prevEmployerPhone", "Phone", "text"],
  ["secEmployer", "Secondary employer name", "text"],
  ["secEmployerAddress", "Secondary employer address", "text"],
  ["secEmployerCity", "City", "text"],
  ["secEmployerState", "State", "text"],
  ["secEmployerZip", "ZIP", "text"],
  ["secEmployerIncome", "Gross monthly salary", "money"],
  ["secEmployerPhone", "Secondary employer phone", "text"],
  ["secYears", "How long? (years)", "integer", years],
  ["secMonths", "How long? (months)", "integer", months],
  ["secJobTitle", "Occupation/Job title", "text"],
  ["refName", "Reference", "text"],
  ["refPhone", "Phone", "text"],
  ["refAddress", "Address", "text"],
  ["refRelationship", "Relationship", "text"],
  ["bankName", "Bank reference", "text"],
  ["bankChecking", "Checking", "boolean"],
  ["bankSavings", "Savings", "boolean"],
  // Evidence from the pre-qualification consent records (read-only, never a signature here).
  [
    "consentCreditAuthorization",
    "Credit authorization recorded at pre-qualification",
    "boolean",
    { editable: "none" },
  ],
  [
    "consentCertification",
    "Application certification recorded at pre-qualification",
    "boolean",
    { editable: "none" },
  ],
];

export const creditPartyKey = (party: CreditParty, suffix: string) => `${party}.${suffix}`;

const partyDefs = (party: CreditParty): FieldDef[] =>
  PARTY_FIELDS.map(([suffix, label, kind, extra]) => ({
    key: creditPartyKey(party, suffix),
    label,
    kind,
    ...extra,
  }));

export const CREDIT_APPLICATION_FIELD_DEFS: readonly FieldDef[] = [
  ...partyDefs("buyer"),
  ...partyDefs("coBuyer"),
  {
    key: "credit.saleOrLease",
    label: "Credit Sale / Lease",
    kind: "choice",
    options: [
      { value: "credit_sale", label: "Credit Sale" },
      { value: "lease", label: "Lease" },
    ],
  },
  {
    key: "credit.creditType",
    label: "Type of credit requested",
    kind: "choice",
    options: [
      { value: "business", label: "Business" },
      { value: "individual", label: "Individual" },
      { value: "joint", label: "Joint" },
    ],
  },
  {
    key: "credit.submitTo",
    label: "Financial company(ies) this application may be submitted to",
    kind: "text",
  },
  ...[1, 2].flatMap((n): FieldDef[] => [
    {
      key: `credit.otherIncome.${n}.party`,
      label: "(A) or (B)",
      kind: "choice",
      options: [
        { value: "a", label: "(A)" },
        { value: "b", label: "(B)" },
      ],
    },
    { key: `credit.otherIncome.${n}.amount`, label: "Gross monthly other income", kind: "money" },
    { key: `credit.otherIncome.${n}.source`, label: "Other income source", kind: "text" },
  ]),
  // Wisconsin residents only
  {
    key: "credit.wi.maritalStatus",
    label: "Applicant is",
    kind: "choice",
    options: [
      { value: "married", label: "Married" },
      { value: "unmarried", label: "Unmarried (includes single, divorced or widowed)" },
      { value: "separated", label: "Separated" },
    ],
  },
  { key: "credit.wi.spouseName", label: "Non-joint applicant spouse's name", kind: "text" },
  { key: "credit.wi.spouseAddress", label: "Spouse's address", kind: "text" },
  // For Dealer Use Only (staff-entered where no other form has the same value)
  { key: "credit.dealer.bookValue", label: "Book value", kind: "money" },
  { key: "credit.dealer.cashSellingPrice", label: "Cash selling price", kind: "money" },
  { key: "credit.dealer.productsAndFees", label: "Products & fees", kind: "money" },
];
