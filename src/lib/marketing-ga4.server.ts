import { importPKCS8, SignJWT } from "jose";
import {
	GA4_PROPERTY_ID,
	mapGa4Reports,
	resolveGa4Range,
	safeGa4ErrorMessage,
	unavailableGa4Report,
	type Ga4RangeInput,
	type Ga4Report,
} from "./ga4-reporting";

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REPORT_URL = `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`;
const REQUEST_TIMEOUT_MS = 20000;
const TOKEN_REFRESH_SKEW_MS = 60000;

type ServiceAccountCredentials = {
	type?: string;
	client_email?: string;
	private_key?: string;
};
type OAuthCredentials = { type: "oauth"; clientId: string; clientSecret: string; refreshToken: string };
type ConfiguredCredentials = { type: "service_account"; credentials: ServiceAccountCredentials } | OAuthCredentials;

type Ga4ApiReport = Parameters<typeof mapGa4Reports>[0]["metrics"];
type GoogleErrorResponse = { error?: { code?: number; status?: string; message?: string } };

let cachedToken: { identity: string; accessToken: string; expiresAt: number } | undefined;

function configuredCredentials(): ConfiguredCredentials | null {
	const clientId = process.env["GA4_OAUTH_CLIENT_ID"];
	const clientSecret = process.env["GA4_OAUTH_CLIENT_SECRET"];
	const refreshToken = process.env["GA4_OAUTH_REFRESH_TOKEN"];
	if (clientId || clientSecret || refreshToken) {
		if (!clientId?.trim() || !clientSecret?.trim() || !refreshToken?.trim()) {
			throw new Error("invalid_credentials_config");
		}
		return { type: "oauth", clientId, clientSecret, refreshToken };
	}

	const rawCredentials = process.env["GA4_SERVICE_ACCOUNT_JSON"];
	if (!rawCredentials) return null;
	try {
		const credentials = JSON.parse(rawCredentials) as ServiceAccountCredentials;
		if (credentials.type !== "service_account" || !credentials.client_email || !credentials.private_key) {
			throw new Error("invalid_credentials_config");
		}
		return { type: "service_account", credentials };
	} catch {
		throw new Error("invalid_credentials_config");
	}
}

function errorWithCode(code: number, message = "Google Analytics reporting is unavailable."): Error & { code: number } {
	return Object.assign(new Error(message), { code });
}

function providerErrorCode(status: number, body: GoogleErrorResponse): number | undefined {
	if (status === 401 || body.error?.status === "UNAUTHENTICATED") return 16;
	if (status === 403 || body.error?.status === "PERMISSION_DENIED") return 7;
	if (status === 429 || body.error?.status === "RESOURCE_EXHAUSTED") return 8;
	if (status >= 500 || body.error?.status === "UNAVAILABLE") return 14;
	if (body.error?.status === "INVALID_ARGUMENT" || body.error?.status === "NOT_FOUND") return 3;
	return undefined;
}

async function responseBody(response: Response): Promise<GoogleErrorResponse & Record<string, unknown>> {
	try {
		const body: unknown = await response.json();
		return body && typeof body === "object" ? body as GoogleErrorResponse & Record<string, unknown> : {};
	} catch {
		return {};
	}
}

async function getAccessToken(config: ConfiguredCredentials, signal: AbortSignal): Promise<string> {
	const identity = config.type === "oauth"
		? `oauth:${config.clientId}:${config.refreshToken}`
		: `service_account:${config.credentials.client_email}`;
	if (cachedToken?.identity === identity && cachedToken.expiresAt > Date.now()) return cachedToken.accessToken;

	let form: URLSearchParams;
	if (config.type === "oauth") {
		form = new URLSearchParams({
			client_id: config.clientId,
			client_secret: config.clientSecret,
			refresh_token: config.refreshToken,
			grant_type: "refresh_token",
		});
	} else {
		const credentials = config.credentials;
		let assertion: string;
		try {
			const key = await importPKCS8(credentials.private_key!, "RS256");
			const now = Math.floor(Date.now() / 1000);
			assertion = await new SignJWT({ scope: SCOPE })
				.setProtectedHeader({ alg: "RS256", typ: "JWT" })
				.setIssuer(credentials.client_email!)
				.setAudience(TOKEN_URL)
				.setIssuedAt(now)
				.setExpirationTime(now + 3600)
				.sign(key);
		} catch {
			throw new Error("invalid_credentials_config");
		}
		form = new URLSearchParams({
			grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
			assertion,
		});
	}
	const response = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: form,
		signal,
	});
	const body = await responseBody(response);
	if (!response.ok) {
		const code = providerErrorCode(response.status, body);
		throw errorWithCode(code ?? (response.status >= 500 ? 14 : 16));
	}

	const accessToken = body.access_token;
	const expiresIn = Number(body.expires_in);
	if (typeof accessToken !== "string" || !accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
		throw new Error("Google authentication is unavailable.");
	}
	cachedToken = {
		identity,
		accessToken,
		expiresAt: Date.now() + Math.max(0, expiresIn * 1000 - TOKEN_REFRESH_SKEW_MS),
	};
	return accessToken;
}

