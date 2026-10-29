import { describe, expect, it } from "vitest";
import {
  EMPTY_APPLICANT,
  EMPTY_CONSENTS,
  LEASE_CONSENT_TYPES,
  REQUIRED_CONSENTS,
  applicantDocumentStatuses,
  coBuyerErrors,
  formatPhoneInput,
  isValidUsPhone,
  missingRequiredConsents,
  normalizeApplicantProfile,
  normalizeConsents,
  normalizePhone,
  parseMoney,
  validateApplicantProfile,
  validateTradeIn,
  validateVehiclePreferences,
  zipMatchesState,
  type ApplicantProfile,
  type LeaseDocStatus,
} from "./lease-to-own";
import { LEASE_CONSENT_WORDING, PREQUAL, consentWordingApproved } from "./lease-to-own-content";

const today = new Date("2026-10-28T12:00:00Z");
const valid: ApplicantProfile = {
  ...EMPTY_APPLICANT,
  firstName: "Jordan",
  lastName: "Sample",
  email: "jordan@example.com",
  cellPhone: "5405550100",
  dateOfBirth: "1990-05-01",
  driversLicenseNumber: "T12345678",
  driversLicenseState: "VA",
  street: "100 Example St",
  city: "Fredericksburg",
  state: "VA",
  zip: "22408",
  housingType: "rent",
  monthlyHousingPayment: "1250",
  employmentStatus: "Employed - Full-Time",
  employerName: "Example Co",
  jobTitle: "Technician",
  employerPhone: "5405550199",
  monthlyIncome: "4200",
  yearsAtJob: "3",
};
const noPrefs = { year: "", make: "", model: "", exteriorColor: "", interiorColor: "" };

describe("pre-qualification heading", () => {
  it("uses the owner's heading, flags it for review and drops the bank-network claim", () => {
    expect(PREQUAL.heading).toBe("GET PRE QUALIFIED — FOR ALL CREDIT TYPE");
    expect(PREQUAL.claims).toContain("prequalHeading");
    expect(PREQUAL.subheading).not.toMatch(/banks|pre-approved/i);
  });
});

describe("phones", () => {
  it("normalizes formatting and a leading country code", () => {
    expect(normalizePhone("+1 (540) 555-0100")).toBe("5405550100");
    expect(formatPhoneInput("15405550100")).toBe("(540) 555-0100");
    expect(isValidUsPhone("(540) 555-0100")).toBe(true);
    expect(isValidUsPhone("(140) 555-0100")).toBe(false);
    expect(isValidUsPhone("540555")).toBe(false);
  });

  it("home phone is optional but must be valid when given", () => {
    expect(validateApplicantProfile({ ...valid, homePhone: "" }, today).homePhone).toBeUndefined();
    expect(validateApplicantProfile({ ...valid, homePhone: "123" }, today).homePhone).toBeTruthy();
  });
});

describe("driver's license dates", () => {
  it("expiration can't precede issue; issue can't be in the future", () => {
    const errors = validateApplicantProfile(
      { ...valid, driversLicenseIssueDate: "2024-05-01", driversLicenseExpiryDate: "2023-05-01" },
      today,
    );
    expect(errors.driversLicenseExpiryDate).toMatch(/before the issue date/);
    expect(
      validateApplicantProfile({ ...valid, driversLicenseIssueDate: "2027-01-01" }, today)
        .driversLicenseIssueDate,
    ).toMatch(/future/);
    expect(
      validateApplicantProfile(
        { ...valid, driversLicenseIssueDate: "2020-01-01", driversLicenseExpiryDate: "2028-01-01" },
        today,
      ),
    ).toEqual({});
  });
});

describe("residence", () => {
  it("checks ZIP against state where prefixes are known", () => {
    expect(zipMatchesState("22408", "VA")).toBe(true);
    expect(zipMatchesState("20001", "DC")).toBe(true);
    expect(zipMatchesState("06390", "NY")).toBe(true);
    expect(zipMatchesState("10001", "VA")).toBe(false);
    expect(validateApplicantProfile({ ...valid, zip: "10001" }, today).zip).toMatch(
      /doesn't match/,
    );
  });

  it("requires previous address fields only when added", () => {
    expect(validateApplicantProfile({ ...valid, hasPreviousAddress: false }, today)).toEqual({});
    const errors = validateApplicantProfile({ ...valid, hasPreviousAddress: true }, today);
    expect(Object.keys(errors).sort()).toEqual(
      ["previousCity", "previousState", "previousStreet", "previousZip"].sort(),
    );
  });

  it("accepts $0 housing but not blank or text", () => {
    expect(parseMoney("0")).toBe(0);
    expect(parseMoney("$1,250.50")).toBe(1250.5);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });
});

