/**
 * Lease to Own — customer-facing content inventory.
 *
 * Copy is carried over from the Smart Shield reference prototype. Wording that
 * reads as a guarantee, an unverified statistic, a third-party name, or a legal
 * or warranty term is kept in REVIEW_CLAIMS so management and counsel can approve
 * it. Until a claim is approved, the public page shows the qualified wording and
 * the original text is visible only to signed-in staff (review mode).
 */
import type { PackageEstimate } from "./lease-to-own";
import { SERVICE_LOCATION, TITLE_BUYOUT, getLeaseTier, paymentLabel, usd } from "./lease-to-own";

export type ReviewReason =
  | "absolute_promise"
  | "unverified_statistic"
  | "third_party"
  | "legal_term"
  | "warranty_term"
  | "financial_claim";

export type ReviewClaim = { id: string; reference: string; reason: ReviewReason; note: string };

export const REVIEW_REASON_LABELS: Record<ReviewReason, string> = {
  absolute_promise: "Absolute promise",
  unverified_statistic: "Unverified statistic",
  third_party: "Third-party name",
  legal_term: "Legal / regulatory term",
  warranty_term: "Warranty term",
  financial_claim: "Financial claim",
};

export const REVIEW_CLAIMS = {
  headline: {
    id: "headline",
    reference: "Never Get Repossessed Again. Stop Paying Uber. Own Your Independence.",
    reason: "absolute_promise",
    note: "Approved as the primary marketing concept by request; counsel should confirm it is acceptable with the qualifier shown beneath it.",
  },
  heroPitch: {
    id: "heroPitch",
    reference:
      'zero "as-is" repair risk … a guaranteed path to a clean Virginia pink slip in under 14 months.',
    reason: "absolute_promise",
    note: "Ownership is conditional on completing the agreement; repairs are limited by the warranty contract.",
  },
  paydayTiming: {
    id: "paydayTiming",
    reference: "Drafts timed 24h after your paycheck lands.",
    reason: "financial_claim",
    note: "Confirm the ACH scheduling capability and timing with the payment processor.",
  },
  ownershipTerm: {
    id: "ownershipTerm",
    reference: "100% debt-free ownership in 11 to 14 months.",
    reason: "absolute_promise",
    note: "Depends on on-time completion of all installments and the approved contract.",
  },
  uberHeadline: {
    id: "uberHeadline",
    reference: "Tired of Uber Draining $850/Month? / Save $850/mo",
    reason: "unverified_statistic",
    note: "Example figure only; replace with the calculator output or a sourced average.",
  },
  equityAsset: {
    id: "equityAsset",
    reference:
      "$10,000+ personal vehicle asset owned 100% free & clear for $100 buyout. / Uber: $0 equity.",
    reason: "financial_claim",
    note: "Vehicle value depreciates; equity must net remaining obligations. Calculator now shows both.",
  },
  defaultRate: {
    id: "defaultRate",
    reference: "We studied why 40% of standard Buy-Here-Pay-Here customers default across America.",
    reason: "unverified_statistic",
    note: "Needs a cited source before publication.",
  },
  completionRate: {
    id: "completionRate",
    reference: "96.8% Complete & Own Their Car",
    reason: "unverified_statistic",
    note: "Needs verified program data before publication.",
  },
  bancorp: {
    id: "bancorp",
    reference: "Automated ACH directly via The Bancorp Bank",
    reason: "third_party",
    note: "Confirm the banking relationship and permission to name it.",
  },
  progressive: {
    id: "progressive",
    reference: "Direct Progressive insurance coordination",
    reason: "third_party",
    note: "Confirm the relationship with Progressive and permission to name it.",
  },
  prepayment: {
    id: "prepayment",
    reference: "Zero prepayment penalty for paying off early",
    reason: "legal_term",
    note: "Must match the approved agreement.",
  },
  smsWarnings: {
    id: "smsWarnings",
    reference: "48-Hour advance SMS courtesy warnings",
    reason: "legal_term",
    note: "Notice periods for starter-interrupt devices must match Virginia law and the approved disclosure.",
  },
  bypassPin: {
    id: "bypassPin",
    reference: "Instant 24-Hour Emergency Medical Bypass PIN / 24h Override Shield",
    reason: "legal_term",
    note: "No telematics provider integration exists. The website must not issue or display override codes.",
  },
  warrantyTerm: {
    id: "warrantyTerm",
    reference: "Protected under Cars Protection Plus 24mo/30,000mi agreement.",
    reason: "warranty_term",
    note: "Confirm term, limits and exclusions from the actual Cars Protection Plus contract.",
  },
  freeService: {
    id: "freeService",
    reference:
      "Free full-synthetic oil & OEM filter changes every 90 days … 100% free maintenance at zero labor/parts cost.",
    reason: "financial_claim",
    note: "Business approval required for what the free service includes and any conditions.",
  },
  vaCompliance: {
    id: "vaCompliance",
    reference:
      "Virginia Safety Compliant / Virginia-certified inspection checklist / complies with Virginia DMV & Regulation M guidelines",
    reason: "legal_term",
    note: "Compliance statements require legal verification.",
  },
  twoHours: {
    id: "twoHours",
    reference: "From online application to driving off our Fredericksburg lot in under 2 hours.",
    reason: "absolute_promise",
    note: "Timing depends on review and verification.",
  },
  packageBadges: {
    id: "packageBadges",
    reference: '"Lowest Total Finance Cost" (Tier 1) / "Zero Overdraft Risk" (Tier 2)',
    reason: "financial_claim",
    note: "Comparative or risk-free claims need verification against approved terms.",
  },
  mileageFee: {
    id: "mileageFee",
    reference: "Excess mileage billed at $0.35/mi.",
    reason: "legal_term",
    note: "Must come from the approved mileage covenant.",
  },
  dealerLicense: {
    id: "dealerLicense",
    reference: "VA Dealer Lic. #48477 • (833) 866-9227 • mycarcorporation@gmail.com",
    reason: "legal_term",
    note: "Reference contact details differ from the live site; confirm before use in agreements.",
  },
} satisfies Record<string, ReviewClaim>;

