/**
 * Numbered acknowledgments initialled one by one (Form 4 provisions, Form 5
 * delivery statements). One registry so both forms share the same initials
 * rules: each item is initialled separately by its own signer, never by
 * adopting a signature, and items that don't apply are Not Applicable.
 */
import type { SignerRole } from "./bill-of-sale";
import type { Deal } from "./deal-model";
import { DELIVERY_INITIAL_ROLES, DELIVERY_STATEMENTS } from "./delivery-checklist";
import { GPS_PROVISION_INITIAL_ROLES, GPS_PROVISIONS } from "./gps-disclosure";
import type { ContractId } from "./lease-contracts";

export type AckItem = {
  number: number;
  title: string;
  applies?: (deal: Deal) => { applies: boolean; reason?: string };
};

export type AckSet = { items: readonly AckItem[]; roles: readonly SignerRole[] };

export const ACKNOWLEDGMENT_SETS: Partial<Record<ContractId, AckSet>> = {
  gps_disclosure: { items: GPS_PROVISIONS, roles: GPS_PROVISION_INITIAL_ROLES },
  delivery_checklist: { items: DELIVERY_STATEMENTS, roles: DELIVERY_INITIAL_ROLES },
};

export function itemApplies(item: AckItem, deal: Deal): { applies: boolean; reason?: string } {
  return item.applies ? item.applies(deal) : { applies: true };
}

/** Items of a contract that apply to this deal. */
export function applicableItems(contractId: ContractId, deal: Deal): AckItem[] {
  return (ACKNOWLEDGMENT_SETS[contractId]?.items ?? []).filter((i) => itemApplies(i, deal).applies);
}
