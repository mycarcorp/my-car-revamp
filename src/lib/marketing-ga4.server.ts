import { BetaAnalyticsDataClient } from "@google-analytics/data";
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
const REQUEST_TIMEOUT_MS = 20000;

function createClient(): BetaAnalyticsDataClient {
	const rawCredentials = process.env["GA4_SERVICE_ACCOUNT_JSON"];
	if (!rawCredentials) return new BetaAnalyticsDataClient({ scopes: [SCOPE] });
	let credentials: { client_email?: string; private_key?: string; type?: string };
	try {
		credentials = JSON.parse(rawCredentials) as typeof credentials;
	} catch {
		throw new Error("invalid_credentials_config");
	}
	if (credentials.type !== "service_account" || !credentials.client_email || !credentials.private_key) {
		throw new Error("invalid_credentials_config");
	}
	return new BetaAnalyticsDataClient({ credentials, scopes: [SCOPE] });
}

export async function readGa4Report(input: Ga4RangeInput): Promise<Ga4Report> {
	const range = resolveGa4Range(input);
	const fetchedAt = new Date().toISOString();
	const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
	try {
		const client = createClient();
		const property = `properties/${GA4_PROPERTY_ID}`;
		const period = { startDate: range.startDate, endDate: range.endDate };
		const report = (metrics: string[], dimensions: string[] = [], extra: Record<string, unknown> = {}) =>
			client.runReport({ property, dateRanges: [period], metrics: metrics.map((name) => ({ name })), dimensions: dimensions.map((name) => ({ name })), ...extra }, { otherArgs: { timeout: REQUEST_TIMEOUT_MS, signal: timeout } });
		const [totals, trafficChannels, landingPages, deviceCategories, daily, generateLeadEvents] = await Promise.all([
			report(["activeUsers", "totalUsers", "sessions", "engagedSessions", "engagementRate", "screenPageViews"]),
			report(["sessions", "activeUsers"], ["sessionDefaultChannelGroup"], { limit: 25 }),
			report(["sessions", "activeUsers"], ["landingPagePlusQueryString"], { limit: 25 }),
			report(["sessions", "activeUsers"], ["deviceCategory"], { limit: 10 }),
			report(["activeUsers", "sessions", "screenPageViews"], ["date"], { orderBys: [{ dimension: { dimensionName: "date" } }], limit: 90 }),
			report(["eventCount"], [], { dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: "generate_lead" } } } }),
		]);
		return mapGa4Reports({
			startDate: range.startDate,
			endDate: range.endDate,
			fetchedAt,
			metrics: totals[0],
			trafficChannels: trafficChannels[0],
			landingPages: landingPages[0],
			deviceCategories: deviceCategories[0],
			daily: daily[0],
			generateLeadEvents: generateLeadEvents[0],
		});
	} catch (error) {
		return unavailableGa4Report(range, safeGa4ErrorMessage(error), fetchedAt);
	}
}