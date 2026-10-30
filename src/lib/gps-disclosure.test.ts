import { describe, expect, it } from "vitest";

import { signatureSlotsFor } from "./contract-signatures";
import { editDealField, type Deal } from "./deal-model";
import { buildDemoPdfPages, DEMO_WATERMARK, gpsDisclosureDemoPages } from "./demo-contract-pdf";
import {
  adoptDemoInitial,
  adoptDemoSignature,
  clearDemoInitial,
  initialsProgress,
  initialKey,
} from "./demo-signatures";
import {
  GPS_PROVISIONS,
  gpsCreditorName,
  gpsDeviceState,
  gpsDisclosureIssues,
} from "./gps-disclosure";
import { demoDeal } from "./lease-to-own-demo";

const base = () => demoDeal({ vehicleValueCents: 1_000_000, packageDownCents: 200_000 });
const staff = (d: Deal, values: Record<string, string>) =>
  Object.entries(values).reduce((acc, [k, v]) => {
    const r = editDealField(acc, k, v, "staff");
    if (r.error) throw new Error(`${k}: ${r.error}`);
    return r.deal;
  }, d);
const now = new Date("2026-10-30T15:00:00Z");

describe("provisions", () => {
  it("has eight numbered provisions in order, with 4 spanning both pages once", () => {
    expect(GPS_PROVISIONS.map((p) => p.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(GPS_PROVISIONS.filter((p) => p.pages.includes(1)).map((p) => p.number)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(GPS_PROVISIONS.filter((p) => p.pages.includes(2)).map((p) => p.number)).toEqual([
      4, 5, 6, 7, 8,
    ]);
    expect(GPS_PROVISIONS.filter((p) => p.number === 4)).toHaveLength(1);
    expect(GPS_PROVISIONS.filter((p) => p.legalReview).map((p) => p.number)).toEqual([2, 3, 4]);
  });
});

describe("device assignment", () => {
  it("stays not assigned until an ID exists, and verified only when staff verify it", () => {
    expect(gpsDeviceState(base())).toBe("not_assigned");
    const withId = staff(base(), { "gps.deviceId": "DEMO-GPS-0001" });
    expect(gpsDeviceState(withId)).toBe("pending_verification");
    expect(gpsDeviceState(staff(withId, { "gps.deviceStatus": "verified" }))).toBe("verified");
    expect(gpsDeviceState(staff(base(), { "gps.deviceStatus": "verified" }))).toBe("not_assigned");
    expect(
      gpsDisclosureIssues(staff(base(), { "gps.deviceStatus": "verified" })).map((i) => i.id),
    ).toContain("verified-without-id");
    expect(editDealField(base(), "gps.deviceId", "X", "customer").error).toMatch(/staff/);
  });

  it("names the dealer as creditor unless staff set a different controller", () => {
    expect(gpsCreditorName(base())).toBe("My Car Business Services LLC");
    expect(gpsCreditorName(staff(base(), { "gps.controller": "Example Servicer" }))).toBe(
      "Example Servicer",
    );
  });
});

describe("provision initials", () => {
  it("start empty and are never filled by adopting a signature", () => {
    const sig = adoptDemoSignature({}, base(), {
      role: "buyer",
      capture: { kind: "script", name: "Demo Buyer" },
      certified: true,
    });
    if (!sig.ok) throw new Error(sig.error);
    expect(sig.appliedTo.filter((s) => s.contractId === "gps_disclosure").map((s) => s.id)).toEqual(
      ["gps-p2-borrower"],
    );
    expect(initialsProgress("gps_disclosure", base(), {})).toEqual([
      { role: "buyer", done: 0, total: 8 },
    ]);
  });

  it("each provision is initialled on its own, with the signer's own initials", () => {
    const d = base();
    const one = adoptDemoInitial({}, d, {
      contractId: "gps_disclosure",
      item: 1,
      role: "buyer",
      initials: "db",
      now,
    });
    if (!one.ok) throw new Error(one.error);
    expect(one.initials[initialKey("gps_disclosure", 1, "buyer")]).toMatchObject({
      initials: "DB",
      at: now.toISOString(),
    });
    expect(one.initials[initialKey("gps_disclosure", 2, "buyer")]).toBeUndefined();
    expect(initialsProgress("gps_disclosure", d, one.initials)[0]!.done).toBe(1);
    expect(
      adoptDemoInitial({}, d, {
        contractId: "gps_disclosure",
        item: 2,
        role: "buyer",
        initials: "XY",
      }).ok,
    ).toBe(false);
    expect(
      adoptDemoInitial({}, d, {
        contractId: "gps_disclosure",
        item: 2,
        role: "buyer",
        initials: " ",
      }).ok,
    ).toBe(false);
    expect(
      adoptDemoInitial({}, d, {
        contractId: "gps_disclosure",
        item: 9,
        role: "buyer",
        initials: "DB",
      }).ok,
    ).toBe(false);
    expect(clearDemoInitial(one.initials, "gps_disclosure", 1, "buyer")).toEqual({});
  });

  it("the Co-Borrower's initials are never taken from the Borrower", () => {
    const r = adoptDemoInitial({}, base(), {
      contractId: "gps_disclosure",
      item: 1,
      role: "co_buyer",
      initials: "DCB",
    });
    expect(r.ok).toBe(false);
  });
});

describe("signatures", () => {
  it("Borrower always; Co-Borrower only with a Co-Buyer on the deal", () => {
    const ids = (d: Deal) => signatureSlotsFor("gps_disclosure", d).map((s) => s.id);
    expect(ids(base())).toEqual(["gps-p2-borrower", "gps-p2-coborrower"]);
    expect(ids({ ...base(), coBuyerIncluded: false })).toEqual(["gps-p2-borrower"]);
    expect(signatureSlotsFor("gps_disclosure", base()).every((s) => s.locationConfirmed)).toBe(
      true,
    );
  });
});

describe("Form 4 demo PDF", () => {
  it("has two watermarked pages, shows initials only where given and no invented device", () => {
    const one = adoptDemoInitial({}, base(), {
      contractId: "gps_disclosure",
      item: 3,
      role: "buyer",
      initials: "DB",
    });
    if (!one.ok) throw new Error(one.error);
    const pdf = buildDemoPdfPages(gpsDisclosureDemoPages(base(), {}, one.initials));
    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(2);
    expect(pdf).toContain(DEMO_WATERMARK);
    expect(pdf).toContain("GPS Device Not Assigned");
    expect(pdf.split("[DB]").length - 1).toBe(1);
    expect(pdf.split("continued").length - 1).toBe(1);
  });
});
