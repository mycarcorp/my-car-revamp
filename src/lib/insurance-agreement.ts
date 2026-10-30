/**
 * Form 6 — Agreement to Provide Insurance: creditor/loss payee, coverage and
 * date checks, verification status, completion summary and signatures.
 *
 * Structure follows the one-page reference (fields and placement only). Its
 * two disclosure paragraphs and the customer notice are NOT reproduced: they
 * stay "approved template required". Filling fields never proves coverage:
 * only staff (or a verified insurance integration) can mark it verified.
 */
import type { SignatureRequirement } from "./bill-of-sale";
import { cents, fullName, text, type Deal } from "./deal-model";
import { INSURANCE_COVERAGES } from "./insurance-agreement-fields";
import { isValidUsPhone } from "./lease-to-own";

export type Creditor = {
  status: "confirmed" | "pending";
  name: string;
  street: string;
  cityStateZip: string;
};

/** The "To:" lender/creditor. Never assumed to be the dealer unless staff confirm it. */
export function insuranceCreditor(deal: Deal): Creditor {
  const keys =
    deal.fields["ins.lenderIsDealer"]?.value === true
      ? ["dealer.legalName", "dealer.street", "dealer.city", "dealer.state", "dealer.zip"]
      : [
          "ins.lenderName",
          "ins.lenderStreet",
          "ins.lenderCity",
          "ins.lenderState",
          "ins.lenderZip",
        ];
  const [name, street, city, state, zip] = keys.map((k) => text(deal, k)) as [
    string,
    string,
    string,
    string,
    string,
  ];
  return {
    status: name && street && city ? "confirmed" : "pending",
    name,
    street,
    cityStateZip: [city, state].filter(Boolean).join(", ") + (zip ? ` ${zip}` : ""),
  };
}

export type PolicyPeriod =
  | { state: "unknown" }
  | { state: "invalid"; message: string }
  | { state: "not_started" | "active" | "expired" };

/** Coverage period from the actual policy dates; no fixed term is assumed. */
export function policyPeriod(deal: Deal, today = new Date()): PolicyPeriod {
  const from = text(deal, "ins.effectiveFrom");
  const to = text(deal, "ins.effectiveTo");
  if (!from || !to) return { state: "unknown" };
  if (to <= from)
    return { state: "invalid", message: "The end date must be after the start date." };
  const now = today.toISOString().slice(0, 10);
  if (now < from) return { state: "not_started" };
  if (now > to) return { state: "expired" };
  return { state: "active" };
}

export const VERIFICATION_LABELS: Record<string, string> = {
  not_provided: "Not provided",
  information_entered: "Information entered",
  provided_unverified: "Document uploaded — not verified",
  pending_verification: "Pending verification",
  verified: "Verified (staff)",
  expired: "Expired",
  rejected: "Verification rejected",
};

/** Shared verification status; shown as Expired when the policy period has ended. */
export function verificationStatus(deal: Deal, today = new Date()): string {
  const s = text(deal, "insurance.status") || "not_provided";
  return policyPeriod(deal, today).state === "expired" && s !== "rejected" ? "expired" : s;
}

export type InsuranceIssue = { id: string; message: string };

export function insuranceIssues(deal: Deal, today = new Date()): InsuranceIssue[] {
  const issues: InsuranceIssue[] = [];
  const period = policyPeriod(deal, today);
  if (period.state === "invalid") issues.push({ id: "dates", message: period.message });
  if (period.state === "expired")
    issues.push({ id: "expired", message: "The policy period has ended — coverage is expired." });
  if (period.state === "not_started")
    issues.push({ id: "not-started", message: "The policy period has not started yet." });
  const phone = text(deal, "ins.agentPhone");
  if (phone && !isValidUsPhone(phone))
    issues.push({ id: "agent-phone", message: "The agent phone isn't a valid US phone number." });
  for (const c of INSURANCE_COVERAGES) {
    const state = text(deal, `ins.cov.${c.key}`);
    if (c.deductible && ["confirmed", "reported"].includes(state)) {
      const key = c.key === "collision" ? "ins.collisionDeductible" : "ins.compDeductible";
      if (cents(deal, key) === null)
        issues.push({
          id: `${c.key}-deductible`,
          message: `${c.label} coverage has no deductible.`,
        });
    }
  }
  if (!text(deal, "ins.cov.collision") || !text(deal, "ins.cov.comprehensive"))
    issues.push({
      id: "coverage-unknown",
      message: "Comprehensive and collision coverage are still unknown — information required.",
    });
  if (text(deal, "insurance.status") === "verified" && !text(deal, "insurance.policyNumber"))
    issues.push({
      id: "verified-no-policy",
      message: "Marked verified, but no policy number is entered.",
    });
  return issues;
}