export type ReviewClaimId = keyof typeof REVIEW_CLAIMS;

// ============================================================
// HERO
// ============================================================

export const HERO = {
  eyebrow: "The anti-repossession program",
  headlineLead: "Never Get Repossessed Again.",
  headlineAccent: "Stop Paying Uber. Own Your Independence.",
  secondary: "The First Car Program Engineered So You Actually Keep Your Vehicle.",
  pitch:
    "Too many buy-here-pay-here lots sell worn-out cars with large monthly bills and little support when something goes wrong. Our Lease to Own program is built to help you keep your car: powertrain warranty coverage, payments scheduled around your payday, free 90-day service, and a $100 title buyout when your agreement is complete.",
  qualifier:
    "Approval, payment amounts and terms depend on credit review, verification and your signed agreement. Ownership transfers after all scheduled payments are made.",
  safeguards: [
    { title: "Powertrain protection", body: "Cars Protection Plus powertrain warranty included" },
    {
      title: "Payday sync",
      body: "Weekly, biweekly or monthly schedules set around your paycheck",
    },
    { title: "Free 90-day service", body: "Scheduled checkups at our Fredericksburg location" },
    {
      title: `${usd(TITLE_BUYOUT)} title buyout`,
      body: "Clear title once your scheduled payments are complete",
    },
  ],
} as const;

// ============================================================
// FIVE SAFEGUARDS
// ============================================================

export type Safeguard = {
  number: number;
  trap: string;
  problem: string;
  solutionTitle: string;
  solutions: string[];
  quote: string;
  claims?: ReviewClaimId[];
};

export const SAFEGUARDS_INTRO = {
  eyebrow: "Why traditional BHPH fails",
  title: "5 traps that trigger repossession.",
  accent: "5 safeguards that keep you rolling.",
  body: "We looked at the most common reasons buy-here-pay-here customers fall behind, and built a safeguard for each one.",
} as const;

