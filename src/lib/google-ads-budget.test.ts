import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALLOCATIONS, allocationTotals, buildScenario, comparisonProblem, SCENARIO_BUDGETS } from "./google-ads-budget";

const read = (path: string) => readFileSync(path, "utf8");

/* -------------------------------------------------------------------------- */

describe("Google Ads budget scenarios", () => {
  it("covers $300, $450 and $600 with daily averages", () => {
    expect(SCENARIO_BUDGETS).toEqual({ A: 300, B: 450, C: 600 });
    expect(buildScenario("A").dailyAverage).toBe(9.87);
    expect(buildScenario("B").dailyAverage).toBe(14.8);
    expect(buildScenario("C").dailyAverage).toBe(19.74);
  });

  it("allocations add up to the whole budget in every scenario", () => {
    for (const key of ["A", "B", "C"] as const) {
      const plan = buildScenario(key);
      expect(allocationTotals(plan).share).toBe(1);
      expect(Math.abs(allocationTotals(plan).monthly - plan.monthly)).toBeLessThanOrEqual(0.03);
      expect(ALLOCATIONS[key][0]!.name).toBe("High-intent local search");
    }
  });

  it("rejects a non-positive budget and contains no forecast numbers", () => {
    expect(() => buildScenario("A", 0)).toThrow();
    expect(() => buildScenario("A", Number.NaN)).toThrow();
    expect(read("src/lib/google-ads-budget.ts")).not.toMatch(/cpc\s*[:=]\s*\d|conversionRate\s*[:=]\s*\d|expectedLeads/i);
  });

  it("refuses to compare figures with different periods or lead definitions", () => {
    const a = { start: "2026-03-01", end: "2026-03-31", leadDefinition: "Meta lead form" };
    expect(comparisonProblem(a, a)).toBeNull();
    expect(comparisonProblem(a, { ...a, end: "2026-04-30" })).toMatch(/date ranges/);
    expect(comparisonProblem(a, { ...a, leadDefinition: "Website form" })).toMatch(/define a lead/);
  });
});

/* -------------------------------------------------------------------------- */
/* Gallery video                                                               */
