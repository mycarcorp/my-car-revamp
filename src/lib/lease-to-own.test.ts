import { describe, expect, it } from "vitest";
import {
  EMPTY_APPLICANT,
  TITLE_BUYOUT,
  ageOn,
  buildComparisonSeries,
  clampVehicleValue,
  documentsReadyForSigning,
  estimatePackage,
  estimatePayoffDate,
  isValidTaxpayerId,
  licenseNumberError,
  normalizeApplicantProfile,
  ssnTestMockError,
  normalizeLicenseNumber,
  US_STATES,
  rideshareSpend,
  validateApplicantProfile,
  validateDocumentFile,
} from "./lease-to-own";
import { AGREEMENTS, agreementDraft } from "./lease-to-own-content";

describe("rideshare simulator", () => {
  it("matches the reference example: $28/day → $840/month → $10,080/year", () => {
    const spend = rideshareSpend(28);
    expect(spend.monthly).toBe(840);
    expect(spend.yearly).toBe(10080);
    expect(spend.fourteenMonth).toBe(11760);
  });

  it("clamps the daily amount to the $10–$70 slider range", () => {
    expect(rideshareSpend(5).daily).toBe(10);
    expect(rideshareSpend(500).daily).toBe(70);
  });
});

describe("package estimates (reference assumptions)", () => {
  it("reproduces the reference formulas at the $10,000 example", () => {
    expect(estimatePackage("premier-monthly", 10000)).toMatchObject({
      downPayment: 3000,
      payment: 650,
      installments: 14,
    });
    expect(estimatePackage("payday-flex", 10000)).toMatchObject({
      downPayment: 2000,
      payment: 440,
      installments: 24,
    });
    expect(estimatePackage("weekly-express", 10000)).toMatchObject({
      downPayment: 1000,
      payment: 263,
      installments: 48,
    });
  });

  it("keeps the $1,000 minimum down payment on Weekly Express", () => {
    expect(estimatePackage("weekly-express", 6000).downPayment).toBe(1000);
  });

  it("includes the title buyout in the total cost", () => {
    const e = estimatePackage("payday-flex", 10000);
    expect(e.totalCost).toBe(e.downPayment + e.payment * e.installments + TITLE_BUYOUT);
  });

  it("snaps vehicle values to the $500 slider steps within $6,000–$25,000", () => {
    expect(clampVehicleValue(12345)).toBe(12500);
    expect(clampVehicleValue(1000)).toBe(6000);
    expect(clampVehicleValue("nope")).toBe(10000);
  });
});

describe("comparison chart series", () => {
  it("derives every point from inputs and nets remaining obligations out of equity", () => {
    const estimate = estimatePackage("weekly-express", 10000);
    const series = buildComparisonSeries(28, estimate);
    expect(series).toHaveLength(15);
    expect(series[0]).toMatchObject({ month: 0, rideshareSpent: 0, ownershipPaid: 1000 });
    expect(series[0]!.estimatedEquity).toBe(10000 - (48 * estimate.payment + TITLE_BUYOUT));
    expect(series[14]!.rideshareSpent).toBe(11760);
    // Fully paid by month 14 on a weekly 48-installment schedule.
    expect(series[14]!.remainingObligation).toBe(0);
    expect(series[14]!.estimatedEquity).toBe(series[14]!.vehicleValue);
    expect(series[14]!.vehicleValue).toBeLessThan(10000);
  });
});

describe("applicant validation", () => {
  const today = new Date("2026-10-24T12:00:00Z");
  const valid = {
    ...EMPTY_APPLICANT,
    firstName: "Jordan",
    lastName: "Sample",
    email: "jordan@example.com",
    cellPhone: "(540) 555-0100",
    dateOfBirth: "1990-05-01",
    driversLicenseNumber: "T12345678",
    driversLicenseState: "VA",
    street: "100 Example St",
    city: "Fredericksburg",
    state: "VA",
    zip: "22408",
    housingType: "rent",
    monthlyHousingPayment: "1,250",
    employmentStatus: "Employed - Full-Time",
    employerName: "Example Co",
    jobTitle: "Technician",
    employerPhone: "540-555-0199",
    monthlyIncome: "4200",
    yearsAtJob: "3",
  };

  it("accepts a complete application", () => {
    expect(validateApplicantProfile(valid, today)).toEqual({});
  });

  it("flags every required field when empty", () => {
    const errors = validateApplicantProfile(EMPTY_APPLICANT, today);
    expect(Object.keys(errors).sort()).toEqual(
      [
        "firstName",
        "lastName",
        "email",
        "cellPhone",
        "dateOfBirth",
        "driversLicenseNumber",
        "driversLicenseState",
        "street",
        "city",
        "state",
        "zip",
        "housingType",
        "monthlyHousingPayment",
        "employmentStatus",
        "monthlyIncome",
      ].sort(),
    );
  });

  it("rejects minors, future and invalid dates of birth", () => {
    expect(ageOn("2010-01-01", today)).toBe(16);
    expect(ageOn("1990-02-31", today)).toBeNull();
    expect(
      validateApplicantProfile({ ...valid, dateOfBirth: "2010-01-01" }, today).dateOfBirth,
    ).toMatch(/18/);
    expect(
      validateApplicantProfile({ ...valid, dateOfBirth: "2027-01-01" }, today).dateOfBirth,
    ).toMatch(/future/);
  });

  it("validates SSN and ITIN formats", () => {
    expect(isValidTaxpayerId("000-12-3456")).toBe(false);
    expect(isValidTaxpayerId("666-12-3456")).toBe(false);
    expect(isValidTaxpayerId("912-70-1234")).toBe(true);
    expect(isValidTaxpayerId("912-40-1234")).toBe(false);
  });
});

