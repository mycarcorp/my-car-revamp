/**
 * Form 1 — Bill of Sale / Buyer's Order: itemization, calculations, layout
 * map and signature locations.
 *
 * Structure follows the reference Virginia Bill of Sale / Buyer's Order
 * (three pages). Only field names, numbering and section placement are
 * reproduced here. The reference's legal text is NOT copied: pages 2–3 are
 * mapped by section title and stay "approved template required" until My Car
 * supplies an authorized blank form.
 */
import { cents as centsOf, text, type Deal } from "./deal-model";

export type ItemLine = {
  number: number;
  label: string;
  /** "input" lines are entered by staff; "calc" lines are always computed. */
  kind: "input" | "calc";
  /** Label comes from the approved configuration (lineLabel.N). */
  configurableLabel?: boolean;
  formula?: string;
  section: "sale" | "fees" | "products" | "totals";
};

const input = (
  number: number,
  label: string,
  section: ItemLine["section"],
  configurableLabel = false,
): ItemLine => ({
  number,
  label,
  kind: "input",
  section,
  ...(configurableLabel ? { configurableLabel } : {}),
});
const calc = (
  number: number,
  label: string,
  formula: string,
  section: ItemLine["section"],
): ItemLine => ({
  number,
  label,
  kind: "calc",
  formula,
  section,
});

export const BILL_OF_SALE_LINES: readonly ItemLine[] = [
  input(1, "Vehicle Sales Price", "sale"),
  input(2, "Sales Tax", "sale"),
  calc(3, "Subtotal", "Add lines 1+2", "sale"),
  input(4, "Uninsured motor vehicle fee", "fees"),
  input(5, "Registration fee", "fees"),
  input(6, "On-line systems filing fee", "fees"),
  input(7, "Processing fee", "fees"),
  input(8, "Dealer's business license fee", "fees"),
  input(9, "License", "fees"),
  input(10, "Title", "fees"),
  input(11, "Filing Fee", "fees"),
  input(12, "Other Fees", "fees"),
  input(13, "Additional fee", "fees", true),
  input(14, "Additional fee", "fees", true),
  calc(15, "Total Other Fees", "Add lines 4 through 14", "fees"),
  input(16, "Service Contract Tax", "products"),
  input(17, "Additional product", "products", true),
  input(18, "Additional product", "products", true),
  input(19, "Additional product", "products", true),
  input(20, "Additional product", "products", true),
  input(21, "Additional product", "products", true),
  input(22, "Additional product", "products", true),
  calc(23, "Total Products", "Add lines 16 through 22", "products"),
  calc(24, "Cash Sale Price", "Add lines 3+15+23", "totals"),
  input(25, "Trade-in Allowance", "totals"),
  input(26, "Less Payoff", "totals"),
  calc(27, "Net Trade Allowance", "Line 25-26", "totals"),
  input(28, "Cash Down Payment", "totals"),
  input(29, "Deferred Down Payment", "totals"),
  calc(30, "Total Down Payment", "Line 27+28+29", "totals"),
  calc(31, "Total Balance Due", "Line 24-30", "totals"),
];

export const BILL_OF_SALE_SECTION_TITLES: Record<ItemLine["section"], string | null> = {
  sale: null,
  fees: "Title, License & Other Fees",
  products: "Additional Products",
  totals: null,
};

export type ComputedLine = ItemLine & { label: string; cents: number | null };

const sum = (values: Array<number | null>): number | null => {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
};
/** a − b where a missing side counts as 0; null when both are missing. */
const diff = (a: number | null, b: number | null): number | null =>
  a === null && b === null ? null : (a ?? 0) - (b ?? 0);

