import { describe, expect, it } from "vitest";
import {
  BILL_OF_SALE_LINES,
  BILL_OF_SALE_LAYOUT,
  computeBillOfSale,
  initialSignatureRecords,
} from "./bill-of-sale";
import { CONTRACT_FIELD_MAPS, prefillForContract } from "./contract-field-maps";
import {
  buildDealFromApplication,
  editDealField,
  mergeSharedValues,
  missingRequiredFields,
  type Deal,
  type DealSource,
} from "./deal-model";
import { formatCents, parseCents, sumCents } from "./money";

const source: DealSource = {
  applicationId: 41,
  appNumber: "LTO-000041",
  buyer: {
    applicantId: 7,
    firstName: "Pat",
    lastName: "Example",
    email: "pat@example.com",
    phone: "5550100100",
    street: "1 Test Way",
    city: "Testville",
    state: "VA",
    zip: "22401",
  },
  coBuyer: {
    applicantId: 8,
    firstName: "Alex",
    lastName: "Sample",
    email: "alex@example.com",
    phone: "5550100101",
    street: "2 Other Rd",
    city: "Elsewhere",
    state: "VA",
    zip: "22408",
  },
  vehicle: {
    stockNumber: "STK-1",
    vin: "TESTVIN0000000001",
    year: "2019",
    make: "Testmake",
    model: "Testmodel",
    bodyStyle: "SUV",
    mileage: "61000",
    color: "Blue",
    condition: "used",
    priceCents: 1_249_900,
  },
  tradeIn: { year: "2010", make: "Old", model: "Car", mileage: "150000", payoffCents: 50_000 },
  packageDownCents: 250_000,
  insuranceDocument: { status: "uploaded", documentId: 3 },
  dealer: {
    legalName: "My Car Business Services LLC",
    street: "4720 Harrison Rd",
    city: "Fredericksburg",
    state: "VA",
    zip: "22408",
    phone: "(540) 426-3322",
  },
  date: "2026-10-29",
};

const staffSet = (deal: Deal, entries: Record<string, string>) =>
  Object.entries(entries).reduce((d, [k, v]) => editDealField(d, k, v, "staff").deal, deal);

describe("money in integer cents", () => {
  it("parses and formats without floating-point drift", () => {
    expect(parseCents("$12,499.00")).toBe(1_249_900);
    expect(parseCents("0.1")).toBe(10);
    expect(parseCents("abc")).toBeNull();
    expect(formatCents(sumCents([10, 20])!)).toBe("0.30");
    expect(formatCents(-100_000)).toBe("-1,000.00");
  });
});

describe("prefill from the existing application", () => {
  const deal = buildDealFromApplication(source);

  it("maps Buyer, Co-Buyer, inventory vehicle, trade-in and package values with their sources", () => {
    expect(deal.fields["buyer.firstName"]).toMatchObject({
      value: "Pat",
      source: "application",
      verified: false,
    });
    expect(deal.fields["vehicle.vin"]).toMatchObject({
      value: "TESTVIN0000000001",
      source: "inventory",
      verified: true,
    });
    expect(deal.fields["deal.stockNumber"]?.value).toBe("STK-1");
    expect(deal.fields["line.1"]).toMatchObject({
      value: 1_249_900,
      source: "inventory",
      verified: false,
    });
    expect(deal.fields["line.28"]).toMatchObject({ value: 250_000, source: "package" });
    expect(deal.fields["tradeIn1.make"]?.value).toBe("Old");
    expect(deal.fields["line.26"]?.value).toBe(50_000);
    expect(deal.fields["tradeIn2.make"]?.value).toBe("");
  });

  it("keeps the Co-Buyer separate from the Buyer", () => {
    expect(deal.fields["coBuyer.firstName"]?.value).toBe("Alex");
    expect(deal.fields["coBuyer.street"]?.value).toBe("2 Other Rd");
    expect(deal.fields["buyer.street"]?.value).toBe("1 Test Way");
    const solo = buildDealFromApplication({ ...source, coBuyer: null });
    expect(solo.fields["coBuyer.firstName"]?.value).toBe("");
    expect(missingRequiredFields(solo).some((k) => k.startsWith("coBuyer."))).toBe(false);
  });

  it("never marks insurance verified from an upload alone, and invents no fees", () => {
    expect(deal.fields["insurance.status"]).toMatchObject({
      value: "provided_unverified",
      verified: false,
    });
    for (const n of [2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16])
      expect(deal.fields[`line.${n}`]?.value).toBeNull();
  });

  it("lists missing required fields", () => {
    const missing = missingRequiredFields(deal);
    expect(missing).toEqual(
      expect.arrayContaining([
        "dealer.salesperson",
        "deal.contractNumber",
        "dealer.authorizedSigner",
      ]),
    );
    expect(missing).not.toContain("buyer.firstName");
  });
});

