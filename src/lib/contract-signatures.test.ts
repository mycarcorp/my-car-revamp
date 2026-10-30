import { describe, expect, it } from "vitest";

import {
  allSignatureSlots,
  realDealCompletionBlockers,
  requiredSignerRoles,
  signatureSlotsFor,
  formatSignatureDate,
  sameLegalName,
  signerIdentity,
  type SignatureCapture,
} from "./contract-signatures";
import { editDealField, type Deal } from "./deal-model";
import { billOfSaleDemoPages, buildDemoPdfPages, DEMO_SIGNATURE_TAG } from "./demo-contract-pdf";
import {
  adoptDemoSignature,
  captureIsEmpty,
  contractDemoSigned,
  demoCompletionMissing,
  removeDemoSignature,
  type DemoSignatures,
} from "./demo-signatures";
import { demoReleasedContracts, demoDeal } from "./lease-to-own-demo";
import { initialDealContracts } from "./lease-contracts";

const deal = () => demoDeal({ vehicleValueCents: 1_000_000, packageDownCents: 200_000 });
const withDealer = (d: Deal) =>
  editDealField(d, "dealer.authorizedSigner", "Demo Dealer Rep", "staff").deal;
const drawn: SignatureCapture = {
  kind: "drawn",
  width: 400,
  height: 100,
  strokes: [
    [
      [10, 50],
      [60, 20],
      [120, 70],
      [200, 40],
    ],
  ],
};
const adopt = (
  sigs: DemoSignatures,
  d: Deal,
  role: "buyer" | "co_buyer" | "dealer",
  capture: SignatureCapture | null = drawn,
  certified = true,
) =>
  adoptDemoSignature(sigs, d, { role, capture, certified, now: new Date("2026-10-29T12:00:00Z") });

describe("signature locations", () => {
  it("Form 1 has Buyer and Co-Buyer on pages 1 and 3 and the Dealer/Seller on page 3", () => {
    const slots = signatureSlotsFor("bill_of_sale", deal());
    expect(slots.map((s) => `${s.page}:${s.role}`)).toEqual([
      "1:buyer",
      "1:co_buyer",
      "3:buyer",
      "3:co_buyer",
      "3:dealer",
    ]);
    expect(slots.every((s) => s.locationConfirmed)).toBe(true);
  });

  it("drops Co-Buyer lines when there is no Co-Buyer", () => {
    const solo = { ...deal(), coBuyerIncluded: false };
    expect(allSignatureSlots(solo).some((s) => s.role === "co_buyer")).toBe(false);
    expect(requiredSignerRoles(solo)).toEqual(["buyer", "dealer"]);
  });

  it("Forms 6–10 use placeholder Buyer/Co-Buyer locations and never a dealer line yet", () => {
    const slots = signatureSlotsFor("insurance_agreement", deal());
    expect(slots.map((s) => s.role)).toEqual(["buyer", "co_buyer"]);
    expect(slots.every((s) => !s.locationConfirmed)).toBe(true);
  });

  it("printed names come from the deal and missing values stay missing", () => {
    const d = deal();
    expect(signerIdentity(d, "buyer").printedName).toBe("Demo Buyer");
    expect(signerIdentity(d, "co_buyer").printedName).toBe("Demo Co-Buyer");
    expect(signerIdentity(d, "dealer")).toEqual({
      role: "dealer",
      printedName: null,
      organization: "My Car Business Services LLC",
    });
    expect(signerIdentity(withDealer(d), "dealer").printedName).toBe("Demo Dealer Rep");
  });
});

describe("demo signature adoption", () => {
  it("rejects an empty signature and requires the certification", () => {
    expect(captureIsEmpty(null)).toBe(true);
    expect(captureIsEmpty({ ...drawn, strokes: [[[1, 1]]] })).toBe(true);
    expect(adopt({}, deal(), "buyer", null)).toMatchObject({ ok: false });
    expect(adopt({}, deal(), "buyer", drawn, false)).toEqual({
      ok: false,
      error: "Check the demo certification box first.",
    });
  });

  it("a script signature must be the signer's own name", () => {
    expect(adopt({}, deal(), "buyer", { kind: "script", name: "Demo Co-Buyer" })).toMatchObject({
      ok: false,
    });
    expect(adopt({}, deal(), "buyer", { kind: "script", name: "Demo Buyer" }).ok).toBe(true);
  });

  it("applies only to the signer's own locations across all 10 forms", () => {
    const result = adopt({}, deal(), "buyer");
    if (!result.ok) throw new Error(result.error);
    expect(result.appliedTo.every((s) => s.role === "buyer")).toBe(true);
    expect(new Set(result.appliedTo.map((s) => s.contractId)).size).toBe(10);
    expect(result.appliedTo).toHaveLength(16); // Form 1: 2, Form 2: 2 (page 5), Form 3: 2 + 3 page initials, Forms 4–10: 1 each
    expect(Object.keys(result.signatures)).toEqual(["buyer"]);
    expect(contractDemoSigned("bill_of_sale", deal(), result.signatures)).toBe(false);
  });

  it("does not let anyone sign without a name, or as a missing Co-Buyer", () => {
    expect(adopt({}, deal(), "dealer")).toMatchObject({ ok: false });
    expect(adopt({}, { ...deal(), coBuyerIncluded: false }, "co_buyer")).toMatchObject({
      ok: false,
    });
  });

  it("completion needs every required signer; removing one blocks it again", () => {
    const d = withDealer(deal());
    let sigs: DemoSignatures = {};
    for (const role of ["buyer", "co_buyer"] as const) {
      const r = adopt(sigs, d, role);
      if (!r.ok) throw new Error(r.error);
      sigs = r.signatures;
    }
    expect(demoCompletionMissing(d, sigs)).toEqual(["dealer"]);
    const r = adopt(sigs, d, "dealer");
    if (!r.ok) throw new Error(r.error);
    expect(demoCompletionMissing(d, r.signatures)).toEqual([]);
    expect(contractDemoSigned("bill_of_sale", d, r.signatures)).toBe(true);
    expect(demoCompletionMissing(d, removeDemoSignature(r.signatures, "co_buyer"))).toEqual([
      "co_buyer",
    ]);
  });

  it("demo signatures never mark the contract records signed", () => {
    const r = adopt({}, deal(), "buyer");
    expect(r.ok).toBe(true);
    expect(demoReleasedContracts().every((c) => !c.completed && !c.signedBy.buyer)).toBe(true);
  });
});

