import { describe, expect, it } from "vitest";
import {
	ga4RangeSchema,
	mapGa4Reports,
	resolveGa4IntegrationStatus,
	resolveGa4Range,
	sanitizeGa4PagePath,
	safeGa4ErrorMessage,
	unavailableGa4Report,
} from "./ga4-reporting";

describe("GA4 report mapping", () => {
	it("maps aggregate metrics, dimensions, timezone, range, and event count", () => {
		const report = mapGa4Reports({
			startDate: "2026-10-01", endDate: "2026-10-07", fetchedAt: "2026-10-08T00:00:00.000Z",
			metrics: { rows: [{ metricValues: ["10", "12", "15", "8", "0.5333", "40"].map((value) => ({ value })) }], metadata: { timeZone: "America/New_York" } },
			trafficChannels: { rows: [{ dimensionValues: [{ value: "Organic Search" }], metricValues: [{ value: "7" }, { value: "6" }] }] },
			trafficSources: { rows: [{ dimensionValues: [{ value: "google / organic" }], metricValues: [{ value: "6" }, { value: "5" }] }] },
			landingPages: { rows: [{ dimensionValues: [{ value: "/inventory?email=private@example.com" }], metricValues: ["5", "4", "12", "3", "0.6"].map((value) => ({ value })) }] },
			vehiclePages: { rows: [{ dimensionValues: [{ value: "/inventory/used-car" }], metricValues: ["3", "2", "7", "1", "0.33"].map((value) => ({ value })) }] },
			deviceCategories: { rows: [{ dimensionValues: [{ value: "mobile" }], metricValues: [{ value: "9" }, { value: "8" }] }] },
			daily: { rows: [{ dimensionValues: [{ value: "20261001" }], metricValues: [{ value: "10" }, { value: "15" }, { value: "40" }] }] },
			generateLeadDaily: { rows: [{ dimensionValues: [{ value: "20261001" }], metricValues: [{ value: "2" }] }] },
			generateLeadEvents: { rows: [{ metricValues: [{ value: "3" }] }] },
		});
		expect(report).toMatchObject({
			status: "available", propertyId: "559909149", timeZone: "America/New_York",
			metrics: { activeUsers: 10, totalUsers: 12, sessions: 15, engagedSessions: 8, engagementRate: 0.5333, screenPageViews: 40 },
			trafficChannels: [{ label: "Organic Search", sessions: 7, activeUsers: 6 }],
			trafficSources: [{ label: "google / organic", sessions: 6, activeUsers: 5 }],
			landingPages: [{ label: "/inventory", sessions: 5, activeUsers: 4, pageViews: 12, engagedSessions: 3, engagementRate: 0.6 }],
			vehiclePages: [{ label: "/inventory/used-car", sessions: 3, activeUsers: 2, pageViews: 7, engagedSessions: 1, engagementRate: 0.33 }],
			deviceCategories: [{ label: "mobile", sessions: 9, activeUsers: 8 }],
			daily: [{ date: "20261001", activeUsers: 10, sessions: 15, screenPageViews: 40 }],
			generateLeadDaily: [{ date: "20261001", eventCount: 2 }],
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
		expect(empty.vehiclePages).toEqual([]);
		expect(empty.generateLeadDaily).toEqual([]);
		expect(resolveGa4IntegrationStatus(empty)).toBe("No Data Yet");
		const failed = unavailableGa4Report({ startDate: "2026-10-01", endDate: "2026-10-07" }, "Google Analytics is temporarily unavailable.");
		expect(failed.status).toBe("unavailable");
		expect(failed.metrics).toBeNull();
		expect(failed.generateLeadEvents).toBeNull();
	});

	it("removes query strings and redacts VIN-like path segments", () => {
		expect(sanitizeGa4PagePath("https://mycarcorp.com/inventory/1HGCM82633A004352?email=private%40example.com&token=secret#details"))
			.toBe("/inventory/[vehicle]");
		expect(sanitizeGa4PagePath("/inventory/search?q=customer name&vin=1HGCM82633A004352"))
			.toBe("/inventory/search");
		expect(sanitizeGa4PagePath("/account/private@example.com/555-123-4567/550e8400-e29b-41d4-a716-446655440000"))
			.toBe("/account/[redacted]/[redacted]/[redacted]");
	});

	it("classifies connected, empty, unavailable, and request-error states", () => {
		const available = mapGa4Reports({
			startDate: "2026-10-01", endDate: "2026-10-07", fetchedAt: "2026-10-08T00:00:00.000Z",
			metrics: { rows: [{ metricValues: ["1", "2", "3", "1", "0.3", "5"].map((value) => ({ value })) }] },
			trafficChannels: {}, landingPages: {}, deviceCategories: {}, daily: {}, generateLeadEvents: {},
		});
		expect(resolveGa4IntegrationStatus(available)).toBe("Connected");
		expect(resolveGa4IntegrationStatus(unavailableGa4Report({ startDate: "2026-10-01", endDate: "2026-10-07" }, "GA4 access is not authorized."))).toBe("Permission Denied");
		expect(resolveGa4IntegrationStatus(unavailableGa4Report({ startDate: "2026-10-01", endDate: "2026-10-07" }, "Google credentials are not configured."))).toBe("Missing Credentials");
		expect(resolveGa4IntegrationStatus(unavailableGa4Report({ startDate: "2026-10-01", endDate: "2026-10-07" }, "quota is temporarily exhausted"))).toBe("Quota Exceeded");
		expect(resolveGa4IntegrationStatus(unavailableGa4Report({ startDate: "2026-10-01", endDate: "2026-10-07" }, "Google Analytics is temporarily unavailable."))).toBe("Temporary API Error");
		expect(resolveGa4IntegrationStatus(unavailableGa4Report({ startDate: "2026-10-01", endDate: "2026-10-07" }, "GA4 is not configured."))).toBe("Not Configured");
		expect(resolveGa4IntegrationStatus(null, new Error("network error"))).toBe("Temporary API Error");
	});

	it("uses the configured property timezone for preset calendar days", () => {
		const now = new Date("2026-10-22T02:00:00.000Z");
		expect(resolveGa4Range({ preset: 7 }, now, "America/Los_Angeles"))
			.toEqual({ startDate: "2026-10-15", endDate: "2026-10-21" });
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