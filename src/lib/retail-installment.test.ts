import { describe, expect, it } from "vitest";

import { requiredSignerRoles, signatureSlotsFor, signerIdentity } from "./contract-signatures";
import { editDealField, type Deal } from "./deal-model";
import {
  buildDemoPdfPages,
  DEMO_SIGNATURE_TAG,
  DEMO_WATERMARK,
  retailInstallmentDemoPages,
} from "./demo-contract-pdf";
import { adoptDemoSignature } from "./demo-signatures";
import { demoDeal } from "./lease-to-own-demo";
import {
  actuarialApr,
  computeDisclosures,
  computeItemization,
  formatAmount,
  periodsBetween,
  readSchedule,
  reconcileRetailInstallment,
  retailInstallmentMissing,
  unknownItemRows,
} from "./retail-installment";
import { RIC_INPUT_ROWS } from "./retail-installment-fields";

const base = () => demoDeal({ vehicleValueCents: 1_000_000, packageDownCents: 200_000 });
const staff = (d: Deal, values: Record<string, string | boolean>) =>
  Object.entries(values).reduce((acc, [k, v]) => {
    const r = editDealField(acc, k, v, "staff");
    if (r.error) throw new Error(`${k}: ${r.error}`);
    return r.deal;
  }, d);
/** Every input row N/A unless given. */
const allRows = (d: Deal, values: Record<string, string>) =>
  staff(d, Object.fromEntries(RIC_INPUT_ROWS.map((r) => [`ric.item.${r}`, values[r] ?? "N/A"])));
const shown = (d: Deal, l: "aa") => formatAmount(computeItemization(d)[l].amount);

describe("itemization a–aa", () => {
  it("applies d=b−c, h=d+e+f+g, i=a−h, y=j..x, aa=i+y−z in cents", () => {
    const d = allRows(base(), {
      a: "10,000.00",
      b: "3,000.00",
      c: "1,000.00",
      e: "1,500.00",
      g: "500.00",
      k: "486.00",
      n: "999.00",
      o: "845.50",
      z: "100.00",
    });
    const it = computeItemization(d);
    expect(formatAmount(it.d.amount)).toBe("$2,000.00");
    expect(formatAmount(it.j.amount)).toBe("$0.00");
    expect(formatAmount(it.h.amount)).toBe("$4,000.00");
    expect(formatAmount(it.i.amount)).toBe("$6,000.00");
    expect(formatAmount(it.y.amount)).toBe("$2,330.50");
    expect(formatAmount(it.aa.amount)).toBe("$8,230.50");
    expect(it.negativeEquityCents).toBeNull();
  });

  it("negative trade equity enters $0 on d and carries the payoff excess to j", () => {
    const d = allRows(base(), { a: "10,000.00", b: "3,000.00", c: "5,000.00", e: "1,000.00" });
    const it = computeItemization(d);
    expect(formatAmount(it.d.amount)).toBe("$0.00");
    expect(formatAmount(it.j.amount)).toBe("$2,000.00");
    expect(formatAmount(it.y.amount)).toBe("$2,000.00");
    expect(formatAmount(it.aa.amount)).toBe("$11,000.00");
    expect(it.negativeEquityCents).toBe(200_000);
  });

  it("never treats an unknown row as zero: totals stay pending and name the rows", () => {
    const d = staff(base(), { "ric.item.a": "10,000.00" });
    const it = computeItemization(d);
    expect(it.aa.amount.state).toBe("unknown");
    expect(it.aa.missing).toEqual(expect.arrayContaining(["b", "c", "f", "k", "z"]));
    expect(unknownItemRows(d)).not.toContain("a");
    expect(shown(d, "aa")).toBe("");
  });

  it("N/A and INCL. are explicit and add nothing", () => {
    const d = allRows(base(), { a: "1,000.00", k: "INCL." });
    expect(formatAmount(computeItemization(d).aa.amount)).toBe("$1,000.00");
    expect(formatAmount(computeItemization(d).k.amount)).toBe("INCL.");
  });

  it("only staff edit, financial rows lock, and bad amounts are refused", () => {
    expect(editDealField(base(), "ric.item.a", "100", "customer").error).toMatch(/staff/);
    expect(editDealField(base(), "ric.item.a", "abc", "staff").error).toMatch(/amount/);
    expect(editDealField(base(), "ric.item.a", "-5", "staff").error).toMatch(/negative/);
    const locked = { ...base(), financialsLocked: true };
    expect(editDealField(locked, "ric.item.k", "1", "staff").error).toMatch(/locked/);
    expect(editDealField(locked, "ric.schedule.1.count", "12", "staff").error).toMatch(/locked/);
    expect(editDealField(base(), "ric.contractRate", "120", "staff").error).toBeTruthy();
    expect(editDealField(base(), "ric.schedule.1.count", "0", "staff").error).toBeTruthy();
    expect(editDealField(base(), "ric.gap.type", "maybe", "staff").error).toMatch(/options/);
  });
});

