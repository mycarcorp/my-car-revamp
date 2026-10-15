import { describe, expect, it } from "vitest";
import { canSubmit, isPurchaseStatus, isStepComplete, progressPercent } from "./purchase-flow";

const ready = {
  vehicle_id: "v1",
  full_name: "Jane Doe",
  email: "jane@example.com",
  phone: "5405551234",
  address: "1 Main St",
  zip: "22401",
  payment_method: "cash" as const,
  has_trade_in: false,
  status: "draft" as const,
};

describe("purchase flow", () => {
  it("cannot submit until vehicle, personal, payment and trade-in steps are done", () => {
    expect(canSubmit({ ...ready, has_trade_in: null })).toBe(false);
    expect(canSubmit(ready)).toBe(true);
  });

  it("outside financing requires a lender name", () => {
    expect(isStepComplete({ payment_method: "outside_financing" }, "payment")).toBe(false);
    expect(isStepComplete({ payment_method: "outside_financing", lender_name: "Navy FCU" }, "payment")).toBe(true);
  });

  it("a trade-in needs year/make/model and mileage", () => {
    expect(isStepComplete({ has_trade_in: true, trade_year_make_model: "2018 Honda CR-V" }, "trade")).toBe(false);
    expect(isStepComplete({ has_trade_in: true, trade_year_make_model: "2018 Honda CR-V", trade_mileage: 60000 }, "trade")).toBe(true);
  });

  it("progress is 80% when four of five steps are done and 100% after submit", () => {
    expect(progressPercent(ready)).toBe(80);
    expect(progressPercent({ ...ready, status: "submitted" as const, submitted_at: "2026-10-15" })).toBe(100);
  });

  it("only the eight known statuses are allowed", () => {
    expect(isPurchaseStatus("ready_for_delivery")).toBe(true);
    expect(isPurchaseStatus("paid")).toBe(false);
  });
});
