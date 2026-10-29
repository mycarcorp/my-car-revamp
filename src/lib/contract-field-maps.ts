/**
 * Explicit field mappings from the shared deal model to each contract form.
 *
 * Forms read the same deal fields instead of asking again. Only fields with
 * the SAME meaning are mapped: e.g. the Bill of Sale "Cash Down Payment" is not
 * mapped to a Retail Installment field until that form's approved PDF and
 * calculation rules are supplied. Forms without a confirmed map stay empty.
 */
import type { ContractId } from "./lease-contracts";
import { fullName, text, type Deal, type DealField } from "./deal-model";

/** A form field is either a deal field or a derived value (e.g. full name). */
export type FieldMapping = { dealKey: string } | { derived: "buyer.fullName" | "coBuyer.fullName" };

const party = (prefix: "buyer" | "coBuyer", form: "buyer" | "co_buyer") => ({
  [`${form}_name`]: { derived: `${prefix}.fullName` } as FieldMapping,
  [`${form}_street`]: { dealKey: `${prefix}.street` },
  [`${form}_city`]: { dealKey: `${prefix}.city` },
  [`${form}_state`]: { dealKey: `${prefix}.state` },
  [`${form}_zip`]: { dealKey: `${prefix}.zip` },
  [`${form}_phone`]: { dealKey: `${prefix}.phone` },
});

const vehicle = {
  vehicle_year: { dealKey: "vehicle.year" },
  vehicle_make: { dealKey: "vehicle.make" },
  vehicle_model: { dealKey: "vehicle.model" },
  vehicle_vin: { dealKey: "vehicle.vin" },
} satisfies Record<string, FieldMapping>;

export const CONTRACT_FIELD_MAPS: Partial<Record<ContractId, Record<string, FieldMapping>>> = {
  // Form 1: every field on page 1 of the reference.
  bill_of_sale: {
    dealer_name: { dealKey: "dealer.legalName" },
    dealer_street: { dealKey: "dealer.street" },
    dealer_phone: { dealKey: "dealer.phone" },
    date: { dealKey: "deal.date" },
    stock_no: { dealKey: "deal.stockNumber" },
    salesperson: { dealKey: "dealer.salesperson" },
    app_no: { dealKey: "deal.appNumber" },
    contract_no: { dealKey: "deal.contractNumber" },
    ...party("buyer", "buyer"),
    ...party("coBuyer", "co_buyer"),
    ...vehicle,
    vehicle_body_style: { dealKey: "vehicle.bodyStyle" },
    vehicle_lic_no: { dealKey: "vehicle.licenseNumber" },
    vehicle_odometer: { dealKey: "vehicle.odometer" },
    vehicle_color: { dealKey: "vehicle.color" },
    insurance_company: { dealKey: "insurance.company" },
    insurance_policy_no: { dealKey: "insurance.policyNumber" },
  },
  // Proposed shared fields for later forms (same meaning only). Confirm against each approved PDF.
  retail_installment: { ...party("buyer", "buyer"), ...party("coBuyer", "co_buyer"), ...vehicle },
  credit_application: { ...party("buyer", "buyer"), ...party("coBuyer", "co_buyer") },
  delivery_checklist: {
    ...party("buyer", "buyer"),
    ...vehicle,
    stock_no: { dealKey: "deal.stockNumber" },
    vehicle_odometer: { dealKey: "vehicle.odometer" },
  },
  insurance_agreement: {
    ...party("buyer", "buyer"),
    ...vehicle,
    insurance_company: { dealKey: "insurance.company" },
    insurance_policy_no: { dealKey: "insurance.policyNumber" },
  },
};

export type PrefilledField = { value: string; source: DealField["source"]; verified: boolean };

/** Values for one form from the shared deal. Co-Buyer fields are omitted when there is no Co-Buyer. */
export function prefillForContract(
  contractId: ContractId,
  deal: Deal,
): Record<string, PrefilledField> {
  const map = CONTRACT_FIELD_MAPS[contractId] ?? {};
  const out: Record<string, PrefilledField> = {};
  for (const [formField, mapping] of Object.entries(map)) {
    if (formField.startsWith("co_buyer_") && !deal.coBuyerIncluded) continue;
    if ("derived" in mapping) {
      const prefix = mapping.derived.startsWith("coBuyer") ? "coBuyer" : "buyer";
      const first = deal.fields[`${prefix}.firstName`];
      out[formField] = {
        value: fullName(deal, prefix),
        source: first?.source ?? "none",
        verified: Boolean(first?.verified && deal.fields[`${prefix}.lastName`]?.verified),
      };
    } else {
      const field = deal.fields[mapping.dealKey];
      out[formField] = {
        value: text(deal, mapping.dealKey),
        source: field?.source ?? "none",
        verified: Boolean(field?.verified),
      };
    }
  }
  return out;
}