describe("prefill and reconciliation with the Bill of Sale", () => {
  it("rows with the same meaning come from Form 1; blanks there stay unknown here", () => {
    const d = staff(base(), { "line.2": "600.00", "line.29": "250.00", "line.7": "99.00" });
    const it = computeItemization(d);
    expect(it.a).toMatchObject({ source: "bill_of_sale", amount: { cents: 1_060_000 } });
    expect(it.e).toMatchObject({ source: "bill_of_sale", amount: { cents: 200_000 } });
    expect(it.g.source).toBe("bill_of_sale");
    expect(it.n.source).toBe("bill_of_sale");
    expect(it.b.amount.state).toBe("unknown"); // line 25 blank on Form 1
  });

  it("row a needs both the price and the sales tax from Form 1", () => {
    expect(computeItemization(base()).a.amount.state).toBe("unknown");
  });

  it("flags a staff value that differs from Form 1 instead of replacing either", () => {
    const d = staff(base(), { "ric.item.e": "1,900.00" });
    expect(formatAmount(computeItemization(d).e.amount)).toBe("$1,900.00");
    expect(reconcileRetailInstallment(d).map((i) => i.id)).toContain("bos-e");
    expect(reconcileRetailInstallment(base()).map((i) => i.id)).not.toContain("bos-e");
  });

  it("flags a service contract price that differs from row m", () => {
    const d = staff(base(), {
      "ric.svc.selected": true,
      "ric.svc.price": "1,000.00",
      "ric.item.m": "900.00",
    });
    expect(reconcileRetailInstallment(d).map((i) => i.id)).toContain("svc-price");
  });

  it("optional products and acknowledgments start unselected", () => {
    const f = base().fields;
    for (const key of [
      "ric.svc.selected",
      "ric.gap.selected",
      "ric.otherProtection.selected",
      "ric.singleInterest",
      "ric.esignAck",
      "ric.thirdParty.included",
      "ric.addlCharge",
    ])
      expect(f[key]?.value).toBe(false);
    expect(f["ric.creditLife.coverage"]?.value).toBe("");
    expect(f["ric.creditDisability.coverage"]?.value).toBe("");
    expect(f["ric.gap.type"]?.value).toBe("");
  });
});

describe("payment schedule and APR (Regulation Z Appendix J)", () => {
  it("counts unit periods back from the payment date", () => {
    expect(periodsBetween("2026-01-01", "2026-02-16", "monthly")).toEqual({ t: 1, f: 0.5 });
    expect(periodsBetween("2026-01-15", "2026-02-15", "monthly")).toEqual({ t: 1, f: 0 });
    expect(periodsBetween("2026-01-01", "2026-01-20", "weekly")).toEqual({ t: 2, f: 5 / 7 });
  });

  it("regular monthly loan: $5,000, 36 × $166.07 → 12.00%", () => {
    const payments = Array.from({ length: 36 }, (_, k) => ({
      date: `${2026 + Math.floor((k + 1) / 12)}-${String(((k + 1) % 12) + 1).padStart(2, "0")}-15`,
      cents: 16_607,
    }));
    expect(actuarialApr(500_000, "2026-01-15", payments, "monthly")).toBeCloseTo(12, 1);
  });

  it("irregular (45-day) first period is handled, not ignored", () => {
    // Payment chosen so that i = 1%/month with t_k = k, f = 0.5 (hand-derived).
    const pv = Array.from({ length: 36 }, (_, k) => 1 / (1.005 * 1.01 ** (k + 1))).reduce(
      (a, b) => a + b,
    );
    const payment = Math.round(1_000_000 / pv);
    const d = staff(base(), { "deal.date": "2026-01-01" });
    const withRows = staff(allRows(d, { a: "10,000.00" }), {
      "ric.schedule.1.count": "36",
      "ric.schedule.1.amount": (payment / 100).toFixed(2),
      "ric.schedule.1.frequency": "monthly",
      "ric.schedule.1.firstDue": "2026-02-16",
    });
    const tila = computeDisclosures(withRows);
    expect(tila.status).toBe("draft");
    expect(tila.aprPercent).toBeCloseTo(12, 1);
    expect(tila.schedule[0]!.dueDates.at(-1)).toBe("2029-01-16");
    expect(tila.financeChargeCents).toBe(36 * payment - 1_000_000);
    expect(tila.totalOfPaymentsCents).toBe(36 * payment);
  });

  it("a deferred down payment is in Total of Payments but not the finance charge", () => {
    const d = staff(
      allRows(staff(base(), { "deal.date": "2026-01-01" }), {
        a: "10,000.00",
        e: "500.00",
        g: "500.00",
      }),
      {
        "ric.schedule.1.count": "1",
        "ric.schedule.1.amount": "500.00",
        "ric.schedule.1.frequency": "once",
        "ric.schedule.1.firstDue": "2026-01-20",
        "ric.schedule.1.kind": "deferred_down",
        "ric.schedule.2.count": "12",
        "ric.schedule.2.amount": "800.00",
        "ric.schedule.2.frequency": "monthly",
        "ric.schedule.2.firstDue": "2026-02-01",
      },
    );
    const t = computeDisclosures(d);
    expect(t.amountFinancedCents).toBe(900_000);
    expect(t.financeChargeCents).toBe(960_000 - 900_000);
    expect(t.totalOfPaymentsCents).toBe(960_000 + 50_000);
    expect(t.totalSalePriceCents).toBe(900_000 + 60_000 + 100_000);
    expect(t.aprPercent).toBeGreaterThan(12);
  });

  it("stays pending without approved terms and never invents figures", () => {
    const t = computeDisclosures(base());
    expect(t.status).toBe("pending");
    expect(t.aprPercent).toBeNull();
    expect(t.financeChargeCents).toBeNull();
    expect(t.reasons.join(" ")).toMatch(/payment schedule/);
  });

  it("validates started schedule rows", () => {
    const d = staff(base(), {
      "ric.schedule.1.count": "2",
      "ric.schedule.1.amount": "100.00",
      "ric.schedule.1.frequency": "once",
      "ric.schedule.1.firstDue": "2099-01-01",
      "ric.schedule.2.amount": "50.00",
    });
    const { rows, errors } = readSchedule(d);
    expect(rows).toHaveLength(0);
    expect(errors.join(" ")).toMatch(/exactly 1 payment/);
    expect(errors.join(" ")).toMatch(/row 2/);
  });

  it("approval is a separate staff flag", () => {
    const d = staff(allRows(staff(base(), { "deal.date": "2026-01-01" }), { a: "1,000.00" }), {
      "ric.schedule.1.count": "10",
      "ric.schedule.1.amount": "110.00",
      "ric.schedule.1.frequency": "monthly",
      "ric.schedule.1.firstDue": "2026-02-01",
      "ric.financingApproved": true,
    });
    expect(computeDisclosures(d).status).toBe("approved");
  });
});

