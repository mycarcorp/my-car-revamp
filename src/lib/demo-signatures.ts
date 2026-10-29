// DEVELOPMENT DEMO ONLY. Imported only by the local demo workflow, so production
// builds never include it. Demo signatures live in page memory: they are never
// uploaded, stored, sent to a provider or treated as a real signature.
import {
  allSignatureSlots,
  requiredSignerRoles,
  sameLegalName,
  signatureSlotsFor,
  signerIdentity,
  SIGNER_ROLE_LABELS,
  type ContractSignatureSlot,
  type SignatureCapture,
  type SignerRole,
} from "./contract-signatures";
import type { Deal } from "./deal-model";
import type { ContractId } from "./lease-contracts";

export type { SignatureCapture };

export type DemoSignature = {
  role: SignerRole;
  /** The fictional signer's printed name from the deal, never typed in. */
  signerName: string;
  capture: SignatureCapture;
  adoptedAt: string;
};

export type DemoSignatures = Partial<Record<SignerRole, DemoSignature>>;

/** Shortest drawn mark accepted as a signature (total points across strokes). */
const MIN_DRAWN_POINTS = 4;

export function captureIsEmpty(capture: SignatureCapture | null): boolean {
  if (!capture) return true;
  if (capture.kind === "script") return !capture.name.trim();
  return capture.strokes.reduce((n, s) => n + s.length, 0) < MIN_DRAWN_POINTS;
}

export type AdoptResult =
  | { ok: true; signatures: DemoSignatures; appliedTo: ContractSignatureSlot[] }
  | { ok: false; error: string };

/**
 * Adopt a demo signature for ONE signer and place it only on that signer's own
 * locations across the suite. Other signers' entries are left untouched.
 */
export function adoptDemoSignature(
  current: DemoSignatures,
  deal: Deal,
  input: { role: SignerRole; capture: SignatureCapture | null; certified: boolean; now?: Date },
): AdoptResult {
  const label = SIGNER_ROLE_LABELS[input.role];
  if (!requiredSignerRoles(deal).includes(input.role))
    return { ok: false, error: `There is no ${label} on this deal.` };
  const identity = signerIdentity(deal, input.role);
  if (!identity.printedName)
    return {
      ok: false,
      error: `The ${label} name is missing from the deal. Add it before signing.`,
    };
  if (captureIsEmpty(input.capture))
    return { ok: false, error: "Draw a signature or adopt the script signature first." };
  if (input.capture!.kind === "script" && !sameLegalName(input.capture!.name, identity.printedName))
    return {
      ok: false,
      error: `Type the ${label}'s full legal name exactly as it appears on the ${label === "Dealer/Seller" ? "dealer record" : "application"}.`,
    };
  if (!input.certified) return { ok: false, error: "Check the demo certification box first." };
  const signature: DemoSignature = {
    role: input.role,
    signerName: identity.printedName,
    capture: input.capture!,
    adoptedAt: (input.now ?? new Date()).toISOString(),
  };
  return {
    ok: true,
    signatures: { ...current, [input.role]: signature },
    appliedTo: allSignatureSlots(deal).filter((s) => s.role === input.role),
  };
}

export function removeDemoSignature(current: DemoSignatures, role: SignerRole): DemoSignatures {
  const { [role]: _removed, ...rest } = current;
  return rest;
}

/** The demo signature shown in a location: only the matching signer's own. */
export function demoSignatureFor(
  slot: ContractSignatureSlot,
  signatures: DemoSignatures,
): DemoSignature | null {
  const sig = signatures[slot.role];
  return sig && sig.role === slot.role ? sig : null;
}

/** True when every location on this contract shows its own signer's demo signature. */
export function contractDemoSigned(
  contractId: ContractId,
  deal: Deal,
  signatures: DemoSignatures,
): boolean {
  const slots = signatureSlotsFor(contractId, deal);
  return slots.length > 0 && slots.every((s) => demoSignatureFor(s, signatures));
}

/** The demo deal can be "completed" only after every required signer adopted a demo signature. */
export function demoCompletionMissing(deal: Deal, signatures: DemoSignatures): SignerRole[] {
  return requiredSignerRoles(deal).filter((r) => !signatures[r]);
}
