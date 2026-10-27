// Google Ads budget scenarios for management review. Arithmetic only: no cost-per-click, conversion rate or lead
// forecast is included because no Google Ads data exists in this application.

export const SCENARIO_BUDGETS = { A: 300, B: 450, C: 600 } as const;
export type ScenarioKey = keyof typeof SCENARIO_BUDGETS;

/** Google Ads may spend up to twice the daily budget on a day, but not more than the monthly limit (daily x 30.4). */
export const AVERAGE_DAYS_PER_MONTH = 30.4;

export type CampaignSlice = { name: string; purpose: string; share: number };

/** Priority order and shares are proposals for discussion, not forecasts. Shares add to 1 in each scenario. */
export const ALLOCATIONS: Record<ScenarioKey, CampaignSlice[]> = {
  A: [
    { name: "High-intent local search", purpose: "People searching to buy or sell a used car near Fredericksburg", share: 0.8 },
    { name: "Brand search", purpose: "People searching for My Car by name", share: 0.2 },
  ],
  B: [
    { name: "High-intent local search", purpose: "People searching to buy or sell a used car near Fredericksburg", share: 0.65 },
    { name: "Sell / trade search", purpose: "People looking to sell or trade a vehicle", share: 0.2 },
    { name: "Brand search", purpose: "People searching for My Car by name", share: 0.15 },
  ],
  C: [
    { name: "High-intent local search", purpose: "People searching to buy or sell a used car near Fredericksburg", share: 0.5 },
    { name: "Sell / trade search", purpose: "People looking to sell or trade a vehicle", share: 0.2 },
    { name: "Brand search", purpose: "People searching for My Car by name", share: 0.1 },
    { name: "Test and learn reserve", purpose: "Held for what the first weeks show, decided with management", share: 0.2 },
  ],
};

export type ScenarioPlan = {
  key: ScenarioKey;
  monthly: number;
  dailyAverage: number;
  slices: Array<CampaignSlice & { monthly: number; dailyAverage: number }>;
};

const cents = (n: number) => Math.round(n * 100) / 100;

export function buildScenario(key: ScenarioKey, monthlyOverride?: number): ScenarioPlan {
  const monthly = monthlyOverride ?? SCENARIO_BUDGETS[key];
  if (!Number.isFinite(monthly) || monthly <= 0) throw new Error("The monthly budget must be a positive number.");
  return {
    key,
    monthly,
    dailyAverage: cents(monthly / AVERAGE_DAYS_PER_MONTH),
    slices: ALLOCATIONS[key].map((s) => ({ ...s, monthly: cents(monthly * s.share), dailyAverage: cents((monthly * s.share) / AVERAGE_DAYS_PER_MONTH) })),
  };
}

export function allocationTotals(plan: ScenarioPlan): { monthly: number; share: number } {
  return { monthly: cents(plan.slices.reduce((n, s) => n + s.monthly, 0)), share: cents(plan.slices.reduce((n, s) => n + s.share, 0)) };
}

/**
 * Two figures are comparable only if they describe the same period and the same definition of a lead. Returns the
 * reason when they are not, so a Meta-versus-Google comparison is refused rather than made misleadingly.
 */
export function comparisonProblem(
  a: { start: string; end: string; leadDefinition: string },
  b: { start: string; end: string; leadDefinition: string },
): string | null {
  if (a.start !== b.start || a.end !== b.end) return "The two figures cover different date ranges.";
  if (a.leadDefinition.trim().toLowerCase() !== b.leadDefinition.trim().toLowerCase()) return "The two figures define a lead differently.";
  return null;
}