async function runReport(
	accessToken: string,
	range: { startDate: string; endDate: string },
	signal: AbortSignal,
	metrics: string[],
	dimensions: string[] = [],
	extra: Record<string, unknown> = {},
): Promise<Ga4ApiReport> {
	const response = await fetch(REPORT_URL, {
		method: "POST",
		headers: {
			authorization: `Bearer ${accessToken}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			dateRanges: [range],
			metrics: metrics.map((name) => ({ name })),
			dimensions: dimensions.map((name) => ({ name })),
			...extra,
		}),
		signal,
	});
	const body = await responseBody(response);
	if (!response.ok) {
		const code = providerErrorCode(response.status, body);
		throw code ? errorWithCode(code) : new Error("Google Analytics reporting is unavailable.");
	}
	return body as Ga4ApiReport;
}

export async function readGa4Report(input: Ga4RangeInput): Promise<Ga4Report> {
	const range = resolveGa4Range(input, new Date(), process.env["GA4_PROPERTY_TIME_ZONE"]);
	const fetchedAt = new Date().toISOString();
	try {
		const credentials = configuredCredentials();
		if (!credentials) {
			return unavailableGa4Report(range, "Google credentials are not configured for this server. Configure GA4 OAuth refresh-token credentials or GA4_SERVICE_ACCOUNT_JSON.", fetchedAt);
		}
		const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
		const accessToken = await getAccessToken(credentials, timeout);
		const period = { startDate: range.startDate, endDate: range.endDate };
		const [totals, trafficChannels, trafficSources, landingPages, vehiclePages, deviceCategories, daily, generateLeadEvents, generateLeadDaily] = await Promise.all([
			runReport(accessToken, period, timeout, ["activeUsers", "totalUsers", "sessions", "engagedSessions", "engagementRate", "screenPageViews"]),
			runReport(accessToken, period, timeout, ["sessions", "activeUsers"], ["sessionDefaultChannelGroup"], { limit: 25 }),
			runReport(accessToken, period, timeout, ["sessions", "activeUsers"], ["sessionSourceMedium"], { limit: 15 }),
			runReport(accessToken, period, timeout, ["sessions", "activeUsers", "screenPageViews", "engagedSessions", "engagementRate"], ["landingPage"], { limit: 25 }),
			runReport(accessToken, period, timeout, ["sessions", "activeUsers", "screenPageViews", "engagedSessions", "engagementRate"], ["pagePath"], {
				limit: 25,
				dimensionFilter: { filter: { fieldName: "pagePath", stringFilter: { matchType: "BEGINS_WITH", value: "/inventory/" } } },
			}),
			runReport(accessToken, period, timeout, ["sessions", "activeUsers"], ["deviceCategory"], { limit: 10 }),
			runReport(accessToken, period, timeout, ["activeUsers", "sessions", "screenPageViews"], ["date"], {
				orderBys: [{ dimension: { dimensionName: "date" } }],
				limit: 90,
			}),
			runReport(accessToken, period, timeout, ["eventCount"], [], {
				dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: "generate_lead" } } },
			}),
			runReport(accessToken, period, timeout, ["eventCount"], ["date"], {
				dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: "generate_lead" } } },
				orderBys: [{ dimension: { dimensionName: "date" } }],
				limit: 90,
			}),
		]);
		return mapGa4Reports({
			startDate: range.startDate,
			endDate: range.endDate,
			fetchedAt,
			metrics: totals,
			trafficChannels,
			trafficSources,
			landingPages,
			vehiclePages,
			deviceCategories,
			daily,
			generateLeadDaily,
			generateLeadEvents,
		});
	} catch (error) {
		return unavailableGa4Report(range, safeGa4ErrorMessage(error), fetchedAt);
	}
}