import { describe, expect, it } from "vitest";

import { requiredSignerRoles, signatureSlotsFor, signerIdentity } from "./contract-signatures";
import {
  applicableStateNotices,
  creditApplicationIssues,
  creditApplicationMissing,
  dealerUseFinancials,
  initialsOf,
  previousAddressApplies,
  previousEmployerApplies,
  wisconsinSpouseSigns,
} from "./credit-application";
import { editDealField, type Deal } from "./deal-model";
import { buildDemoPdfPages, creditApplicationDemoPages, DEMO_WATERMARK } from "./demo-contract-pdf";
import { adoptDemoSignature } from "./demo-signatures";
import { demoDeal } from "./lease-to-own-demo";

const base = () => demoDeal({ vehicleValueCents: 1_000_000, packageDownCents: 200_000 });
const staff = (d: Deal, values: Record<string, string | boolean>) =>
  Object.entries(values).reduce((acc, [k, v]) => {
    const r = editDealField(acc, k, v, "staff");
    if (r.error) throw new Error(`${k}: ${r.error}`);
    return r.deal;
  }, d);
const ids = (d: Deal) => signatureSlotsFor("credit_application", d).map((s) => s.id);
const val = (d: Deal, k: string) => d.fields[k]?.value;

describe("prefill from the pre-qualification application", () => {
  it("(A) comes from the Buyer and (B) from the Co-Buyer, kept separate", () => {
    const d = base();
    expect(val(d, "buyer.firstName")).toBe("Demo");
    expect(val(d, "buyer.dob")).toBe("1990-01-15");
    expect(val(d, "coBuyer.dob")).toBe("1955-06-01");
    expect(val(d, "buyer.idType")).toBe("drivers_license");
    expect(val(d, "buyer.idLast4")).toBe("0001");
    expect(val(d, "coBuyer.idLast4")).toBe("0002");
    expect(val(d, "buyer.employer")).toBe("Demo Employer LLC");
    expect(val(d, "buyer.income")).toBe(350_000);
    expect(val(d, "buyer.yearsAtJob")).toBe(3);
    expect(val(d, "coBuyer.unit")).toBe("Apt 2");
  });

  it("maps housing type to residential status by meaning only", () => {
    const d = base();
    expect(val(d, "buyer.residentialStatus")).toBe("rent");
    expect(val(d, "coBuyer.residentialStatus")).toBe("relatives");
  });

  it("income without an employer becomes other income, never an invented job", () => {
    const d = base();
    expect(val(d, "coBuyer.employer")).toBe("");
    expect(val(d, "credit.otherIncome.2.party")).toBe("b");
    expect(val(d, "credit.otherIncome.2.amount")).toBe(120_000);
    expect(val(d, "credit.otherIncome.2.source")).toBe("Retirement benefits");
    expect(val(d, "credit.otherIncome.1.party")).toBe("");
  });

  it("holds no raw SSN or full ID number; masked values can't be edited by anyone", () => {
    const d = base();
    const all = JSON.stringify(d.fields);
    expect(all).not.toMatch(/\d{3}-?\d{2}-?\d{4}/);
    expect(val(d, "buyer.ssnStatus")).toBe("not_collected");
    expect(val(d, "buyer.ssnLast4")).toBe("");
    for (const k of ["buyer.ssnLast4", "buyer.ssnStatus", "buyer.idLast4"])
      expect(editDealField(d, k, "1234", "staff").error).toMatch(/staff/);
    expect(creditApplicationMissing(d)).toContain(
      "Applicant (A): SSN/ITIN — secure identity integration required",
    );
  });

  it("customers can't edit; durations accept 0 and reject impossible months", () => {
    expect(editDealField(base(), "buyer.middleName", "Q", "customer").error).toMatch(/staff/);
    expect(editDealField(base(), "buyer.yearsAtAddress", "0", "staff").error).toBeUndefined();
    expect(editDealField(base(), "buyer.monthsAtAddress", "12", "staff").error).toMatch(/0 to 11/);
  });
});

describe("joint credit is never assumed", () => {
  it("starts unselected; (B) signatures and joint initials appear only when Joint is chosen", () => {
    const d = base();
    expect(val(d, "credit.creditType")).toBe("");
    expect(ids(d)).toEqual([
      "ca-p1-inits-buyer",
      "ca-p2-buyer",
      "ca-p2-inits-buyer",
      "ca-p3-buyer",
      "ca-p3-inits-buyer",
    ]);
    const joint = staff(d, { "credit.creditType": "joint" });
    expect(ids(joint)).toEqual(
      expect.arrayContaining([
        "ca-p1-joint-buyer",
        "ca-p1-joint-cobuyer",
        "ca-p2-cobuyer",
        "ca-p3-cobuyer",
        "ca-p2-inits-cobuyer",
      ]),
    );
  });

  it("flags a Co-Buyer without joint credit, and joint credit without a Joint Applicant", () => {
    const individual = staff(base(), { "credit.creditType": "individual" });
    expect(creditApplicationIssues(individual).map((i) => i.id)).toContain("cobuyer-not-joint");
    const solo = { ...staff(base(), { "credit.creditType": "joint" }), coBuyerIncluded: false };
    expect(creditApplicationIssues(solo).map((i) => i.id)).toContain("joint-without-b");
    expect(ids(solo).some((id) => id.endsWith("cobuyer"))).toBe(false);
  });

  it("each applicant adopts only their own signature and initials", () => {
    const d = staff(base(), { "credit.creditType": "joint" });
    const r = adoptDemoSignature({}, d, {
      role: "buyer",
      capture: { kind: "script", name: "Demo Buyer" },
      certified: true,
    });
    if (!r.ok) throw new Error(r.error);
    const mine = r.appliedTo.filter((s) => s.contractId === "credit_application");
    expect(mine.every((s) => s.role === "buyer")).toBe(true);
    expect(mine.map((s) => s.id)).toContain("ca-p1-joint-buyer");
    expect(initialsOf("Demo Co-Buyer")).toBe("DCB");
    expect(initialsOf("Demo Buyer")).toBe("DB");
  });
});

