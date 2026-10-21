import { describe, expect, it } from "vitest";
import {
	ga4RangeSchema,
	mapGa4Reports,
	resolveGa4Range,
	safeGa4ErrorMessage,
	unavailableGa4Report,
} from "./ga4-reporting";

describe("GA4 report mapping", () => {
	it("maps aggregate metrics, dimensions, timezone, range, and event count", () => {
		const report = mapGa4Reports({
			startDate: "2026-10-01", endDate: "2026-10-07", fetchedAt: "2026-10-08T00:00:00.000Z",
			metrics: { rows: [{ metricValues: ["10", "12", "15", "8", "0.5333", "40"].map((value) => ({ value })) }], metadata: { timeZone: "America/New_York" } },
			trafficChannels: { rows: [{ dimensionValues: [{ value: "Organic Search" }], metricValues: [{ value: "7" }, { value: "6" }] }] },
			landingPages: { rows: [{ dimensionValues: [{ value: "/inventory" }], metricValues: [{ value: "5" }, { value: "4" }] }] },
			deviceCategories: { rows: [{ dimensionValues: [{ value: "mobile" }], metricValues: [{ value: "9" }, { value: "8" }] }] },
			daily: { rows: [{ dimensionValues: [{ value: "20261001" }], metricValues: [{ value: "10" }, { value: "15" }, { value: "40" }] }] },
			generateLeadEvents: { rows: [{ metricValues: [{ value: "3" }] }] },
		});
		expect(report).toMatchObject({
			status: "available", propertyId: "559909149", timeZone: "America/New_York",
			metrics: { activeUsers: 10, totalUsers: 12, sessions: 15, engagedSessions: 8, engagementRate: 0.5333, screenPageViews: 40 },
			trafficChannels: [{ label: "Organic Search", sessions: 7, activeUsers: 6 }],
			landingPages: [{ label: "/inventory", sessions: 5, activeUsers: 4 }],
			deviceCategories: [{ label: "mobile", sessions: 9, activeUsers: 8 }],
			daily: [{ date: "20261001", activeUsers: 10, sessions: 15, screenPageViews: 40 }],
			generateLeadEvents: 3,
			startDate: "2026-10-01", endDate: "2026-10-07", fetchedAt: "2026-10-08T00:00:00.000Z",
		});
	});

	it("rejects impossible, reversed, future, and oversized date ranges", () => {
		const now = new Date("2026-10-21T12:00:00.000Z");
		expect(() => resolveGa4Range({ startDate: "2026-02-30", endDate: "2026-03-01" }, now)).toThrow();
		expect(() => resolveGa4Range({ startDate: "2026-10-10", endDate: "2026-10-09" }, now)).toThrow();
		expect(() => resolveGa4Range({ startDate: "2026-10-21", endDate: "2026-10-22" }, now)).toThrow();
		expect(() => resolveGa4Range({ startDate: "2026-01-01", endDate: "2026-04-01" }, now)).toThrow();
		expect(ga4RangeSchema.safeParse({ preset: 30, startDate: "2026-01-01" }).success).toBe(false);
	});

	it("preserves empty GA4 responses as real empty data and failures as unavailable nulls", () => {
		const empty = mapGa4Reports({
			startDate: "2026-10-01", endDate: "2026-10-07", fetchedAt: "2026-10-08T00:00:00.000Z",
			metrics: {}, trafficChannels: {}, landingPages: {}, deviceCategories: {}, daily: {}, generateLeadEvents: {},
		});
		expect(empty.status).toBe("available");
		expect(empty.metrics?.sessions).toBe(0);
		expect(empty.trafficChannels).toEqual([]);
		expect(empty.generateLeadEvents).toBe(0);
		const failed = unavailableGa4Report({ startDate: "2026-10-01", endDate: "2026-10-07" }, "Google Analytics is temporarily unavailable.");
		expect(failed.status).toBe("unavailable");
		expect(failed.metrics).toBeNull();
		expect(failed.generateLeadEvents).toBeNull();
	});

	it("sanitizes authentication, permission, quota, property, timeout, and provider failures", () => {
		expect(safeGa4ErrorMessage({ message: "Could not load the default credentials from C:\\private\\secret.json" })).toContain("credentials are not configured");
		expect(safeGa4ErrorMessage({ code: 16, message: "token-secret" })).toContain("authentication failed");
		expect(safeGa4ErrorMessage({ code: 7, message: "internal detail" })).toContain("not authorized");
		expect(safeGa4ErrorMessage({ code: 8, message: "quota internals" })).toContain("quota is temporarily exhausted");
		expect(safeGa4ErrorMessage({ code: 3, message: "Invalid property 000000000" })).toContain("property was not found or is invalid");
		expect(safeGa4ErrorMessage({ name: "TimeoutError", message: "request exceeded deadline" })).toContain("temporarily unavailable");
		expect(safeGa4ErrorMessage({ message: "secret internal stack and credentials" })).not.toContain("secret");
	});
});