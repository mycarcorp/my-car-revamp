import { describe, expect, it } from "vitest";

import { applicableItems } from "./acknowledgments";
import { signatureSlotsFor } from "./contract-signatures";
import { editDealField, type Deal } from "./deal-model";
import {
  DELIVERY_STATEMENTS,
  deliveryRecordsMade,
  hasTradeIn,
  purchaserNames,
} from "./delivery-checklist";
import { buildDemoPdfPages, deliveryChecklistDemoPages, DEMO_WATERMARK } from "./demo-contract-pdf";
import {
  adoptDemoInitial,
  adoptDemoSignature,
  clearDemoInitial,
  initialKey,
  initialsProgress,
} from "./demo-signatures";
import { demoDeal } from "./lease-to-own-demo";

const base = () => demoDeal({ vehicleValueCents: 1_000_000, packageDownCents: 200_000 });
const staff = (d: Deal, values: Record<string, string | boolean>) =>
  Object.entries(values).reduce((acc, [k, v]) => {
    const r = editDealField(acc, k, v, "staff");
    if (r.error) throw new Error(`${k}: ${r.error}`);
    return r.deal;
  }, d);
const noTradeIn = () =>
  staff(base(), { "tradeIn1.year": "", "tradeIn1.make": "", "tradeIn1.model": "" });
const initial = (d: Deal, item: number, initials = "DB", current = {}) =>
  adoptDemoInitial(current, d, { contractId: "delivery_checklist", item, role: "buyer", initials });

describe("statements", () => {
  it("has nine statements in reference order", () => {
    expect(DELIVERY_STATEMENTS.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("the trade-in payoff statement applies only with a trade-in", () => {
    expect(hasTradeIn(base())).toBe(true);
    expect(applicableItems("delivery_checklist", base())).toHaveLength(9);
    const d = noTradeIn();
    expect(hasTradeIn(d)).toBe(false);
    expect(applicableItems("delivery_checklist", d).map((i) => i.number)).not.toContain(7);
    const r = initial(d, 7);
    expect(r.ok).toBe(false);
    expect(initialsProgress("delivery_checklist", d, {})).toEqual([
      { role: "buyer", done: 0, total: 8 },
    ]);
  });
});

describe("initials", () => {
  it("nothing starts acknowledged and a signature never initials a statement", () => {
    expect(initialsProgress("delivery_checklist", base(), {})[0]!.done).toBe(0);
    const sig = adoptDemoSignature({}, base(), {
      role: "buyer",
      capture: { kind: "script", name: "Demo Buyer" },
      certified: true,
    });
    if (!sig.ok) throw new Error(sig.error);
    expect(
      sig.appliedTo.filter((s) => s.contractId === "delivery_checklist").map((s) => s.id),
    ).toEqual(["dc-purchaser"]);
  });

  it("each statement is initialled on its own and can be cleared", () => {
    const one = initial(base(), 3);
    if (!one.ok) throw new Error(one.error);
    expect(Object.keys(one.initials)).toEqual([initialKey("delivery_checklist", 3, "buyer")]);
    expect(initialsProgress("delivery_checklist", base(), one.initials)[0]!.done).toBe(1);
    expect(clearDemoInitial(one.initials, "delivery_checklist", 3, "buyer")).toEqual({});
    expect(initial(base(), 3, "XX").ok).toBe(false);
  });

  it("Form 4 and Form 5 initials are kept apart", () => {
    const one = initial(base(), 1);
    if (!one.ok) throw new Error(one.error);
    expect(initialsProgress("gps_disclosure", base(), one.initials)[0]!.done).toBe(0);
  });

  it("the Co-Purchaser never initials with the Purchaser's initials", () => {
    expect(
      adoptDemoInitial({}, base(), {
        contractId: "delivery_checklist",
        item: 1,
        role: "co_buyer",
        initials: "DB",
      }).ok,
    ).toBe(false);
  });
});

describe("records, names and signatures", () => {
  it("document delivery is never inferred and is staff-only", () => {
    expect(deliveryRecordsMade(base())).toEqual({ done: 0, total: 5 });
    expect(
      editDealField(base(), "delivery.odometerDisclosureProvided", true, "customer").error,
    ).toMatch(/staff/);
    expect(
      deliveryRecordsMade(staff(base(), { "delivery.odometerDisclosureProvided": true })).done,
    ).toBe(1);
  });

  it("purchaser names come from the Buyer and Co-Buyer", () => {
    expect(purchaserNames(base())).toBe("Demo Buyer and Demo Co-Buyer");
    expect(purchaserNames({ ...base(), coBuyerIncluded: false })).toBe("Demo Buyer");
  });

  it("Purchaser, Co-Purchaser (when present) and the dealer representative sign", () => {
    const roles = (d: Deal) => signatureSlotsFor("delivery_checklist", d).map((s) => s.role);
    expect(roles(base())).toEqual(["buyer", "co_buyer", "dealer"]);
    expect(roles({ ...base(), coBuyerIncluded: false })).toEqual(["buyer", "dealer"]);
  });
});

describe("Form 5 demo PDF", () => {
  it("is one watermarked page, initials only where given, N/A without a trade-in", () => {
    const one = initial(noTradeIn(), 2);
    if (!one.ok) throw new Error(one.error);
    const pdf = buildDemoPdfPages(deliveryChecklistDemoPages(noTradeIn(), {}, one.initials));
    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(1);
    expect(pdf).toContain(DEMO_WATERMARK);
    expect(pdf.split("[DB]").length - 1).toBe(1);
    expect(pdf).toContain("[N/A]");
  });
});