/** Computes every line in integer cents. Calculated lines can't be overridden. */
export function computeBillOfSale(deal: Deal): {
  lines: ComputedLine[];
  byNumber: Record<number, number | null>;
  negativeEquityCents: number | null;
} {
  const v: Record<number, number | null> = {};
  for (const line of BILL_OF_SALE_LINES)
    if (line.kind === "input") v[line.number] = centsOf(deal, `line.${line.number}`);
  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => v[from + i] ?? null);
  v[3] = sum([v[1]!, v[2]!]);
  v[15] = sum(range(4, 14));
  v[23] = sum(range(16, 22));
  v[24] = sum([v[3], v[15], v[23]]);
  v[27] = diff(v[25]!, v[26]!);
  v[30] = sum([v[27], v[28]!, v[29]!]);
  v[31] = diff(v[24], v[30]);
  const lines = BILL_OF_SALE_LINES.map((line) => ({
    ...line,
    label: line.configurableLabel
      ? text(deal, `lineLabel.${line.number}`) || line.label
      : line.label,
    cents: v[line.number] ?? null,
  }));
  // Page 3 notice: payoff exceeding the trade-in allowance increases the balance.
  const negativeEquityCents = v[27] !== null && v[27]! < 0 ? -v[27]! : null;
  return { lines, byNumber: v, negativeEquityCents };
}

// ------------------------------------------------------------
// Layout map of the reference (3 pages)
// ------------------------------------------------------------

export type LayoutSection = {
  id: string;
  title: string;
  column: "left" | "right" | "full";
  /** Deal fields shown in this section, in reference order. */
  fields?: readonly string[];
  /** The reference prints legal text here; it must come from the approved template. */
  legalTextRequired?: boolean;
};

const tradeInFields = (n: 1 | 2) =>
  [
    "year",
    "licenseNumber",
    "make",
    "odometer",
    "model",
    "color",
    "bodyStyle",
    "vin",
    "lienholderName",
    "lienholderAddress",
    "lienholderPhone",
    "payoff",
    "payoffGoodThrough",
    "approved",
  ].map((k) => `tradeIn${n}.${k}`);

export const BILL_OF_SALE_LAYOUT: ReadonlyArray<{ page: 1 | 2 | 3; sections: LayoutSection[] }> = [
  {
    page: 1,
    sections: [
      {
        id: "dealer",
        title: "Dealer/Seller Name and Address",
        column: "left",
        fields: [
          "dealer.legalName",
          "dealer.street",
          "dealer.city",
          "dealer.state",
          "dealer.zip",
          "dealer.phone",
        ],
      },
      {
        id: "parties",
        title: "Buyer/Co-Buyer Name(s) and Address(es)",
        column: "right",
        fields: [
          "buyer.firstName",
          "buyer.lastName",
          "buyer.street",
          "buyer.city",
          "buyer.state",
          "buyer.zip",
          "buyer.phone",
          "coBuyer.firstName",
          "coBuyer.lastName",
          "coBuyer.street",
          "coBuyer.city",
          "coBuyer.state",
          "coBuyer.zip",
          "coBuyer.phone",
        ],
      },
      {
        id: "references",
        title: "Date / Stock No. / Salesperson / App No. / Contract No.",
        column: "full",
        fields: [
          "deal.date",
          "deal.stockNumber",
          "dealer.salesperson",
          "deal.appNumber",
          "deal.contractNumber",
        ],
      },
      {
        id: "vehicle",
        title: "Vehicle Information",
        column: "left",
        fields: [
          "vehicle.condition",
          "vehicle.year",
          "vehicle.licenseNumber",
          "vehicle.make",
          "vehicle.odometer",
          "vehicle.model",
          "vehicle.color",
          "vehicle.bodyStyle",
          "vehicle.vin",
          "vehicle.other",
        ],
      },
      {
        id: "insurance",
        title: "Insurance Information",
        column: "left",
        fields: ["insurance.company", "insurance.policyNumber", "insurance.status"],
        legalTextRequired: true,
      },
      { id: "tradeIn1", title: "Trade-in 1", column: "left", fields: tradeInFields(1) },
      { id: "tradeIn2", title: "Trade-in 2", column: "left", fields: tradeInFields(2) },
      { id: "itemization", title: "Itemization of Sale (lines 1–31)", column: "right" },
      {
        id: "asIs",
        title: '"AS IS" acknowledgment and Used Car Buyer Notice reference',
        column: "right",
        fields: ["asIs"],
        legalTextRequired: true,
      },
      { id: "signaturesPage1", title: "Buyer / Co-Buyer signatures", column: "right" },
    ],
  },
  {
    page: 2,
    sections: [
      "Definitions",
      "Agreement to Purchase",
      "Manufacturer",
      "Insurance",
      "Trade-in Vehicle",
      "Retail Installment Contract",
      "Vehicle Inspection",
      "Vehicle Condition",
    ].map((title, i) => ({
      id: `terms-${i + 1}`,
      title: `Additional Terms — ${title}`,
      column: i < 4 ? ("left" as const) : ("right" as const),
      legalTextRequired: true,
    })),
  },
  {
    page: 3,
    sections: [
      {
        id: "warranty",
        title: "Warranty Information (Warranty, Used Car Buyer Notice, Spanish notice)",
        column: "left",
        legalTextRequired: true,
      },
      {
        id: "vaNotice",
        title: "Additional Virginia Notice",
        column: "left",
        legalTextRequired: true,
      },
      {
        id: "negativeEquity",
        title: "Notice — negative equity amount (from line 27)",
        column: "left",
        legalTextRequired: true,
      },
      {
        id: "demonstrator",
        title: "Notice — demonstrator mileage (with date)",
        column: "left",
        legalTextRequired: true,
      },
      {
        id: "financing",
        title: "Notice — financing / retail installment sales contract",
        column: "full",
        legalTextRequired: true,
      },
      {
        id: "signatures",
        title: "Signatures — Buyer, Co-Buyer, Dealer/Seller (with dates)",
        column: "right",
        legalTextRequired: true,
      },
      {
        id: "arbitration",
        title: "Separate Arbitration Agreement checkbox",
        column: "right",
        legalTextRequired: true,
      },
    ],
  },
];

