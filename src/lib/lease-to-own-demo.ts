/**
 * Lease to Own — local Development Test Mode (UI preview only).
 *
 * Enabled only when BOTH are true:
 *   1. Vite is serving a development build (`import.meta.env.DEV`), and
 *   2. VITE_LEASE_WORKFLOW_DEMO=true is set locally (my-car-revamp/.env.local).
 *
 * `import.meta.env.DEV` is replaced with `false` in production builds, so the
 * demo UI is removed from the bundle even if the flag is set by mistake.
 *
 * The demo uses fictional data held in memory. It makes no network calls: no
 * server functions, Supabase, analytics, CRM, email/SMS, credit, payment,
 * e-signature or telematics. Nothing on the server knows the demo exists, so it
 * cannot approve, release or change any real record.
 */
import { buildDealFromApplication, type Deal } from "./deal-model";
import { initialDealContracts, type DealContract } from "./lease-contracts";

export function leaseDemoEnabled(env: {
  DEV?: boolean;
  VITE_LEASE_WORKFLOW_DEMO?: string;
}): boolean {
  return env.DEV === true && env.VITE_LEASE_WORKFLOW_DEMO === "true";
}

/** Demo screens, kept in the URL (`?demo=`) so the browser Back button works. */
export const LEASE_DEMO_STAGES = ["result", "contracts", "portal"] as const;
export type LeaseDemoStage = (typeof LEASE_DEMO_STAGES)[number];

export function isLeaseDemoStage(value: unknown): value is LeaseDemoStage {
  return LEASE_DEMO_STAGES.includes(value as LeaseDemoStage);
}

/**
 * Contracts open only after the simulated admin review, and the portal preview
 * only after the simulated deal completion, mirroring the real rules. Both live
 * in page memory, so a reload or a pasted `?demo=` URL lands back on the locked
 * result screen.
 */
export function visibleDemoStage(
  requested: LeaseDemoStage,
  simulatedApproval: boolean,
  simulatedCompletion = false,
): LeaseDemoStage {
  if (!simulatedApproval) return "result";
  if (requested === "portal" && !simulatedCompletion) return "contracts";
  return requested;
}

/** Fictional progress shown on the demo result screen. Real progress comes from backend milestones. */
export const DEMO_PROGRESS_PERCENT = 85;

/** The contract suite as the simulated admin review leaves it: released, nothing signed. */
export function demoReleasedContracts(): DealContract[] {
  return initialDealContracts().map((c) => ({ ...c, status: "released", released: true }));
}

/**
 * Fictional application, applicants and inventory vehicle for the demo. They go
 * through the same prefill as a real application (buildDealFromApplication),
 * so the field mapping is exercised, but no real record is read or written.
 * 555-01xx numbers and example.com addresses are reserved for fiction.
 */
export function demoDeal(input: { vehicleValueCents: number; packageDownCents: number }): Deal {
  return buildDealFromApplication({
    applicationId: 0,
    appNumber: "DEMO-3244",
    buyer: {
      applicantId: 1,
      firstName: "Demo",
      lastName: "Buyer",
      email: "demo.buyer@example.com",
      phone: "(555) 010-0100",
      street: "100 Demo Street",
      city: "Example City",
      state: "VA",
      zip: "22401",
    },
    coBuyer: {
      applicantId: 2,
      firstName: "Demo",
      lastName: "Co-Buyer",
      email: "demo.cobuyer@example.com",
      phone: "(555) 010-0101",
      street: "200 Sample Avenue",
      city: "Example City",
      state: "VA",
      zip: "22401",
    },
    vehicle: {
      stockNumber: "DEMO-STOCK-1",
      vin: "DEMO-VIN-NOT-REAL",
      year: "2020",
      make: "Demo Make",
      model: "Demo Model",
      bodyStyle: "Sedan",
      mileage: "45000",
      color: "Silver",
      condition: "used",
      priceCents: input.vehicleValueCents,
    },
    tradeIn: {
      year: "2012",
      make: "Demo Make",
      model: "Trade Model",
      mileage: "120000",
      payoffCents: null,
    },
    packageDownCents: input.packageDownCents,
    insuranceDocument: { status: "uploaded", documentId: null },
    dealer: {
      legalName: "My Car Business Services LLC",
      street: "4720 Harrison Rd",
      city: "Fredericksburg",
      state: "VA",
      zip: "22408",
      phone: "(540) 426-3322",
    },
    date: new Date().toISOString().slice(0, 10),
  });
}