export const SAFEGUARDS: Safeguard[] = [
  {
    number: 1,
    trap: "The $1,500 breakdown",
    problem:
      'Many dealers sell cars "as-is." When an alternator or transmission fails a few months in, the repair and the car payment compete for the same paycheck — and the car sits.',
    solutionTitle: "Mechanical breakdown protection",
    solutions: [
      "Cars Protection Plus powertrain warranty coverage",
      "Free scheduled 90-day preventative checks",
      "Oil, filter, brake and diagnostic inspections at each visit",
    ],
    quote: "We help keep it running.",
    claims: ["warrantyTerm", "freeService"],
  },
  {
    number: 2,
    trap: "The 30-day payday mismatch",
    problem:
      "A single large payment due on the 1st doesn't line up with a paycheck that lands on the 8th. Overdraft fees snowball into missed payments.",
    solutionTitle: "Payday payment synchronization",
    solutions: [
      "Weekly, biweekly or monthly payment schedules",
      "Payment dates set relative to your payroll schedule",
      "Automatic ACH payments from your bank account",
    ],
    quote: "Pay when you get paid.",
    claims: ["paydayTiming", "bancorp"],
  },
  {
    number: 3,
    trap: "Surprise insurance spikes",
    problem:
      "When coverage lapses, some lenders add force-placed insurance that can double a payment overnight.",
    solutionTitle: "Insurance stability",
    solutions: [
      "Help coordinating coverage with your insurer",
      "Coverage and loss-payee verification before delivery",
      "Clear, written insurance requirements up front",
    ],
    quote: "Clear insurance requirements, no hidden markups.",
    claims: ["progressive"],
  },
  {
    number: 4,
    trap: "The 6-year negative equity trap",
    problem:
      "Stretching a high-interest loan over 60–72 months can leave you owing far more than the car is worth.",
    solutionTitle: "Shorter payoff structure",
    solutions: [
      "Illustrative 11- to 14-month payment program",
      `Fixed ${usd(TITLE_BUYOUT)} title buyout at the end of the term`,
      "Terms and conditions disclosed in writing before you sign",
    ],
    quote: "A path to a clear Virginia title in about a year.",
    claims: ["ownershipTerm", "prepayment"],
  },
  {
    number: 5,
    trap: "Midnight tow trucks & fees",
    problem:
      "Some lots send a tow truck with little warning when a payment is a few days late, leaving families stranded and facing recovery fees.",
    solutionTitle: "Emergency mobility protection",
    solutions: [
      "Advance payment reminders and notifications",
      "Emergency assistance requests reviewed by our team",
      "Real people to talk to in Fredericksburg, VA",
    ],
    quote: "Communication first.",
    claims: ["smsWarnings", "bypassPin"],
  },
];

export const PROGRAM_SUMMARY = {
  title: "Program at a glance",
  body: "We built the program around the reasons customers fall behind: unexpected repairs and payment dates that don't match paydays.",
  rows: [
    { label: "Down payment", value: "$1,000 – $3,000 (reference)" },
    { label: "Mileage allowance", value: "14,000 miles / year" },
    { label: "Scheduled inspections", value: "Every 90 days" },
    { label: "Title buyout", value: `${usd(TITLE_BUYOUT)} flat` },
  ],
  claims: ["completionRate", "defaultRate"] as ReviewClaimId[],
} as const;

// ============================================================
// MECHANICAL SAFEGUARD
// ============================================================

export type MechanicalComponent = {
  key: "powertrain" | "brakes" | "telematics";
  title: string;
  summary: string;
  tag: string;
  protection: string;
  inspection: string;
  maintenance: string;
  warranty: string;
  claims: ReviewClaimId[];
};

export const MECHANICAL_INTRO = {
  eyebrow: "The mechanical fortress",
  title: "How the 90-day checkup helps stop problems before they start",
  body: `Every 90 days, bring your vehicle to ${SERVICE_LOCATION}. Select a component to see what we look at.`,
} as const;