describe("itemization lines 1–31", () => {
  it("has all 31 numbered lines in reference order with 7 calculated lines", () => {
    expect(BILL_OF_SALE_LINES.map((l) => l.number)).toEqual(
      Array.from({ length: 31 }, (_, i) => i + 1),
    );
    expect(BILL_OF_SALE_LINES.filter((l) => l.kind === "calc").map((l) => l.number)).toEqual([
      3, 15, 23, 24, 27, 30, 31,
    ]);
  });

  it("computes every total exactly", () => {
    const deal = staffSet(buildDealFromApplication(source), {
      "line.2": "524.96",
      "line.5": "42.75",
      "line.7": "799.00",
      "line.10": "15.00",
      "line.16": "58.30",
      "line.17": "2,200.00",
      "line.25": "1,000.00",
      "line.26": "500.00",
      "line.29": "0.10",
    });
    const v = computeBillOfSale(deal).byNumber;
    expect(v[3]).toBe(1_249_900 + 52_496);
    expect(v[15]).toBe(4_275 + 79_900 + 1_500);
    expect(v[23]).toBe(5_830 + 220_000);
    expect(v[24]).toBe(v[3]! + v[15]! + v[23]!);
    expect(v[27]).toBe(50_000);
    expect(v[30]).toBe(50_000 + 250_000 + 10);
    expect(v[31]).toBe(v[24]! - v[30]!);
  });

  it("shows N/A rather than inventing values, and reports negative equity", () => {
    const empty = computeBillOfSale(
      buildDealFromApplication({ ...source, vehicle: null, tradeIn: null, packageDownCents: null }),
    );
    expect(empty.byNumber[15]).toBeNull();
    expect(empty.byNumber[31]).toBeNull();
    const upside = staffSet(buildDealFromApplication(source), {
      "line.25": "100.00",
      "line.26": "400.00",
    });
    expect(computeBillOfSale(upside).negativeEquityCents).toBe(30_000);
  });

  it("uses approved configurable labels for lines 13, 14 and 17–22", () => {
    const deal = staffSet(buildDealFromApplication(source), {
      "lineLabel.17": "Approved Product A",
    });
    expect(computeBillOfSale(deal).lines.find((l) => l.number === 17)?.label).toBe(
      "Approved Product A",
    );
  });
});

describe("editing rules", () => {
  const deal = buildDealFromApplication(source);

  it("customers cannot edit any contract field; calculated lines are never editable", () => {
    expect(editDealField(deal, "line.1", "1.00", "customer").error).toMatch(/authorized staff/);
    expect(editDealField(deal, "line.31", "1.00", "staff").error).toMatch(/Unknown field/);
    expect(editDealField(deal, "line.24", "1.00", "staff").error).toMatch(/Unknown field/);
  });

  it("staff edits record provenance and recalculate", () => {
    const next = editDealField(deal, "line.1", "11,000.00", "staff");
    expect(next.error).toBeUndefined();
    expect(next.deal.fields["line.1"]).toMatchObject({
      value: 1_100_000,
      source: "staff",
      edited: true,
    });
    expect(computeBillOfSale(next.deal).byNumber[3]).toBe(1_100_000);
    expect(editDealField(deal, "line.2", "-5", "staff").error).toMatch(/negative/);
    expect(editDealField(deal, "line.2", "twelve", "staff").error).toMatch(/amount/);
  });

  it("locked financial terms need a staff review", () => {
    const locked = { ...deal, financialsLocked: true };
    expect(editDealField(locked, "line.1", "1.00", "staff").error).toMatch(/locked/);
    expect(editDealField(locked, "vehicle.licenseNumber", "ABC123", "staff").error).toBeUndefined();
  });

  it("shared updates never silently overwrite staff-edited values", () => {
    const edited = editDealField(deal, "buyer.street", "9 Corrected St", "staff").deal;
    const { deal: merged, conflicts } = mergeSharedValues(edited, {
      "buyer.street": { value: "1 Test Way Apt 2", source: "application" },
      "buyer.city": { value: "Newtown", source: "application" },
    });
    expect(merged.fields["buyer.street"]?.value).toBe("9 Corrected St");
    expect(conflicts).toEqual([
      { key: "buyer.street", current: "9 Corrected St", incoming: "1 Test Way Apt 2" },
    ]);
    expect(merged.fields["buyer.city"]?.value).toBe("Newtown");
  });
});

describe("reuse by later forms", () => {
  const deal = buildDealFromApplication(source);

  it("Forms 2–10 read the same Buyer and vehicle values; Co-Buyer stays separate", () => {
    const retail = prefillForContract("retail_installment", deal);
    expect(retail["buyer_name"]?.value).toBe("Pat Example");
    expect(retail["co_buyer_name"]?.value).toBe("Alex Sample");
    expect(retail["vehicle_vin"]).toMatchObject({ value: "TESTVIN0000000001", verified: true });
    expect(prefillForContract("delivery_checklist", deal)["stock_no"]?.value).toBe("STK-1");
    const solo = prefillForContract(
      "retail_installment",
      buildDealFromApplication({ ...source, coBuyer: null }),
    );
    expect(solo).not.toHaveProperty("co_buyer_name");
  });

  it("does not map financial terms to other forms until their rules are approved", () => {
    for (const [id, map] of Object.entries(CONTRACT_FIELD_MAPS))
      if (id !== "bill_of_sale")
        expect(
          Object.values(map).some((m) => "dealKey" in m && m.dealKey.startsWith("line.")),
        ).toBe(false);
  });
});

describe("pages and signatures", () => {
  it("maps all three pages and flags legal text as approved-template-only", () => {
    expect(BILL_OF_SALE_LAYOUT.map((p) => p.page)).toEqual([1, 2, 3]);
    expect(BILL_OF_SALE_LAYOUT[1]!.sections.every((s) => s.legalTextRequired)).toBe(true);
  });

  it("creates separate, unsigned signature records per signer", () => {
    const records = initialSignatureRecords(buildDealFromApplication(source));
    expect(records.map((r) => r.role)).toEqual([
      "buyer",
      "co_buyer",
      "buyer",
      "co_buyer",
      "dealer",
    ]);
    expect(records.every((r) => r.status === "not_ready" && r.signedAt === null)).toBe(true);
    expect(
      initialSignatureRecords(buildDealFromApplication({ ...source, coBuyer: null })).map(
        (r) => r.role,
      ),
    ).toEqual(["buyer", "buyer", "dealer"]);
  });
});