describe("signature locations and the Third Party Owner", () => {
  const ids = (d: Deal) => signatureSlotsFor("retail_installment", d).map((s) => s.id);

  it("page 5 lines always apply; conditional lines only when their section applies", () => {
    expect(ids(base())).toEqual([
      "ric-p5-agree-buyer",
      "ric-p5-agree-cobuyer",
      "ric-p5-buyer",
      "ric-p5-cobuyer",
      "ric-p5-seller",
    ]);
    const d = staff(base(), {
      "ric.creditLife.coverage": "single",
      "ric.gap.selected": true,
      "ric.assign.assigneeName": "Example Assignee",
    });
    expect(ids(d)).toEqual(
      expect.arrayContaining(["ric-p2-ins-buyer", "ric-p3-prot-cobuyer", "ric-p5-assign-seller"]),
    );
    expect(signatureSlotsFor("retail_installment", d).every((s) => s.locationConfirmed)).toBe(true);
  });

  it("a Third Party Owner is separate from the Co-Buyer and signs only their own line", () => {
    expect(requiredSignerRoles(base())).not.toContain("third_party_owner");
    const d = staff(base(), {
      "ric.thirdParty.included": true,
      "ric.thirdParty.name": "Demo Owner",
    });
    expect(requiredSignerRoles(d)).toContain("third_party_owner");
    expect(signerIdentity(d, "third_party_owner").printedName).toBe("Demo Owner");
    const slots = signatureSlotsFor("retail_installment", d).filter(
      (s) => s.role === "third_party_owner",
    );
    expect(slots.map((s) => s.id)).toEqual(["ric-p4-third-party"]);
    const buyer = adoptDemoSignature({}, d, {
      role: "buyer",
      capture: { kind: "script", name: "Demo Buyer" },
      certified: true,
    });
    expect(buyer.ok && buyer.appliedTo.some((s) => s.role === "third_party_owner")).toBe(false);
    const wrongName = adoptDemoSignature({}, d, {
      role: "third_party_owner",
      capture: { kind: "script", name: "Demo Co-Buyer" },
      certified: true,
    });
    expect(wrongName.ok).toBe(false);
  });
});

describe("missing information", () => {
  it("lists what the contract still needs", () => {
    const m = retailInstallmentMissing(base());
    expect(m).toContain("Contract No. (issued by the server)");
    expect(m).toContain("Payment schedule");
    expect(m.some((x) => x.startsWith("Itemization rows"))).toBe(true);
  });
});

describe("Form 2 demo PDF", () => {
  it("has five watermarked pages and shows a signature only on its own signer's lines", () => {
    const d = base();
    const buyer = adoptDemoSignature({}, d, {
      role: "buyer",
      capture: { kind: "script", name: "Demo Buyer" },
      certified: true,
    });
    if (!buyer.ok) throw new Error(buyer.error);
    const pdf = buildDemoPdfPages(retailInstallmentDemoPages(d, buyer.signatures));
    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(5);
    expect(pdf).toContain(DEMO_WATERMARK);
    // Buyer lines on page 5: Signatures box and Notice to Buyer.
    expect(pdf.split(DEMO_SIGNATURE_TAG).length - 1).toBe(2);
    expect(pdf).toContain("Pending approved financing terms");
    expect(pdf).toContain("No Third Party Owner on this deal - N/A");
  });
});