describe("employment", () => {
  it("does not force employer details on retired or unemployed applicants", () => {
    const retired = {
      ...valid,
      employmentStatus: "SSI / Retired",
      employerName: "",
      jobTitle: "",
      employerPhone: "",
      yearsAtJob: "",
    };
    expect(validateApplicantProfile(retired, today)).toEqual({});
    expect(normalizeApplicantProfile({ ...retired, employerName: "Stale Co" }).employerName).toBe(
      "",
    );
  });

  it("requires employer details for employed applicants", () => {
    const errors = validateApplicantProfile(
      {
        ...valid,
        employerName: "",
        jobTitle: "",
        employerPhone: "",
        yearsAtJob: "",
        monthsAtJob: "14",
      },
      today,
    );
    expect(Object.keys(errors).sort()).toEqual(
      ["employerName", "employerPhone", "jobTitle", "monthsAtJob", "yearsAtJob"].sort(),
    );
  });
});

describe("Buyer and Co-Buyer stay separate", () => {
  it("requires the Co-Buyer's own email", () => {
    expect(coBuyerErrors(valid, { ...valid, email: "JORDAN@example.com" }).email).toMatch(
      /own email/,
    );
    expect(coBuyerErrors(valid, { ...valid, email: "alex@example.com" })).toEqual({});
  });
});

describe("consents", () => {
  it("start unchecked and count only literal true", () => {
    expect(Object.values(EMPTY_CONSENTS).every((v) => v === false)).toBe(true);
    expect(normalizeConsents({ marketing_sms: "true", credit_authorization: 1 })).toEqual(
      EMPTY_CONSENTS,
    );
    expect(normalizeConsents({ credit_authorization: true }).credit_authorization).toBe(true);
  });

  it("never requires marketing or account texts", () => {
    expect(REQUIRED_CONSENTS).not.toContain("marketing_sms");
    expect(REQUIRED_CONSENTS).not.toContain("transactional_sms");
    expect(
      missingRequiredConsents({
        ...EMPTY_CONSENTS,
        credit_authorization: true,
        application_certification: true,
      }),
    ).toEqual([]);
    expect(missingRequiredConsents({ ...EMPTY_CONSENTS, marketing_sms: true })).toEqual([
      "credit_authorization",
      "application_certification",
    ]);
  });

  it("every consent has versioned draft wording, so production submission stays blocked", () => {
    for (const type of LEASE_CONSENT_TYPES) {
      const wording = LEASE_CONSENT_WORDING[type];
      expect(wording.text.length).toBeGreaterThan(40);
      expect(wording.version).toMatch(/^draft-/);
      expect(wording.approved).toBe(false);
    }
    expect(consentWordingApproved()).toBe(false);
  });
});

describe("vehicle and trade-in", () => {
  it("validates optional preferences and trade-in details", () => {
    expect(validateVehiclePreferences(noPrefs, today)).toEqual({});
    expect(validateVehiclePreferences({ ...noPrefs, year: "20" }, today).year).toBeTruthy();
    expect(
      validateTradeIn(
        { year: "2015", make: "Honda", model: "Civic", mileage: "120000", payoff: "" },
        today,
      ),
    ).toEqual({});
    expect(
      Object.keys(
        validateTradeIn({ year: "", make: "", model: "", mileage: "", payoff: "x" }, today),
      ).sort(),
    ).toEqual(["make", "model", "payoff", "year"]);
  });
});

describe("documents per applicant", () => {
  const docs: Array<{
    doc_type: string;
    status: LeaseDocStatus;
    source: string;
    applicant_id: number | null;
  }> = [
    { doc_type: "paystub", status: "uploaded", source: "customer", applicant_id: 2 },
    { doc_type: "paystub", status: "under_review", source: "customer", applicant_id: 1 },
    { doc_type: "government_id", status: "uploaded", source: "customer", applicant_id: null },
    { doc_type: "bank_statement", status: "pending", source: "customer", applicant_id: 1 },
  ];

  it("keeps Buyer and Co-Buyer documents apart; the Buyer owns earlier unassigned rows", () => {
    expect(applicantDocumentStatuses(docs, 1, true)).toEqual({
      paystub: "under_review",
      government_id: "uploaded",
    });
    expect(applicantDocumentStatuses(docs, 2, false)).toEqual({ paystub: "uploaded" });
  });
});
