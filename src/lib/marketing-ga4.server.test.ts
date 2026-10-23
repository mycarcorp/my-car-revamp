import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { diagnoseGa4Runtime, readGa4Realtime, readGa4Report } from "./marketing-ga4.server";

describe("GA4 Worker REST reporting", () => {
	beforeEach(() => {
		vi.stubEnv("GA4_OAUTH_CLIENT_ID", "");
		vi.stubEnv("GA4_OAUTH_CLIENT_SECRET", "");
		vi.stubEnv("GA4_OAUTH_REFRESH_TOKEN", "");
		vi.stubEnv("GA4_SERVICE_ACCOUNT_JSON", "");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		importPKCS8.mockClear();
		sign.mockClear();
	});

	it("returns unavailable null metrics without credentials or network requests", async () => {
		vi.stubEnv("GA4_SERVICE_ACCOUNT_JSON", "");
		vi.stubEnv("GA4_OAUTH_CLIENT_ID", "");
		vi.stubEnv("GA4_OAUTH_CLIENT_SECRET", "");
		vi.stubEnv("GA4_OAUTH_REFRESH_TOKEN", "");
		vi.stubEnv("GA4_PROPERTY_TIME_ZONE", "America/Los_Angeles");
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const report = await readGa4Report({ preset: 7 });

		expect(report).toMatchObject({
			status: "unavailable",
			message: "Google credentials are not configured for this server. Configure GA4 OAuth refresh-token credentials or GA4_SERVICE_ACCOUNT_JSON.",
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

	it("rejects partially configured OAuth credentials without falling back to service-account credentials", async () => {
		vi.stubEnv("GA4_OAUTH_CLIENT_ID", "partial-client-id");
		vi.stubEnv("GA4_OAUTH_CLIENT_SECRET", "");
		vi.stubEnv("GA4_OAUTH_REFRESH_TOKEN", "");
		vi.stubEnv("GA4_SERVICE_ACCOUNT_JSON", JSON.stringify({
			type: "service_account",
			client_email: "fallback@example.invalid",
			private_key: "test-private-key",
		}));
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const report = await readGa4Report({ preset: 7 });

		expect(report).toMatchObject({ status: "unavailable", metrics: null });
		expect(report.message).toContain("credentials are invalid");
		expect(fetchMock).not.toHaveBeenCalled();
		expect(importPKCS8).not.toHaveBeenCalled();
	});

	it("reports only presence booleans for missing and partial runtime configuration", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		vi.stubEnv("GA4_PROPERTY_TIME_ZONE", "");

		const missing = await diagnoseGa4Runtime();
		expect(missing).toEqual({
			oauthCredentialsPresent: { clientId: false, clientSecret: false, refreshToken: false },
			serviceAccountConfigured: false,
			authenticationMode: "none",
			tokenExchangeAttempted: false,
			googleHttpStatus: null,
			errorCategory: "missing_credentials",
			propertyTimeZoneAvailable: false,
		});

		vi.stubEnv("GA4_OAUTH_CLIENT_ID", "synthetic-client-id");
		const partial = await diagnoseGa4Runtime();
		expect(partial).toMatchObject({
			oauthCredentialsPresent: { clientId: true, clientSecret: false, refreshToken: false },
			authenticationMode: "partial_oauth",
			tokenExchangeAttempted: false,
			googleHttpStatus: null,
			errorCategory: "partial_oauth_credentials",
			propertyTimeZoneAvailable: false,
		});
		expect(JSON.stringify([missing, partial])).not.toContain("synthetic-client-id");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("classifies Google invalid_client errors without exposing provider text or credentials", async () => {
		vi.stubEnv("GA4_OAUTH_CLIENT_ID", "synthetic-client-id");
		vi.stubEnv("GA4_OAUTH_CLIENT_SECRET", "synthetic-client-secret");
		vi.stubEnv("GA4_OAUTH_REFRESH_TOKEN", "synthetic-refresh-token");
		vi.stubEnv("GA4_PROPERTY_TIME_ZONE", "America/Los_Angeles");
		vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "invalid_client", error_description: "synthetic private detail" }, { status: 401 })));

		const diagnostics = await diagnoseGa4Runtime();

		expect(diagnostics).toMatchObject({
			oauthCredentialsPresent: { clientId: true, clientSecret: true, refreshToken: true },
			authenticationMode: "oauth",
			tokenExchangeAttempted: true,
			googleHttpStatus: 401,
			errorCategory: "invalid_client",
			propertyTimeZoneAvailable: true,
		});
		const serialized = JSON.stringify(diagnostics);
		expect(serialized).not.toContain("synthetic-client-id");
		expect(serialized).not.toContain("synthetic-client-secret");
		expect(serialized).not.toContain("synthetic-refresh-token");
		expect(serialized).not.toContain("synthetic private detail");
	});

	it("classifies Google invalid_grant responses as sanitized diagnostics", async () => {
		vi.stubEnv("GA4_OAUTH_CLIENT_ID", "grant-client-id");
		vi.stubEnv("GA4_OAUTH_CLIENT_SECRET", "grant-client-secret");
		vi.stubEnv("GA4_OAUTH_REFRESH_TOKEN", "grant-refresh-token");
		vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "invalid_grant", error_description: "synthetic grant detail" }, { status: 400 })));

		const diagnostics = await diagnoseGa4Runtime();

		expect(diagnostics).toMatchObject({
			authenticationMode: "oauth",
			tokenExchangeAttempted: true,
			googleHttpStatus: 400,
			errorCategory: "invalid_grant",
		});
		expect(JSON.stringify(diagnostics)).not.toContain("grant-refresh-token");
		expect(JSON.stringify(diagnostics)).not.toContain("synthetic grant detail");
	});

	it("exchanges a fresh token after the OAuth client secret changes", async () => {
		vi.stubEnv("GA4_OAUTH_CLIENT_ID", "cache-rotation-client");
		vi.stubEnv("GA4_OAUTH_CLIENT_SECRET", "first-synthetic-secret");
		vi.stubEnv("GA4_OAUTH_REFRESH_TOKEN", "cache-rotation-refresh");
		let tokenNumber = 0;
		const calls: Array<{ url: string; init: RequestInit }> = [];
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			calls.push({ url, init: init ?? {} });
			if (url === "https://oauth2.googleapis.com/token") {
				tokenNumber += 1;
				return Response.json({ access_token: `cache-test-token-${tokenNumber}`, expires_in: 3600 });
			}
			return Response.json({});
		}));

		await readGa4Report({ preset: 7 });
		vi.stubEnv("GA4_OAUTH_CLIENT_SECRET", "second-synthetic-secret");
		await readGa4Report({ preset: 7 });

		const tokenCalls = calls.filter(({ url }) => url === "https://oauth2.googleapis.com/token");
		expect(tokenCalls).toHaveLength(2);
		expect(calls.filter(({ url }) => url.includes(":runReport"))).toHaveLength(20);
		expect(calls.slice(1, 11).every(({ init }) => new Headers(init.headers).get("authorization") === "Bearer cache-test-token-1")).toBe(true);
		expect(calls.slice(12).every(({ init }) => new Headers(init.headers).get("authorization") === "Bearer cache-test-token-2")).toBe(true);
	});

	it("exchanges server-only refresh-token credentials and submits all ten reports", async () => {
		vi.stubEnv("GA4_OAUTH_CLIENT_ID", "oauth-client-id-test");
		vi.stubEnv("GA4_OAUTH_CLIENT_SECRET", "oauth-client-secret-test");
		vi.stubEnv("GA4_OAUTH_REFRESH_TOKEN", "oauth-refresh-token-test");
		const calls: Array<{ url: string; init: RequestInit }> = [];
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			calls.push({ url, init: init ?? {} });
			if (url === "https://oauth2.googleapis.com/token") {
				return Response.json({ access_token: "oauth-test-access-token", expires_in: 3600 });
			}
			return Response.json({});
		});
		vi.stubGlobal("fetch", fetchMock);

		const report = await readGa4Report({ preset: 7 });

		expect(report.status).toBe("available");
		expect(calls).toHaveLength(11);
		expect(calls[0]?.url).toBe("https://oauth2.googleapis.com/token");
		expect(calls[0]?.init.method).toBe("POST");
		expect(new Headers(calls[0]?.init.headers).get("content-type")).toBe("application/x-www-form-urlencoded");
		const tokenBody = new URLSearchParams(String(calls[0]?.init.body));
		expect(Object.fromEntries(tokenBody)).toEqual({
			client_id: "oauth-client-id-test",
			client_secret: "oauth-client-secret-test",
			refresh_token: "oauth-refresh-token-test",
			grant_type: "refresh_token",
		});
		expect(calls.slice(1).every(({ init }) => new Headers(init.headers).get("authorization") === "Bearer oauth-test-access-token")).toBe(true);
		expect(calls.every(({ url, init }) => !url.includes("oauth-client-secret-test") && !url.includes("oauth-refresh-token-test") && !String(init.body).includes("oauth-test-access-token"))).toBe(true);
		expect(importPKCS8).not.toHaveBeenCalled();
	});

	it("sanitizes revoked refresh-token failures", async () => {
		vi.stubEnv("GA4_OAUTH_CLIENT_ID", "revoked-client-id");
		vi.stubEnv("GA4_OAUTH_CLIENT_SECRET", "revoked-client-secret");
		vi.stubEnv("GA4_OAUTH_REFRESH_TOKEN", "revoked-refresh-token");
		vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "invalid_grant", error_description: "private revoked token detail" }, { status: 400 })));

		const report = await readGa4Report({ preset: 7 });

		expect(report).toMatchObject({ status: "unavailable", metrics: null, generateLeadEvents: null });
		expect(report.message).toBe("Google authentication failed. Check server credentials.");
		expect(report.message).not.toContain("private revoked token detail");
		expect(report.message).not.toContain("revoked-refresh-token");
	});

	it("uses read-only OAuth and submits the existing report definitions plus event counts", async () => {
		vi.stubEnv("GA4_PROPERTY_TIME_ZONE", "America/Los_Angeles");
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

		expect(report).toMatchObject({ status: "available", timeZone: "America/Los_Angeles" });
		expect(calls).toHaveLength(11);
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
		expect(payloads[9]).toMatchObject({
			metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
			dimensions: [{ name: "eventName" }],
			dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: [
				"page_view", "view_item_list", "select_item", "view_item", "search",
				"appointment_type_selected", "appointment_vehicle_selected", "form_start", "generate_lead",
			] } } },
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
			message: "GA4 access is not authorized. Grant the configured Google identity Viewer access to the Analytics property.",
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

	describe("independent historical sections", () => {
		function stubCredentials() {
			vi.stubEnv("GA4_SERVICE_ACCOUNT_JSON", JSON.stringify({
				type: "service_account",
				client_email: "ga4-partial-test@example.invalid",
				private_key: "test-private-key",
			}));
		}
		const isToken = (input: RequestInfo | URL) => String(input) === "https://oauth2.googleapis.com/token";
		const tokenResponse = () => Response.json({ access_token: "partial-test-token", expires_in: 3600 });

		it("keeps successful sections and reports a safe warning when one query fails", async () => {
			stubCredentials();
			vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				if (isToken(input)) return tokenResponse();
				const body = JSON.parse(String(init?.body)) as { dimensions: Array<{ name: string }> };
				if (body.dimensions[0]?.name === "deviceCategory") {
					return Response.json({ error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "private quota details" } }, { status: 429 });
				}
				if (body.dimensions[0]?.name === "eventName") {
					return Response.json({ rows: [{ dimensionValues: [{ value: "page_view" }], metricValues: [{ value: "42" }, { value: "9" }] }], metadata: { timeZone: "America/New_York" } });
				}
				return Response.json({ metadata: { timeZone: "America/New_York" } });
			}));

			const report = await readGa4Report({ preset: 7 });

			expect(report.status).toBe("available");
			expect(report.deviceCategories).toBeNull();
			expect(report.sectionErrors.deviceCategories).toBe("The Google Analytics reporting quota is temporarily exhausted. Try again later.");
			expect(Object.keys(report.sectionErrors)).toEqual(["deviceCategories"]);
			expect(report.metrics).not.toBeNull();
			expect(report.trafficChannels).toEqual([]);
			expect(report.events?.find((row) => row.eventName === "page_view")).toEqual({ eventName: "page_view", eventCount: 42, totalUsers: 9 });
			expect(report.timeZone).toBe("America/New_York");
			expect(report.timeZoneSource).toBe("property");
			expect(JSON.stringify(report)).not.toContain("private quota details");
		});

		it("returns unavailable only when every historical query fails", async () => {
			stubCredentials();
			vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
				if (isToken(input)) return tokenResponse();
				return Response.json({ error: { code: 403, status: "PERMISSION_DENIED", message: "private" } }, { status: 403 });
			}));
			const report = await readGa4Report({ preset: 30 });
			expect(report.status).toBe("unavailable");
			expect(report.message).toContain("not authorized");
			expect(report.sectionErrors).toEqual({});
		});

		it("applies one identical date range to every historical query", async () => {
			stubCredentials();
			const ranges: unknown[] = [];
			vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				if (isToken(input)) return tokenResponse();
				ranges.push((JSON.parse(String(init?.body)) as { dateRanges: unknown }).dateRanges);
				return Response.json({});
			}));

			await readGa4Report({ preset: 30 });
			expect(ranges).toHaveLength(10);
			expect(new Set(ranges.map((range) => JSON.stringify(range)))).toEqual(new Set([JSON.stringify([{ startDate: "29daysAgo", endDate: "today" }])]));

			ranges.length = 0;
			await readGa4Report({ startDate: "2026-09-01", endDate: "2026-09-30" });
			expect(ranges).toHaveLength(10);
			expect(new Set(ranges.map((range) => JSON.stringify(range)))).toEqual(new Set([JSON.stringify([{ startDate: "2026-09-01", endDate: "2026-09-30" }])]));
		});

		it("never reads customer data: report bodies carry only aggregate metrics and the tracked event names", async () => {
			stubCredentials();
			const bodies: string[] = [];
			vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				if (isToken(input)) return tokenResponse();
				bodies.push(String(init?.body));
				return Response.json({});
			}));
			await readGa4Report({ preset: 7 });
			expect(bodies.join("")).not.toMatch(/email|phone|ssn|userId|customUser/i);
		});
	});

	describe("GA4 Realtime reporting", () => {
		function stubCredentials() {
			vi.stubEnv("GA4_SERVICE_ACCOUNT_JSON", JSON.stringify({
				type: "service_account",
				client_email: "ga4-realtime-test@example.invalid",
				private_key: "test-private-key",
			}));
		}
		const isToken = (input: RequestInfo | URL) => String(input) === "https://oauth2.googleapis.com/token";

		it("reads active users and recent tracked events from runRealtimeReport", async () => {
			stubCredentials();
			const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
			vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				if (isToken(input)) return Response.json({ access_token: "realtime-token", expires_in: 3600 });
				const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
				calls.push({ url: String(input), body });
				const dimensions = body["dimensions"] as Array<{ name: string }>;
				if (dimensions.length === 0) return Response.json({ rows: [{ metricValues: [{ value: "4" }] }] });
				return Response.json({ rows: [
					{ dimensionValues: [{ value: "page_view" }], metricValues: [{ value: "11" }] },
					{ dimensionValues: [{ value: "view_item" }], metricValues: [{ value: "3" }] },
				] });
			}));

			const report = await readGa4Realtime();

			expect(report).toMatchObject({ status: "available", windowMinutes: 30, activeUsers: 4, sectionErrors: {} });
			expect(report.events?.map((row) => [row.eventName, row.eventCount])).toEqual([
				["page_view", 11], ["view_item_list", 0], ["select_item", 0], ["view_item", 3], ["search", 0],
				["appointment_type_selected", 0], ["appointment_vehicle_selected", 0], ["form_start", 0], ["generate_lead", 0],
			]);
			expect(calls).toHaveLength(2);
			expect(calls.every(({ url }) => url === "https://analyticsdata.googleapis.com/v1beta/properties/559909149:runRealtimeReport")).toBe(true);
			expect(calls.every(({ body }) => !("dateRanges" in body))).toBe(true);
		});

		it("reports zero active users when GA4 returns no realtime rows", async () => {
			stubCredentials();
			vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => isToken(input)
				? Response.json({ access_token: "realtime-token-empty", expires_in: 3600 })
				: Response.json({})));
			const report = await readGa4Realtime();
			expect(report.status).toBe("available");
			expect(report.activeUsers).toBe(0);
			expect(report.events?.every((row) => row.eventCount === 0)).toBe(true);
		});

		it("keeps the working realtime section when the other fails", async () => {
			stubCredentials();
			vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				if (isToken(input)) return Response.json({ access_token: "realtime-token-partial", expires_in: 3600 });
				const body = JSON.parse(String(init?.body)) as { dimensions: unknown[] };
				return body.dimensions.length === 0
					? Response.json({ rows: [{ metricValues: [{ value: "2" }] }] })
					: Response.json({ error: { code: 500, status: "UNAVAILABLE", message: "private" } }, { status: 503 });
			}));
			const report = await readGa4Realtime();
			expect(report).toMatchObject({ status: "available", activeUsers: 2, events: null });
			expect(report.sectionErrors.events).toContain("temporarily unavailable");
		});

		it("returns a sanitized unavailable report for Realtime API errors", async () => {
			stubCredentials();
			vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => isToken(input)
				? Response.json({ access_token: "realtime-token-denied", expires_in: 3600 })
				: Response.json({ error: { code: 403, status: "PERMISSION_DENIED", message: "private provider detail" } }, { status: 403 })));
			const report = await readGa4Realtime();
			expect(report).toMatchObject({ status: "unavailable", activeUsers: null, events: null });
			expect(report.message).toContain("not authorized");
			expect(report.message).not.toContain("private provider detail");
		});

		it("does not call Google without credentials", async () => {
			const fetchMock = vi.fn();
			vi.stubGlobal("fetch", fetchMock);
			const report = await readGa4Realtime();
			expect(report.status).toBe("unavailable");
			expect(report.message).toContain("credentials are not configured");
			expect(fetchMock).not.toHaveBeenCalled();
		});
	});
});