export type InsuranceSummaryItem = { label: string; ok: boolean; detail: string };

/** Form completion — never proof of coverage or of a legally executed agreement. */
export function insuranceSummary(
  deal: Deal,
  signed: { buyer: boolean; co_buyer: boolean; dealer: boolean },
  today = new Date(),
): { items: InsuranceSummaryItem[]; complete: boolean } {
  const period = policyPeriod(deal, today);
  const coverageKnown = INSURANCE_COVERAGES.every((c) => text(deal, `ins.cov.${c.key}`));
  const deductiblesOk = INSURANCE_COVERAGES.every((c) => {
    if (!c.deductible || !["confirmed", "reported"].includes(text(deal, `ins.cov.${c.key}`)))
      return true;
    return (
      cents(deal, c.key === "collision" ? "ins.collisionDeductible" : "ins.compDeductible") !== null
    );
  });
  const verification = verificationStatus(deal, today);
  const purchasers =
    Boolean(fullName(deal, "buyer") && text(deal, "buyer.street")) &&
    (!deal.coBuyerIncluded || Boolean(fullName(deal, "coBuyer")));
  const items: InsuranceSummaryItem[] = [
    { label: "Purchaser details", ok: purchasers, detail: purchasers ? "complete" : "incomplete" },
    {
      label: "Vehicle details",
      ok: Boolean(text(deal, "vehicle.vin")),
      detail: text(deal, "vehicle.vin") ? "complete" : "vehicle not assigned",
    },
    {
      label: "Creditor / loss payee",
      ok: insuranceCreditor(deal).status === "confirmed",
      detail: insuranceCreditor(deal).status === "confirmed" ? "confirmed" : "pending",
    },
    {
      label: "Insurance company",
      ok: Boolean(text(deal, "insurance.company")),
      detail: text(deal, "insurance.company") ? "supplied" : "missing",
    },
    {
      label: "Agent contact",
      ok: Boolean(text(deal, "ins.agentName") && text(deal, "ins.agentPhone")),
      detail: text(deal, "ins.agentName") && text(deal, "ins.agentPhone") ? "supplied" : "missing",
    },
    {
      label: "Policy number",
      ok: Boolean(text(deal, "insurance.policyNumber")),
      detail: text(deal, "insurance.policyNumber") ? "supplied" : "missing",
    },
    {
      label: "Coverage dates",
      ok: period.state === "active",
      detail:
        period.state === "unknown"
          ? "missing"
          : period.state === "invalid"
            ? "invalid"
            : period.state.replace("_", " "),
    },
    {
      label: "Coverage",
      ok: coverageKnown,
      detail: coverageKnown ? "complete" : "information required",
    },
    { label: "Deductibles", ok: deductiblesOk, detail: deductiblesOk ? "complete" : "missing" },
    {
      label: "Verification",
      ok: verification === "verified",
      detail: VERIFICATION_LABELS[verification] ?? verification,
    },
    {
      label: "Purchaser signature",
      ok: signed.buyer,
      detail: signed.buyer ? "shown (demo)" : "pending",
    },
    ...(deal.coBuyerIncluded
      ? [
          {
            label: "Co-Purchaser signature",
            ok: signed.co_buyer,
            detail: signed.co_buyer ? "shown (demo)" : "pending",
          },
        ]
      : []),
    {
      label: "Dealer signature",
      ok: signed.dealer,
      detail: signed.dealer ? "shown (demo)" : "pending",
    },
  ];
  return { items, complete: items.every((i) => i.ok) };
}

export const INSURANCE_AGREEMENT_SIGNATURES: readonly SignatureRequirement[] = [
  { id: "ins-purchaser", role: "buyer", page: 1, location: "Signed — Purchaser(s) / Date" },
  {
    id: "ins-copurchaser",
    role: "co_buyer",
    page: 1,
    location: "Signed — Purchaser(s), second signature / Date",
    conditional: "co_buyer_included",
  },
  { id: "ins-dealer", role: "dealer", page: 1, location: "Signed — Dealer / Date" },
];
