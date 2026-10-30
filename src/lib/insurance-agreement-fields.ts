/**
 * Form 6 — Agreement to Provide Insurance: deal fields only this form uses
 * ("ins.*"). Insurance company, policy number and verification status are the
 * shared "insurance.*" fields (also on Form 1); purchasers, address, vehicle
 * and dealer are the shared deal fields.
 *
 * Nothing defaults to "covered": coverages start unknown, and the creditor /
 * loss payee stays pending until staff confirm who it is (it is not assumed to
 * be the dealer).
 *
 * Kept free of runtime imports so deal-model.ts can include these definitions.
 */
import type { FieldDef } from "./deal-model";

export const COVERAGE_STATES = [
  { value: "confirmed", label: "Coverage confirmed (staff/provider)" },
  { value: "reported", label: "Reported — not verified" },
  { value: "not_selected", label: "Not selected" },
  { value: "not_applicable", label: "Not applicable" },
] as const;

export const INSURANCE_COVERAGES = [
  { key: "fireTheft", label: "Fire, Theft", deductible: false },
  { key: "comprehensive", label: "Comprehensive", deductible: true },
  { key: "collision", label: "Collision", deductible: true },
] as const;

export const INSURANCE_AGREEMENT_FIELD_DEFS: readonly FieldDef[] = [
  {
    key: "ins.lenderIsDealer",
    label: "Creditor / loss payee is the dealership (confirmed by staff)",
    kind: "boolean",
  },
  { key: "ins.lenderName", label: "Lender/Creditor legal name", kind: "text" },
  { key: "ins.lenderStreet", label: "Street address", kind: "text" },
  { key: "ins.lenderCity", label: "City", kind: "text" },
  { key: "ins.lenderState", label: "State", kind: "text" },
  { key: "ins.lenderZip", label: "ZIP", kind: "text" },
  { key: "ins.agentName", label: "Insurance Agent", kind: "text" },
  { key: "ins.agentPhone", label: "Phone", kind: "text" },
  { key: "ins.effectiveFrom", label: "Effective Date From", kind: "date" },
  { key: "ins.effectiveTo", label: "To", kind: "date" },
  ...INSURANCE_COVERAGES.map((c): FieldDef => ({
    key: `ins.cov.${c.key}`,
    label: c.label,
    kind: "choice",
    options: COVERAGE_STATES,
  })),
  { key: "ins.compDeductible", label: "Comprehensive deductible", kind: "money" },
  { key: "ins.collisionDeductible", label: "Collision deductible", kind: "money" },
  {
    key: "insurance.documentId",
    label: "Insurance document reference (secure storage)",
    kind: "text",
    editable: "none",
  },
];