describe("documents", () => {
  it("restricts file types and size", () => {
    expect(validateDocumentFile({ type: "application/pdf", size: 1000 })).toBeNull();
    expect(validateDocumentFile({ type: "application/zip", size: 1000 })).toBeTruthy();
    expect(validateDocumentFile({ type: "image/png", size: 11 * 1024 * 1024 })).toBeTruthy();
  });

  it("blocks signing until all five documents are on file and none is rejected", () => {
    const all = {
      government_id: "uploaded",
      paystub: "under_review",
      bank_statement: "verified",
      insurance_declaration: "uploaded",
      ach_authorization: "uploaded",
    } as const;
    expect(documentsReadyForSigning(all)).toBe(true);
    expect(documentsReadyForSigning({ ...all, paystub: "rejected" })).toBe(false);
    const { ach_authorization: _omit, ...missing } = all;
    expect(documentsReadyForSigning(missing)).toBe(false);
  });
});

describe("agreements and payoff", () => {
  it("fills every draft with the customer's package values and no reference customer data", () => {
    const estimate = estimatePackage("payday-flex", 10000);
    for (const doc of AGREEMENTS) {
      const text = JSON.stringify(
        agreementDraft(doc.key, {
          customerName: "Pat Example",
          customerAddress: "1 Main St",
          vehicleTitle: null,
          vehicleVin: null,
          estimate,
        }),
      );
      expect(text).toContain("Pat Example");
      // No hardcoded vehicle, VIN or bank routing number: only the supplied context appears.
      expect(text).toContain("Vehicle to be assigned by My Car");
      expect(text).not.toMatch(/\b[A-HJ-NPR-Z0-9]{17}\b|\b\d{9}\b/);
    }
  });

  it("estimates the payoff date from the next payment", () => {
    expect(estimatePayoffDate("2026-11-06", 3, "biweekly")).toBe("2026-12-04");
    expect(estimatePayoffDate("2026-11-01", 2, "monthly")).toBe("2026-12-01");
    expect(estimatePayoffDate(null, 3, "weekly")).toBeNull();
  });
});

describe("driver's license number", () => {
  it("accepts differing state formats without assuming one national pattern", () => {
    for (const value of [
      "T12345678",
      "123456789",
      "A1234567",
      "S530-1234-5678",
      "a1 234 567",
      "WDL1234567890",
      "K12",
    ])
      expect(licenseNumberError(value)).toBeNull();
  });

  it("rejects empty, symbol, letters-only and over-long values with specific messages", () => {
    expect(licenseNumberError("")).toMatch(/Enter your driver's license number/);
    expect(licenseNumberError("AB#123")).toMatch(/letters and numbers only/);
    expect(licenseNumberError("ABCDEFG")).toMatch(/at least one digit/);
    expect(licenseNumberError("1".repeat(21))).toMatch(/2–20 characters/);
    expect(licenseNumberError("7")).toMatch(/2–20 characters/);
  });

  it("normalizes spaces, dashes and case before storage", () => {
    expect(normalizeLicenseNumber("s530-1234 5678")).toBe("S53012345678");
  });

  it("keeps license number and issuing state as separate, separately validated fields", () => {
    const errors = validateApplicantProfile({
      ...EMPTY_APPLICANT,
      driversLicenseNumber: "T12345678",
    });
    expect(errors.driversLicenseNumber).toBeUndefined();
    expect(errors.driversLicenseState).toBeTruthy();
    expect(US_STATES).toContain("DC");
    expect(US_STATES).toHaveLength(51);
  });
});

describe("SSN / ITIN is never part of the ordinary application", () => {
  it("drops any ssn sent with application input, so it cannot be stored", () => {
    const normalized = normalizeApplicantProfile({
      firstName: "  Pat   Ann ",
      ssn: "987-65-4320",
      taxpayerId: "987654320",
      driversLicenseNumber: "t12-345 678",
    });
    expect(Object.keys(normalized)).not.toContain("ssn");
    expect(Object.keys(normalized)).not.toContain("taxpayerId");
    expect(JSON.stringify(normalized)).not.toMatch(/98765432/);
    expect(normalized.firstName).toBe("Pat Ann");
    expect(normalized.driversLicenseNumber).toBe("T12345678");
  });

  it("does not require an SSN to validate the rest of the form", () => {
    expect(validateApplicantProfile(EMPTY_APPLICANT)).not.toHaveProperty("ssn");
  });

  it("test-only mock accepts only the SSA-reserved fictional range", () => {
    expect(ssnTestMockError("987-65-4320")).toBeNull();
    expect(ssnTestMockError("987654329")).toBeNull();
    expect(ssnTestMockError("123-45-6789")).toMatch(/fictional numbers/);
    expect(ssnTestMockError("666-12-3456")).toMatch(/valid SSN or ITIN/);
    expect(ssnTestMockError("98765")).toMatch(/9 digits/);
    expect(ssnTestMockError("")).toMatch(/fictional test number/);
  });

  it("mock error messages never echo the typed number", () => {
    for (const v of ["123-45-6789", "666-12-3456", "98765"]) {
      const message = ssnTestMockError(v) ?? "";
      expect(message).not.toContain(v);
      expect(message.replace(/\D/g, "")).not.toContain(v.replace(/\D/g, ""));
    }
  });
});