describe("conditional sections", () => {
  it("previous address applies under 2 years, when unknown, or when already given", () => {
    const d = base();
    expect(previousAddressApplies(d, "buyer")).toBe(true); // duration unknown
    expect(previousAddressApplies(staff(d, { "buyer.yearsAtAddress": "5" }), "buyer")).toBe(false);
    expect(
      previousAddressApplies(
        staff(d, { "buyer.yearsAtAddress": "1", "buyer.monthsAtAddress": "11" }),
        "buyer",
      ),
    ).toBe(true);
    expect(previousAddressApplies(staff(d, { "coBuyer.yearsAtAddress": "9" }), "coBuyer")).toBe(
      true,
    ); // has prev address
  });

  it("previous employer applies under 2 years at the current job", () => {
    const d = base();
    expect(previousEmployerApplies(d, "buyer")).toBe(false); // 3 yrs 2 mos
    expect(previousEmployerApplies(staff(d, { "buyer.yearsAtJob": "1" }), "buyer")).toBe(true);
    expect(previousEmployerApplies(d, "coBuyer")).toBe(false); // no employer
  });
});

describe("state notices and the Wisconsin non-joint spouse", () => {
  it("applies notices by the applicants' residence states only", () => {
    expect(applicableStateNotices(base())).toEqual([]);
    const ny = staff(base(), { "buyer.state": "NY" });
    expect(applicableStateNotices(ny).map((n) => n.state)).toEqual(["NY"]);
    // (B)'s state counts only when joint credit is requested.
    const bInOhio = staff(base(), { "coBuyer.state": "OH" });
    expect(applicableStateNotices(bInOhio)).toEqual([]);
    expect(
      applicableStateNotices(staff(bInOhio, { "credit.creditType": "joint" })).map((n) => n.state),
    ).toEqual(["OH"]);
  });

  it("the spouse signs only in Wisconsin, when married/separated and named — separately", () => {
    const wi = staff(base(), { "buyer.state": "WI", "credit.wi.maritalStatus": "married" });
    expect(wisconsinSpouseSigns(wi)).toBe(false);
    const named = staff(wi, { "credit.wi.spouseName": "Demo Spouse" });
    expect(wisconsinSpouseSigns(named)).toBe(true);
    expect(requiredSignerRoles(named)).toContain("non_joint_spouse");
    expect(signerIdentity(named, "non_joint_spouse").printedName).toBe("Demo Spouse");
    expect(ids(named)).toContain("ca-p2-wi-spouse");
    const asCoBuyer = adoptDemoSignature({}, named, {
      role: "non_joint_spouse",
      capture: { kind: "script", name: "Demo Co-Buyer" },
      certified: true,
    });
    expect(asCoBuyer.ok).toBe(false);
    expect(wisconsinSpouseSigns(staff(named, { "credit.wi.maritalStatus": "unmarried" }))).toBe(
      false,
    );
    expect(wisconsinSpouseSigns(staff(named, { "buyer.state": "VA" }))).toBe(false);
  });
});

describe("For Dealer Use Only", () => {
  it("uses Form 2 values with the same meaning and keeps rate and APR apart", () => {
    const d = staff(base(), {
      "deal.date": "2026-01-01",
      "ric.item.a": "10,000.00",
      "ric.item.b": "N/A",
      "ric.item.c": "N/A",
      "ric.item.f": "N/A",
      "ric.item.g": "N/A",
      ...Object.fromEntries(
        ["k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "z"].map((l) => [
          `ric.item.${l}`,
          "N/A",
        ]),
      ),
      "ric.contractRate": "12.5",
      "ric.schedule.1.count": "24",
      "ric.schedule.1.amount": "400.00",
      "ric.schedule.1.frequency": "monthly",
      "ric.schedule.1.firstDue": "2026-02-01",
    });
    const f = Object.fromEntries(dealerUseFinancials(d).map((x) => [x.label, x.value]));
    expect(f["Cash down"]).toBe("$2,000.00");
    expect(f["Amount financed"]).toBe("$8,000.00");
    expect(f["Term"]).toBe("24");
    expect(f["Contract rate"]).toBe("12.5%");
    expect(f["APR (reference only)"]).toMatch(/^\d+\.\d\d%$/);
    expect(f["Cash selling price"]).toBe("");
  });

  it("dealer-only amounts are staff-controlled and locked with the financials", () => {
    expect(
      editDealField(base(), "credit.dealer.bookValue", "9,000", "customer").error,
    ).toBeTruthy();
    const locked = { ...base(), financialsLocked: true };
    expect(editDealField(locked, "credit.dealer.bookValue", "9,000", "staff").error).toMatch(
      /locked/,
    );
  });
});

describe("Form 3 demo PDF", () => {
  it("has three watermarked pages and masks identifiers", () => {
    const pdf = buildDemoPdfPages(creditApplicationDemoPages(base()));
    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(3);
    expect(pdf).toContain(DEMO_WATERMARK);
    expect(pdf).toContain("**** 0001");
    expect(pdf).toContain("secure identity integration required");
  });
});
