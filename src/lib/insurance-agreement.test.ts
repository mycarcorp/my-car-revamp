import { describe, expect, it } from "vitest";

import { signatureSlotsFor } from "./contract-signatures";
import { editDealField, type Deal } from "./deal-model";
import {
  buildDemoPdfPages,
  DEMO_WATERMARK,
  insuranceAgreementDemoPages,
} from "./demo-contract-pdf";
import {
  insuranceCreditor,
  insuranceIssues,
  insuranceSummary,
  policyPeriod,
  verificationStatus,
} from "./insurance-agreement";
import { demoDeal } from "./lease-to-own-demo";

const base = () => demoDeal({ vehicleValueCents: 1_000_000, packageDownCents: 200_000 });
const staff = (d: Deal, values: Record<string, string | boolean>) =>
  Object.entries(values).reduce((acc, [k, v]) => {
    const r = editDealField(acc, k, v, "staff");
    if (r.error) throw new Error(`${k}: ${r.error}`);
    return r.deal;
  }, d);
const today = new Date("2026-10-31T12:00:00Z");
const ids = (d: Deal) => new Set(insuranceIssues(d, today).map((i) => i.id));
const none = { buyer: false, co_buyer: false, dealer: false };

describe("creditor / loss payee", () => {
  it("stays pending until staff confirm it — never assumed to be the dealer", () => {
    expect(insuranceCreditor(base()).status).toBe("pending");
    const dealer = staff(base(), { "ins.lenderIsDealer": true });
    expect(insuranceCreditor(dealer)).toMatchObject({
      status: "confirmed",
      name: "My Car Business Services LLC",
      street: "4720 Harrison Rd",
      cityStateZip: "Fredericksburg, VA 22408",
    });
    const other = staff(base(), {
      "ins.lenderName": "Example Lender",
      "ins.lenderStreet": "1 Example Way",
      "ins.lenderCity": "Example City",
    });
    expect(insuranceCreditor(other)).toMatchObject({ status: "confirmed", name: "Example Lender" });
  });
});

describe("coverage dates", () => {
  it("validates order and reports not started / active / expired", () => {
    expect(policyPeriod(base(), today).state).toBe("unknown");
    const span = (from: string, to: string) =>
      policyPeriod(staff(base(), { "ins.effectiveFrom": from, "ins.effectiveTo": to }), today)
        .state;
    expect(span("2026-12-01", "2026-11-01")).toBe("invalid");
    expect(span("2026-12-01", "2027-06-01")).toBe("not_started");
    expect(span("2026-01-01", "2027-01-01")).toBe("active");
    expect(span("2025-01-01", "2025-07-01")).toBe("expired");
  });

  it("shows Expired verification when the period has ended", () => {
    const d = staff(base(), {
      "ins.effectiveFrom": "2025-01-01",
      "ins.effectiveTo": "2025-07-01",
      "insurance.status": "verified",
    });
    expect(verificationStatus(d, today)).toBe("expired");
    expect(ids(d).has("expired")).toBe(true);
  });
});

describe("coverage, deductibles and verification", () => {
  it("coverage starts unknown — nothing is assumed covered", () => {
    const d = base();
    for (const k of ["fireTheft", "comprehensive", "collision"])
      expect(d.fields[`ins.cov.${k}`]?.value).toBe("");
    expect(ids(d).has("coverage-unknown")).toBe(true);
  });

  it("a reported collision coverage needs a deductible; amounts can't be negative", () => {
    const d = staff(base(), { "ins.cov.collision": "reported" });
    expect(ids(d).has("collision-deductible")).toBe(true);
    expect(ids(staff(d, { "ins.collisionDeductible": "500" })).has("collision-deductible")).toBe(
      false,
    );
    expect(editDealField(d, "ins.collisionDeductible", "-5", "staff").error).toMatch(/negative/);
  });

  it("validates the agent's US phone", () => {
    expect(ids(staff(base(), { "ins.agentPhone": "123" })).has("agent-phone")).toBe(true);
    expect(ids(staff(base(), { "ins.agentPhone": "(555) 234-5678" })).has("agent-phone")).toBe(
      false,
    );
  });

  it("an uploaded document is not verification, and customers can't verify", () => {
    expect(base().fields["insurance.status"]?.value).toBe("provided_unverified");
    expect(verificationStatus(base(), today)).toBe("provided_unverified");
    expect(editDealField(base(), "insurance.status", "verified", "customer").error).toMatch(
      /staff/,
    );
    expect(editDealField(base(), "insurance.documentId", "1", "staff").error).toMatch(/staff/);
  });
});

describe("completion summary", () => {
  it("filled fields alone don't complete the agreement", () => {
    const d = staff(base(), {
      "ins.lenderIsDealer": true,
      "insurance.company": "Example Insurance",
      "insurance.policyNumber": "DEMO-POLICY",
      "ins.agentName": "Example Agent",
      "ins.agentPhone": "(555) 234-5678",
      "ins.effectiveFrom": "2026-01-01",
      "ins.effectiveTo": "2027-01-01",
      "ins.cov.fireTheft": "reported",
      "ins.cov.comprehensive": "reported",
      "ins.cov.collision": "reported",
      "ins.compDeductible": "500",
      "ins.collisionDeductible": "500",
    });
    const all = { buyer: true, co_buyer: true, dealer: true };
    expect(insuranceSummary(d, all, today).complete).toBe(false); // not verified
    expect(
      insuranceSummary(staff(d, { "insurance.status": "verified" }), none, today).complete,
    ).toBe(false);
    expect(
      insuranceSummary(staff(d, { "insurance.status": "verified" }), all, today).complete,
    ).toBe(true);
  });
});

describe("signatures and PDF", () => {
  it("Purchaser, Co-Purchaser (when present) and the dealer sign separately", () => {
    const roles = (d: Deal) => signatureSlotsFor("insurance_agreement", d).map((s) => s.role);
    expect(roles(base())).toEqual(["buyer", "co_buyer", "dealer"]);
    expect(roles({ ...base(), coBuyerIncluded: false })).toEqual(["buyer", "dealer"]);
  });

  it("the PDF is one watermarked page with unknown coverage shown as unknown", () => {
    const pdf = buildDemoPdfPages(insuranceAgreementDemoPages(base()));
    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(1);
    expect(pdf).toContain(DEMO_WATERMARK);
    expect(pdf).toContain("[?] Fire, Theft");
    expect(pdf).toContain("creditor / loss payee pending confirmation");
  });
});
