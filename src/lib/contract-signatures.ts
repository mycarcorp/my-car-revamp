/**
 * Where each contract in the suite is signed, and by whom.
 *
 * Every signature location belongs to exactly one signer role. A signature is
 * only ever applied to its own role's locations: a Buyer never fills a
 * Co-Buyer or Dealer/Seller line, and the dealer is never signed from a
 * customer session. Form 1 locations come from the reference layout; Forms 2–10
 * use placeholder locations until their approved templates are supplied.
 *
 * Real signing is done by the approved e-signature provider, which decides the
 * final signatures, initials and consents. Nothing here marks anything signed.
 */
import {
  BILL_OF_SALE_SIGNATURES,
  type SignatureRequirement,
  type SignerRole,
} from "./bill-of-sale";
import { fullName, text, type Deal } from "./deal-model";
import { CONTRACT_TEMPLATES, type ContractId, type DealContract } from "./lease-contracts";

export type { SignerRole };

export const SIGNER_ROLE_LABELS: Record<SignerRole, string> = {
  buyer: "Buyer",
  co_buyer: "Co-Buyer",
  dealer: "Dealer/Seller",
};

/** What a signature pad captured: drawn strokes (canvas pixels) or a script rendering of a name. */
export type SignatureCapture =
  | { kind: "drawn"; width: number; height: number; strokes: Array<Array<[number, number]>> }
  | { kind: "script"; name: string };

export type ContractSignatureSlot = SignatureRequirement & {
  contractId: ContractId;
  /** True when the location is taken from the reference layout, false for a placeholder. */
  locationConfirmed: boolean;
};

/** Signature locations for one contract. Co-Buyer lines exist only when a Co-Buyer is on the deal. */
export function signatureSlotsFor(contractId: ContractId, deal: Deal): ContractSignatureSlot[] {
  const applies = (s: SignatureRequirement) =>
    s.conditional !== "co_buyer_included" || deal.coBuyerIncluded;
  if (contractId === "bill_of_sale")
    return BILL_OF_SALE_SIGNATURES.filter(applies).map((s) => ({
      ...s,
      contractId,
      locationConfirmed: true,
    }));
  const template = CONTRACT_TEMPLATES.find((t) => t.id === contractId);
  if (!template?.requiresSignature) return [];
  return template.signerRoles
    .map((role): SignatureRequirement => ({
      id: `${contractId}-${role}`,
      role,
      page: 1,
      location: "Signature line (placeholder until the approved template is supplied)",
      ...(role === "co_buyer" ? { conditional: "co_buyer_included" as const } : {}),
    }))
    .filter(applies)
    .map((s) => ({ ...s, contractId, locationConfirmed: false }));
}

/** Every signature location across the suite, in tab order. */
export function allSignatureSlots(deal: Deal): ContractSignatureSlot[] {
  return CONTRACT_TEMPLATES.flatMap((t) => signatureSlotsFor(t.id, deal));
}

/** Roles that must sign at least one document on this deal. */
export function requiredSignerRoles(deal: Deal): SignerRole[] {
  const roles = new Set(allSignatureSlots(deal).map((s) => s.role));
  return (["buyer", "co_buyer", "dealer"] as const).filter((r) => roles.has(r));
}

export type SignerIdentity = {
  role: SignerRole;
  /** Printed name from the application (Buyer/Co-Buyer) or dealer record. Null when missing. */
  printedName: string | null;
  /** Dealer/Seller legal business name. */
  organization: string | null;
};

/** Printed names come only from the deal; nothing is invented when a value is missing. */
export function signerIdentity(deal: Deal, role: SignerRole): SignerIdentity {
  if (role === "dealer")
    return {
      role,
      printedName: text(deal, "dealer.authorizedSigner") || null,
      organization: text(deal, "dealer.legalName") || null,
    };
  if (role === "co_buyer" && !deal.coBuyerIncluded)
    return { role, printedName: null, organization: null };
  return {
    role,
    printedName: fullName(deal, role === "buyer" ? "buyer" : "coBuyer") || null,
    organization: null,
  };
}

/** Signature date as printed on the forms: MM/DD/YYYY in local time. */
export function formatSignatureDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
}

/** Same person's name? Ignores case and extra spaces only. */
export function sameLegalName(a: string, b: string): boolean {
  const norm = (v: string) => v.trim().replace(/\s+/g, " ").toLowerCase();
  return norm(a) !== "" && norm(a) === norm(b);
}

/**
 * Why a REAL deal cannot be completed yet. Empty only when every agreement has
 * an approved template, is released and finished by the provider, every signer
 * has a verified provider signature, staff approved, and payment/activation
 * prerequisites are met. Demo state never feeds into this.
 */
export function realDealCompletionBlockers(input: {
  contracts: DealContract[];
  esignProviderConnected: boolean;
  staffApproved: boolean;
  paymentAndActivationReady: boolean;
}): string[] {
  const blockers: string[] = [];
  if (!input.esignProviderConnected)
    blockers.push("No approved e-signature provider is connected.");
  const missing = input.contracts.filter((c) => !c.source || !c.version);
  if (missing.length) blockers.push(`${missing.length} contract template(s) not approved.`);
  const unsigned = input.contracts.filter(
    (c) =>
      !c.released ||
      !c.completed ||
      !c.signedPdfRef ||
      (c.requiresSignature && c.signerRoles.some((r) => !c.signedBy[r])),
  );
  if (unsigned.length) blockers.push(`${unsigned.length} contract(s) not signed and completed.`);
  if (!input.staffApproved) blockers.push("Dealership staff have not approved the transaction.");
  if (!input.paymentAndActivationReady)
    blockers.push("Payment and activation prerequisites are not complete.");
  return blockers;
}
