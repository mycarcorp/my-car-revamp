/**
 * Form 5 — Customer Delivery Checklist: the nine delivery statements, their
 * applicability, the staff delivery records each relies on, statuses and
 * signature locations.
 *
 * Structure follows the one-page reference (order, initials per statement,
 * three signature lines). Its wording is NOT reproduced: each statement shows
 * an organizing title and "approved wording required". Completing this
 * checklist never marks a vehicle delivered or a lease active.
 */
import type { SignatureRequirement, SignerRole } from "./bill-of-sale";
import { cents, fullName, text, type Deal } from "./deal-model";

export const DELIVERY_TEMPLATE_REVIEW =
  "The reference is a purchase-delivery checklist. Whether it fits a Lease to Own delivery, and its final wording, need management/legal approval.";

export type DeliveryStatement = {
  number: number;
  /** Organizing title only — not replacement legal text. */
  title: string;
  /** Staff delivery records shown with this statement. */
  records?: readonly string[];
  legalReview?: string;
  /** When the statement applies to this deal; otherwise it shows Not Applicable. */
  applies?: (deal: Deal) => { applies: boolean; reason?: string };
};

/** A trade-in is part of this deal (details or amounts recorded on Form 1). */
export function hasTradeIn(deal: Deal): boolean {
  return (
    ["year", "make", "model", "vin"].some((k) => Boolean(text(deal, `tradeIn1.${k}`))) ||
    cents(deal, "line.25") !== null ||
    cents(deal, "line.26") !== null
  );
}

export const DELIVERY_STATEMENTS: readonly DeliveryStatement[] = [
  {
    number: 1,
    title: "Received a copy of the Buyer's Order and understands and agrees to its terms",
    records: ["delivery.buyersOrderProvided"],
  },
  {
    number: 2,
    title:
      "Received the Buyer's Guide and warranty documents (if applicable); the Buyer's Guide was displayed in the vehicle before purchase",
    records: [
      "delivery.buyersGuideProvided",
      "delivery.warrantyDocsProvided",
      "delivery.buyersGuideDisplayed",
    ],
  },
  {
    number: 3,
    title:
      "Prior owners' negligence, reported/unreported accident damage, paintwork, keys, anti-theft codes, wheel locks and similar conditions",
    legalReview:
      "Liability limitation — must not waive consumer or warranty rights; approved wording only.",
  },
  {
    number: 4,
    title:
      "Required inspections, tag/registration work, state fines, parking tickets and penalties; titling on default",
    legalReview: "Jurisdiction-specific wording required (Virginia).",
  },
  {
    number: 5,
    title: "All lienholder information provided to the dealership for proper recording",
  },
  {
    number: 6,
    title: "Received the odometer disclosure statement",
    records: ["delivery.odometerDisclosureProvided"],
  },
  {
    number: 7,
    title:
      "The trade-in balance owed is an estimate; a higher actual payoff is owed by the purchaser, a lower one is paid or credited",
    applies: (deal) =>
      hasTradeIn(deal)
        ? { applies: true }
        : { applies: false, reason: "No trade-in is part of this deal." },
  },
  {
    number: 8,
    title: "Everything promised has been put in writing; representatives can't make oral promises",
  },
  { number: 9, title: "Questions about the transaction have been answered" },
];

/**
 * Who initials each statement. The reference shows one initials box per
 * statement for the Purchaser; whether the Co-Purchaser also initials is
 * decided by the approved template. Change only with that approval.
 */
export const DELIVERY_INITIAL_ROLES: readonly SignerRole[] = ["buyer"];

export const DELIVERY_CHECKLIST_SIGNATURES: readonly SignatureRequirement[] = [
  { id: "dc-purchaser", role: "buyer", page: 1, location: "SIGNATURE OF PURCHASER / Date" },
  {
    id: "dc-copurchaser",
    role: "co_buyer",
    page: 1,
    location: "Signed Co-Purchaser / Date",
    conditional: "co_buyer_included",
  },
  {
    id: "dc-representative",
    role: "dealer",
    page: 1,
    location: "SIGNATURE OF AUTHORIZED REPRESENTATIVE",
  },
];

/** "Demo Buyer and Demo Co-Buyer". */
export function purchaserNames(deal: Deal): string {
  return [fullName(deal, "buyer"), deal.coBuyerIncluded ? fullName(deal, "coBuyer") : ""]
    .filter(Boolean)
    .join(" and ");
}

const RECORD_KEYS = [
  "delivery.buyersOrderProvided",
  "delivery.buyersGuideProvided",
  "delivery.buyersGuideDisplayed",
  "delivery.warrantyDocsProvided",
  "delivery.odometerDisclosureProvided",
] as const;

/** Staff document-delivery records made so far. */
export function deliveryRecordsMade(deal: Deal): { done: number; total: number } {
  return {
    done: RECORD_KEYS.filter((k) => deal.fields[k]?.value === true).length,
    total: RECORD_KEYS.length,
  };
}
