import { afterEach, describe, expect, it, vi } from "vitest";

const { importPKCS8, sign } = vi.hoisted(() => ({
	importPKCS8: vi.fn(async () => ({})),
	sign: vi.fn(async () => "test-assertion"),
}));

vi.mock("jose", () => ({
	importPKCS8,
	SignJWT: class {
		setProtectedHeader() { return this; }
		setIssuer() { return this; }
		setAudience() { return this; }
		setIssuedAt() { return this; }
		setExpirationTime() { return this; }
		sign() { return sign(); }
	},
}));

import { readGa4Report } from "./marketing-ga4.server";

describe("GA4 Worker REST reporting", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		importPKCS8.mockClear();
		sign.mockClear();
	});

	it("returns unavailable null metrics without credentials or network requests", async () => {
		vi.stubEnv("GA4_SERVICE_ACCOUNT_JSON", "");
		vi.stubEnv("GA4_PROPERTY_TIME_ZONE", "America/Los_Angeles");
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const report = await readGa4Report({ preset: 7 });

		expect(report).toMatchObject({
			status: "unavailable",
			message: "Google credentials are not configured for this server. Configure GA4_SERVICE_ACCOUNT_JSON.",
			startDate: expect.any(String),
			endDate: expect.any(String),
			metrics: null,
			generateLeadEvents: null,
		});
		expect(fetchMock).not.toHaveBeenCalled();
		expect(importPKCS8).not.toHaveBeenCalled();
	});

	it("rejects malformed credentials without disclosing private values or making requests", async () => {
		vi.stubEnv("GA4_SERVICE_ACCOUNT_JSON", JSON.stringify({
			type: "service_account",
			client_email: "private@example.invalid",
		}));
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const report = await readGa4Report({ preset: 7 });

		expect(report).toMatchObject({ status: "unavailable", metrics: null, generateLeadEvents: null });
		expect(report.message).not.toContain("private@example.invalid");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("uses read-only OAuth and submits the existing nine report definitions", async () => {
		vi.stubEnv("GA4_SERVICE_ACCOUNT_JSON", JSON.stringify({
			type: "service_account",
			client_email: "ga4-test@example.invalid",
			private_key: "test-private-key",
		}));
		const calls: Array<{ url: string; init: RequestInit }> = [];
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			calls.push({ url, init: init ?? {} });
			if (url === "https://oauth2.googleapis.com/token") {
				return Response.json({ access_token: "test-access-token", expires_in: 3600 });
			}
			return Response.json({});
		});
		vi.stubGlobal("fetch", fetchMock);

		const report = await readGa4Report({ preset: 7 });

		expect(report.status).toBe("available");
		expect(calls).toHaveLength(10);
		expect(calls[0]?.url).toBe("https://oauth2.googleapis.com/token");
		const tokenBody = new URLSearchParams(String(calls[0]?.init.body));
		expect(tokenBody.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
		expect(tokenBody.get("assertion")).toBe("test-assertion");
		expect(calls.slice(1).every(({ url }) => url === "https://analyticsdata.googleapis.com/v1beta/properties/559909149:runReport")).toBe(true);
		const payloads = calls.slice(1).map(({ init }) => JSON.parse(String(init.body)) as Record<string, unknown>);
		expect(payloads[0]).toMatchObject({
			dateRanges: [{ startDate: expect.any(String), endDate: expect.any(String) }],
			metrics: ["activeUsers", "totalUsers", "sessions", "engagedSessions", "engagementRate", "screenPageViews"].map((name) => ({ name })),
		});
		expect(payloads[4]).toMatchObject({
			dimensions: [{ name: "pagePath" }],
			dimensionFilter: { filter: { fieldName: "pagePath", stringFilter: { matchType: "BEGINS_WITH", value: "/inventory/" } } },
		});
		expect(payloads[7]).toMatchObject({
			metrics: [{ name: "eventCount" }],
			dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: "generate_lead" } } },
		});
		expect(calls.slice(1).every(({ init }) => new Headers(init.headers).get("authorization") === "Bearer test-access-token")).toBe(true);
		expect(calls.every(({ url, init }) => !url.includes("test-access-token") && !String(init.body).includes("test-access-token"))).toBe(true);
		expect(calls.every(({ url, init }) => !url.includes("test-private-key") && !String(init.body).includes("test-private-key"))).toBe(true);
	});

	it("maps REST permission and quota failures to unavailable reports", async () => {
		vi.stubEnv("GA4_SERVICE_ACCOUNT_JSON", JSON.stringify({
			type: "service_account",
			client_email: "ga4-permission-test@example.invalid",
			private_key: "test-private-key",
		}));
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			if (String(input) === "https://oauth2.googleapis.com/token") {
				return Response.json({ access_token: "test-access-token", expires_in: 3600 });
			}
			return Response.json({ error: { code: 403, status: "PERMISSION_DENIED", message: "private provider detail" } }, { status: 403 });
		}));

		const report = await readGa4Report({ preset: 7 });

		expect(report).toMatchObject({
			status: "unavailable",
			message: "GA4 access is not authorized. Grant the service account Viewer access to the Analytics property.",
			metrics: null,
			generateLeadEvents: null,
		});
		expect(report.message).not.toContain("private provider detail");
	});

	it("maps REST quota failures without exposing provider details", async () => {
		vi.stubEnv("GA4_SERVICE_ACCOUNT_JSON", JSON.stringify({
			type: "service_account",
			client_email: "ga4-quota-test@example.invalid",
			private_key: "test-private-key",
		}));
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			if (String(input) === "https://oauth2.googleapis.com/token") {
				return Response.json({ access_token: "test-quota-token", expires_in: 3600 });
			}
			return Response.json({ error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "private quota details" } }, { status: 429 });
		}));

		const report = await readGa4Report({ preset: 7 });

		expect(report).toMatchObject({
			status: "unavailable",
			message: "The Google Analytics reporting quota is temporarily exhausted. Try again later.",
			metrics: null,
			generateLeadEvents: null,
		});
		expect(report.message).not.toContain("private quota details");
	});
});