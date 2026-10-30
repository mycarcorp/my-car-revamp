/**
 * Form 5 — Customer Delivery Checklist: staff-recorded document-delivery facts
 * ("delivery.*"). Purchasers, vehicle, trade-in and dealer are the shared deal
 * fields. A record here means authorized staff recorded handing the document
 * over; it starts unrecorded and is never inferred (e.g. from mileage existing).
 *
 * Kept free of runtime imports so deal-model.ts can include these definitions.
 */
import type { FieldDef } from "./deal-model";

export const DELIVERY_CHECKLIST_FIELD_DEFS: readonly FieldDef[] = [
  {
    key: "delivery.buyersOrderProvided",
    label: "Buyer's Order provided to the purchaser",
    kind: "boolean",
  },
  { key: "delivery.buyersGuideProvided", label: "Buyer's Guide provided", kind: "boolean" },
  {
    key: "delivery.buyersGuideDisplayed",
    label: "Buyer's Guide displayed in the vehicle before purchase",
    kind: "boolean",
  },
  {
    key: "delivery.warrantyDocsProvided",
    label: "Warranty documents provided (if applicable)",
    kind: "boolean",
  },
  {
    key: "delivery.odometerDisclosureProvided",
    label: "Odometer disclosure statement provided",
    kind: "boolean",
  },
  {
    key: "delivery.representativeTitle",
    label: "Representative's role / authorization",
    kind: "text",
  },
];