export const MECHANICAL_COMPONENTS: MechanicalComponent[] = [
  {
    key: "powertrain",
    title: "Engine & Powertrain",
    summary:
      "Engine block, transmission gear sets, seals and gaskets covered against major failure.",
    tag: "Oil & filter included",
    protection: "Covered components are protected by the Cars Protection Plus powertrain warranty.",
    inspection: "Fluid levels and leaks, engine and transmission diagnostic scan.",
    maintenance: "Oil and filter change at each scheduled 90-day visit.",
    warranty:
      "Coverage term, limits, deductibles and exclusions are set by your Cars Protection Plus agreement.",
    claims: ["warrantyTerm", "freeService"],
  },
  {
    key: "brakes",
    title: "Braking & Rotors",
    summary: "Hydraulic lines, master cylinder, calipers and pad wear checked every 90 days.",
    tag: "Safety inspection",
    protection: "Early detection of brake wear so issues are caught before they become expensive.",
    inspection: "Rotor thickness, pad lining depth, brake fluid condition and caliper function.",
    maintenance: "Findings are reviewed with you; any needed repair is quoted before work starts.",
    warranty:
      "Brake pads and rotors are wear items and are typically not covered by a powertrain warranty.",
    claims: ["vaCompliance"],
  },
  {
    key: "telematics",
    title: "4G Telematics & Vehicle Health",
    summary:
      "Vehicle health and odometer monitoring to help you stay within your mileage allowance.",
    tag: "Mileage tracking",
    protection: "Alerts help you schedule service before small issues turn into breakdowns.",
    inspection: "Device check and odometer verification at each 90-day visit.",
    maintenance: "Mileage is compared against your 14,000-mile annual allowance.",
    warranty:
      "The telematics device and any starter-interrupt function are described in the separate GPS disclosure you review before signing.",
    claims: ["bypassPin", "mileageFee"],
  },
];

// ============================================================
// HOW IT WORKS
// ============================================================

export const HOW_IT_WORKS = {
  eyebrow: "Your path to the keys",
  title: "How it works",
  body: "Apply online, upload your documents, review your agreements, and pick up your keys in Fredericksburg.",
  steps: [
    {
      title: "Select Your Package",
      body: "Pick $1,000, $2,000 or $3,000 down (reference) based on your budget and pay schedule.",
    },
    {
      title: "Submit Documents",
      body: "Upload your ID, 30-day paystub, bank statement, insurance and ACH authorization securely.",
    },
    {
      title: "E-Sign Contracts",
      body: "Review your Virginia lease-to-own agreements and sign electronically once they're ready.",
    },
    {
      title: "Pick Up Keys",
      body: "Drive away with Cars Protection Plus powertrain coverage and free 90-day service.",
    },
  ],
  claims: ["twoHours"] as ReviewClaimId[],
} as const;

export const ESTIMATE_DISCLAIMER =
  "Illustrative, nonbinding estimates based on reference program assumptions — not an offer of credit, an APR, or a disclosure. Actual down payment, payment amount, term and total cost are set only in your approved, signed agreement and depend on the vehicle, credit review and verification. Taxes, title, registration and fees are not included.";

export const CALCULATOR_ASSUMPTIONS = [
  "Rideshare spending = daily amount × 30 days per month.",
  "Ownership path uses the selected package's reference estimate: down payment plus each installment, plus the $100 title buyout when the last installment is paid.",
  "Estimated vehicle value assumes 15% depreciation per year. This is an illustration, not an appraisal.",
  "Estimated equity = estimated vehicle value − remaining scheduled payments (including the buyout). It can be negative early in the term.",
];

// ============================================================
// AGREEMENT DRAFTS (E-SIGN ROOM)
// ============================================================

export type AgreementKey =
  | "master_lease"
  | "mileage_covenant"
  | "service_agreement"
  | "gps_disclosure"
  | "ach_authorization";