// ------------------------------------------------------------
// Signature locations
// ------------------------------------------------------------

export type SignerRole = "buyer" | "co_buyer" | "dealer";

export type SignatureRequirement = {
  id: string;
  role: SignerRole;
  page: number;
  location: string;
  /** Co-Buyer lines apply only when a Co-Buyer is on the deal. */
  conditional?: "co_buyer_included";
};

/** Where Form 1 is signed. Status, identity, provider and signed-PDF references live per deal. */
export const BILL_OF_SALE_SIGNATURES: readonly SignatureRequirement[] = [
  { id: "p1-buyer", role: "buyer", page: 1, location: 'Under the "AS IS" acknowledgment (left X)' },
  {
    id: "p1-cobuyer",
    role: "co_buyer",
    page: 1,
    location: 'Under the "AS IS" acknowledgment (right X)',
    conditional: "co_buyer_included",
  },
  { id: "p3-buyer", role: "buyer", page: 3, location: "Signatures — first X with date" },
  {
    id: "p3-cobuyer",
    role: "co_buyer",
    page: 3,
    location: "Signatures — second X with date",
    conditional: "co_buyer_included",
  },
  { id: "p3-dealer", role: "dealer", page: 3, location: "Signatures — Dealer/Seller X with date" },
];

export type SignatureStatus = "not_ready" | "awaiting_provider" | "sent" | "signed" | "declined";

/** Per-deal signature record. Only a verified e-signature provider callback may set "signed". */
export type SignatureRecord = {
  requirementId: string;
  role: SignerRole;
  signerIdentity: string | null;
  agreementVersion: string | null;
  status: SignatureStatus;
  signedAt: string | null;
  providerReference: string | null;
  signedPdfRef: string | null;
};

export function initialSignatureRecords(deal: Deal): SignatureRecord[] {
  return BILL_OF_SALE_SIGNATURES.filter(
    (s) => s.conditional !== "co_buyer_included" || deal.coBuyerIncluded,
  ).map((s) => ({
    requirementId: s.id,
    role: s.role,
    signerIdentity: null,
    agreementVersion: null,
    status: "not_ready",
    signedAt: null,
    providerReference: null,
    signedPdfRef: null,
  }));
}