describe("Bill of Sale page 3 preview", () => {
  it("has Warranty, Notices and Signatures with names, and a demo tag only once signed", () => {
    const d = withDealer(deal());
    const blank = buildDemoPdfPages(billOfSaleDemoPages(d));
    for (const t of [
      "Warranty Information",
      "Used Car Buyer Notice",
      "Additional Virginia Notice",
      "Notices",
      "Financing notice",
      "Signatures",
      "Demo Buyer",
      "Demo Co-Buyer",
      "Demo Dealer Rep",
      "My Car Business Services LLC",
      "Status: awaiting signature",
    ])
      expect(blank).toContain(t);
    expect(blank).not.toContain(DEMO_SIGNATURE_TAG);

    const r = adopt({}, d, "buyer", { kind: "script", name: "Demo Buyer" });
    if (!r.ok) throw new Error(r.error);
    const signed = buildDemoPdfPages(billOfSaleDemoPages(d, r.signatures));
    // Buyer lines on page 1 and page 3 only; Co-Buyer and Dealer stay blank.
    expect(signed.split(DEMO_SIGNATURE_TAG).length - 1).toBe(2);
    expect(signed).toContain("/F3 ");
    expect(signed).toContain("Status: awaiting signature");
  });
});

describe("real deal completion", () => {
  it("stays blocked without templates, provider, signatures, staff approval and payment", () => {
    const blockers = realDealCompletionBlockers({
      contracts: initialDealContracts(),
      esignProviderConnected: false,
      staffApproved: false,
      paymentAndActivationReady: false,
    });
    expect(blockers).toHaveLength(5);
    // Even a fully "approved" demo-like state is blocked while templates are missing.
    expect(
      realDealCompletionBlockers({
        contracts: demoReleasedContracts(),
        esignProviderConnected: true,
        staffApproved: true,
        paymentAndActivationReady: true,
      }).length,
    ).toBeGreaterThan(0);
  });
});

describe("typed-name signatures", () => {
  it("accepts only the signer's own legal name (case and spacing ignored)", () => {
    expect(sameLegalName("  demo   BUYER ", "Demo Buyer")).toBe(true);
    expect(sameLegalName("", "")).toBe(false);
    expect(adopt({}, deal(), "buyer", { kind: "script", name: "demo buyer" }).ok).toBe(true);
    const wrong = adopt({}, deal(), "buyer", { kind: "script", name: "Demo Co-Buyer" });
    expect(wrong).toMatchObject({ ok: false });
    expect(adopt({}, deal(), "co_buyer", { kind: "script", name: "Demo Buyer" }).ok).toBe(false);
  });

  it("a suggested name alone signs nothing", () => {
    expect(demoCompletionMissing(deal(), {})).toEqual(["buyer", "co_buyer", "dealer"]);
  });

  it("dates print as MM/DD/YYYY in the document", () => {
    expect(formatSignatureDate(new Date(2026, 9, 29, 12))).toBe("10/29/2026");
    const r = adoptDemoSignature({}, deal(), {
      role: "buyer",
      capture: { kind: "script", name: "Demo Buyer" },
      certified: true,
      now: new Date(2026, 9, 29, 15, 7),
    });
    if (!r.ok) throw new Error(r.error);
    const pdf = buildDemoPdfPages(billOfSaleDemoPages(deal(), r.signatures));
    expect(pdf).toContain("(10/29/2026)");
    expect(pdf).toContain("DEMO 10/29/2026 3:07 PM");
    expect(pdf).toContain("(Demo Buyer) Tj");
  });
});

describe("Bill of Sale page 3 notices", () => {
  it("staff-marked notices show as checked in the PDF; customers cannot mark them", () => {
    const d = deal();
    expect(editDealField(d, "notice.financing", true, "customer").error).toBeTruthy();
    const marked = editDealField(d, "notice.financing", true, "staff").deal;
    const pdf = buildDemoPdfPages(billOfSaleDemoPages(marked));
    expect(pdf).toContain("[ X ] Financing notice");
    expect(pdf).toContain("[   ] Demonstrator mileage notice");
    expect(pdf).toContain("[   ] Separate arbitration agreement");
  });
});