export const AGREEMENTS: ReadonlyArray<{ key: AgreementKey; tab: string; title: string }> = [
  { key: "master_lease", tab: "1. Master Lease-to-Own", title: "Master Lease-to-Own Agreement" },
  { key: "mileage_covenant", tab: "2. 14,000-Mile Covenant", title: "14,000-Mile Annual Covenant" },
  { key: "service_agreement", tab: "3. 90-Day Service", title: "90-Day Free Service Agreement" },
  {
    key: "gps_disclosure",
    tab: "4. GPS & Starter-Interrupt",
    title: "4G GPS & Starter-Interrupt Disclosure",
  },
  {
    key: "ach_authorization",
    tab: "5. ACH Pre-Authorization",
    title: "ACH Pre-Authorization Agreement",
  },
];

/** Bump when the draft wording changes; recorded with any future signature. */
export const AGREEMENT_DRAFT_VERSION = "draft-reference-2026-10";

export type AgreementContext = {
  customerName: string;
  customerAddress: string;
  vehicleTitle: string | null;
  vehicleVin: string | null;
  estimate: PackageEstimate;
};

export type AgreementSection = { heading: string; body: string };

/**
 * Reference summaries only. These are NOT approved contract language and must
 * be replaced by templates supplied by management or Virginia counsel.
 */
export function agreementDraft(key: AgreementKey, ctx: AgreementContext): AgreementSection[] {
  const tier = getLeaseTier(ctx.estimate.tier);
  const vehicle = ctx.vehicleTitle
    ? `${ctx.vehicleTitle}${ctx.vehicleVin ? ` (VIN ${ctx.vehicleVin})` : ""}`
    : "Vehicle to be assigned by My Car";
  const parties: AgreementSection = {
    heading: "Parties & vehicle",
    body: `Lessee: ${ctx.customerName || "—"}. Address: ${ctx.customerAddress || "—"}. Lessor: My Car Business Services LLC, ${SERVICE_LOCATION}. Vehicle: ${vehicle}.`,
  };
  switch (key) {
    case "master_lease":
      return [
        parties,
        {
          heading: "Lease-to-own option",
          body: `Upon completion of all scheduled installments, the lessee may take title to the vehicle for ${usd(TITLE_BUYOUT)}.`,
        },
        {
          heading: "Payment terms (estimate)",
          body: `${tier.name}: down payment ${usd(ctx.estimate.downPayment)}; ${ctx.estimate.installments} installments of ${paymentLabel(ctx.estimate)}. Amounts shown are reference estimates and will be replaced by approved figures.`,
        },
        {
          heading: "Included safeguards",
          body: "Cars Protection Plus powertrain warranty and the 90-day service agreement, each governed by its own terms.",
        },
      ];
    case "mileage_covenant":
      return [
        parties,
        { heading: "Allowance", body: "14,000 miles per year (7,000 miles per 6-month interval)." },
        {
          heading: "Excess mileage",
          body: "Any excess-mileage charge will be stated in the approved covenant.",
        },
        {
          heading: "Verification",
          body: "Mileage is verified at scheduled 90-day visits and through the vehicle's telematics device.",
        },
      ];
    case "service_agreement":
      return [
        parties,
        {
          heading: "Scheduled presentation",
          body: `Vehicle to be presented every 90 days at ${SERVICE_LOCATION}.`,
        },
        {
          heading: "Included service",
          body: "Oil and filter service and a brake inspection at each scheduled visit, as defined in the approved agreement.",
        },
      ];
    case "gps_disclosure":
      return [
        parties,
        {
          heading: "Device notice",
          body: "The vehicle is equipped with a GPS telematics device that may include a starter-interrupt function.",
        },
        {
          heading: "Notice before disablement",
          body: "Required notice periods and emergency-use provisions will be stated in the approved Virginia disclosure.",
        },
      ];
    case "ach_authorization":
      return [
        parties,
        {
          heading: "Authorization",
          body: `Recurring ACH debits of ${paymentLabel(ctx.estimate)} on a ${tier.frequencyLabel.toLowerCase()} schedule set relative to your payroll.`,
        },
        {
          heading: "Bank account",
          body: "Collected through the payment processor's secure ACH authorization — never typed into this page.",
        },
        {
          heading: "Revocation",
          body: "How to revoke this authorization will be stated in the approved agreement.",
        },
      ];
  }
}
