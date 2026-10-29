/**
 * Lease to Own — Virginia Deal Contract Suite registry (10 forms).
 *
 * The single source for the contract list. Every template is MISSING until
 * management supplies the approved PDF: `source` is null, so no screen can show
 * an unapproved document as a real contract. When a PDF arrives, set its
 * `source` (a private storage path, never a public URL) and `version`.
 *
 * Per-deal state (released, signed, signed PDF) is not stored here. It belongs
 * in mycarco_db.mc_lease_agreements, keyed by `id` (= agreement_key), and is
 * written only by authorized staff actions and a verified e-signature provider.
 */
import type { ApplicantRole } from "./lease-to-own";

export type ContractId =
  | "bill_of_sale"
  | "retail_installment"
  | "credit_application"
  | "gps_disclosure"
  | "delivery_checklist"
  | "insurance_agreement"
  | "abuse_notice"
  | "recourse_agreement"
  | "repossession"
  | "ach_card_authorization";

/** Where an approved template PDF lives. Private storage only; null until supplied. */
export type ContractTemplateSource = { kind: "storage"; bucket: string; path: string };

export type ContractTemplate = {
  id: ContractId;
  /** Tab number, 1–10. */
  number: number;
  title: string;
  /** Short tab label. */
  tabLabel: string;
  templateId: string;
  source: ContractTemplateSource | null;
  /** Approved template version; null until an approved PDF is supplied. */
  version: string | null;
  /** Who must sign this form. Confirm with counsel when the PDFs arrive. */
  signerRoles: readonly ApplicantRole[];
  requiresSignature: boolean;
};

export type ContractStatus = "missing_template" | "locked" | "released" | "signed" | "voided";

/** One contract for one deal, combining the template with that deal's agreement record. */
export type DealContract = ContractTemplate & {
  status: ContractStatus;
  released: boolean;
  /** Per signer; true only after a verified e-signature provider confirmation. */
  signedBy: Partial<Record<ApplicantRole, boolean>>;
  completed: boolean;
  signedPdfRef: string | null;
};

const both = ["buyer", "co_buyer"] as const;

const CONTRACT_LIST: ReadonlyArray<[ContractId, string, string]> = [
  ["bill_of_sale", "Bill of Sale / Buyer's Order", "Bill of Sale"],
  ["retail_installment", "Retail Installment Contract", "Retail Installment"],
  ["credit_application", "Credit Application", "Credit Application"],
  ["gps_disclosure", "GPS Device Disclosure", "GPS Disclosure"],
  ["delivery_checklist", "Vehicle Delivery Checklist", "Delivery Checklist"],
  ["insurance_agreement", "Insurance Agreement", "Insurance Agreement"],
  ["abuse_notice", "Abuse Notice", "Abuse Notice"],
  ["recourse_agreement", "Recourse Agreement", "Recourse Agreement"],
  ["repossession", "Repossession Notice", "Repossession"],
  ["ach_card_authorization", "ACH & Card Authorization", "ACH & Card Authorization"],
];

export const CONTRACT_TEMPLATES: readonly ContractTemplate[] = CONTRACT_LIST.map(
  ([id, title, tabLabel], index) => ({
    id,
    number: index + 1,
    title,
    tabLabel,
    templateId: `va-${id}`,
    source: null,
    version: null,
    signerRoles: both,
    requiresSignature: true,
  }),
);

/** Before any staff release every contract is locked (or missing its template). */
export function initialDealContracts(): DealContract[] {
  return CONTRACT_TEMPLATES.map((t) => ({
    ...t,
    status: t.source ? "locked" : "missing_template",
    released: false,
    signedBy: {},
    completed: false,
    signedPdfRef: null,
  }));
}

// Form 1 (Bill of Sale) fields, lines and layout live in bill-of-sale.ts; shared
// field mappings for all forms live in contract-field-maps.ts.
