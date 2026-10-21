import { afterEach, describe, expect, it, vi } from "vitest";

const { constructorOptions, constructorFallback, runReport, fallbackModule } = vi.hoisted(() => ({
	constructorOptions: vi.fn(),
	constructorFallback: vi.fn(),
	runReport: vi.fn(),
	fallbackModule: { transport: "rest-fallback" },
}));

vi.mock("@google-analytics/data", () => ({
	BetaAnalyticsDataClient: class {
		constructor(options: unknown, fallback: unknown) {
			constructorOptions(options);
			constructorFallback(fallback);
		}
		runReport(...args: unknown[]) {
			return runReport(...args);
		}
	},
}));

vi.mock("google-gax/fallback", () => ({ fallback: fallbackModule }));

import { readGa4Report } from "./marketing-ga4.server";

describe("GA4 server client edge configuration", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.clearAllMocks();
	});

	it("uses REST fallback and read-only scope, returning unavailable data without credentials", async () => {
		vi.stubEnv("GA4_SERVICE_ACCOUNT_JSON", "");
		vi.stubEnv("GA4_PROPERTY_TIME_ZONE", "America/Los_Angeles");
		runReport.mockRejectedValue(new Error("Could not load the default credentials."));

		const report = await readGa4Report({ preset: 7 });

		expect(constructorOptions).toHaveBeenCalledWith({
			scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
			fallback: true,
		});
		expect(constructorFallback).toHaveBeenCalledWith(fallbackModule);
		expect(report).toMatchObject({
			status: "unavailable",
			message: "Google credentials are not configured for the server. Configure Application Default Credentials or GA4_SERVICE_ACCOUNT_JSON.",
			startDate: expect.any(String),
			endDate: expect.any(String),
			metrics: null,
			generateLeadEvents: null,
		});
		expect(runReport).toHaveBeenCalled();
	});
});