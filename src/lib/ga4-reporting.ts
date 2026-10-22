import { z } from "zod";

export const GA4_PROPERTY_ID = "559909149";
export const MAX_GA4_REPORT_DAYS = 90;

export const ga4RangeSchema = z.object({
	preset: z.union([z.literal(7), z.literal(30), z.literal(90)]).optional(),
	startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine((value) => value.preset !== undefined
	? value.startDate === undefined && value.endDate === undefined
	: value.startDate !== undefined && value.endDate !== undefined,
"Choose a preset or provide both custom dates.");

export type Ga4RangeInput = z.infer<typeof ga4RangeSchema>;
export type Ga4ResolvedRange = { startDate: string; endDate: string };
export type Ga4Metric = { activeUsers: number; totalUsers: number; sessions: number; engagedSessions: number; engagementRate: number; screenPageViews: number };
export type Ga4Breakdown = { label: string; sessions: number; activeUsers: number; pageViews: number; engagedSessions: number; engagementRate: number };
export type Ga4Daily = { date: string; activeUsers: number; sessions: number; screenPageViews: number };
export type Ga4Report = {
	status: "available" | "unavailable";
	message: string | null;
	propertyId: string;
	timeZone: string | null;
	startDate: string;
	endDate: string;
	fetchedAt: string;
	metrics: Ga4Metric | null;
	trafficChannels: Ga4Breakdown[] | null;
	trafficSources: Ga4Breakdown[] | null;
	landingPages: Ga4Breakdown[] | null;
	vehiclePages: Ga4Breakdown[] | null;
	deviceCategories: Ga4Breakdown[] | null;
	daily: Ga4Daily[] | null;
	generateLeadDaily: Array<{ date: string; eventCount: number }> | null;
	generateLeadEvents: number | null;
};
export type Ga4IntegrationStatus = "Connected" | "Not Configured" | "Missing Credentials" | "Permission Denied" | "No Data Yet" | "Temporary API Error" | "Quota Exceeded";

export function resolveGa4IntegrationStatus(report?: Ga4Report | null, requestError?: unknown): Ga4IntegrationStatus {
	const message = report?.message ?? (requestError instanceof Error ? requestError.message : "");
	if (report?.status === "available") {
		const metrics = report.metrics;
		return metrics && (metrics.totalUsers || metrics.sessions || metrics.screenPageViews || report.generateLeadEvents || report.daily?.some((row) => row.sessions || row.screenPageViews))
			? "Connected"
			: "No Data Yet";
	}
	if (/credential/i.test(message)) return "Missing Credentials";
	if (/invalid_credentials_config/i.test(message)) return "Missing Credentials";
	if (/not configured/i.test(message)) return "Not Configured";
	if (/not authorized|permission|access/i.test(message)) return "Permission Denied";
	if (/quota|exhausted/i.test(message)) return "Quota Exceeded";
	if (/temporarily unavailable|timed? ?out/i.test(message)) return "Temporary API Error";
	if (requestError) return "Temporary API Error";
	return "Not Configured";
}

function parseDate(value: string): Date | null {
	const date = new Date(`${value}T00:00:00.000Z`);
	return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function dateInTimeZone(now: Date, timeZone?: string): string {
	const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timeZone ?? "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${values.year}-${values.month}-${values.day}`;
}

export function resolveGa4Range(input: Ga4RangeInput, now = new Date(), timeZone?: string): Ga4ResolvedRange {
	let startDate: string;
	let endDate: string;
	if (input.preset !== undefined) {
		const end = new Date(`${dateInTimeZone(now, timeZone)}T00:00:00.000Z`);
		const start = new Date(end);
		start.setUTCDate(start.getUTCDate() - input.preset + 1);
		startDate = start.toISOString().slice(0, 10);
		endDate = end.toISOString().slice(0, 10);
	} else {
		startDate = input.startDate!;
		endDate = input.endDate!;
	}
	const start = parseDate(startDate);
	const end = parseDate(endDate);
	const today = Date.parse(`${dateInTimeZone(now, timeZone)}T00:00:00.000Z`);
	if (!start || !end || start.getTime() > end.getTime() || end.getTime() > today) {
		throw new Error("Choose a valid date range ending today or earlier.");
	}
	const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
	if (days > MAX_GA4_REPORT_DAYS) throw new Error(`Choose a range of ${MAX_GA4_REPORT_DAYS} days or fewer.`);
	return { startDate, endDate };
}

type ApiRow = { dimensionValues?: Array<{ value?: string | null } | null> | null; metricValues?: Array<{ value?: string | null } | null> | null };
type ApiReport = { rows?: ApiRow[] | null; rowCount?: number | null; metadata?: { timeZone?: string | null } | null };

function numeric(value: string | null | undefined): number {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
}

export function sanitizeGa4PagePath(value: string): string {
	let path: string;
	try {
		path = new URL(value, "https://mycarcorp.com").pathname;
	} catch {
		path = value.split(/[?#]/, 1)[0] ?? "/";
	}
	try {
		path = decodeURIComponent(path);
	} catch {
		path = path;
	}
	return path.split("/").map((segment) =>
		/^[A-HJ-NPR-Z0-9]{17}$/i.test(segment) ? "[vehicle]"
			: /@|^[^/\s]+@[^/\s]+\.[^/\s]+$|^[+\d().-]{7,}$|^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(segment) ? "[redacted]"
				: segment,
	).join("/").slice(0, 500) || "/";
}

export function mapGa4Reports(input: {
	startDate: string;
	endDate: string;
	fetchedAt: string;
	metrics: ApiReport;
	trafficChannels: ApiReport;
	trafficSources?: ApiReport;
	landingPages: ApiReport;
	vehiclePages?: ApiReport;
	deviceCategories: ApiReport;
	daily: ApiReport;
	generateLeadDaily?: ApiReport;
	generateLeadEvents: ApiReport;
}): Ga4Report {
	const totals = input.metrics.rows?.[0]?.metricValues ?? [];
	const breakdown = (report: ApiReport, sanitizePath = false): Ga4Breakdown[] => (report.rows ?? []).map((row) => ({
		label: sanitizePath ? sanitizeGa4PagePath(row.dimensionValues?.[0]?.value || "/") : row.dimensionValues?.[0]?.value || "(not set)",
		sessions: numeric(row.metricValues?.[0]?.value),
		activeUsers: numeric(row.metricValues?.[1]?.value),
		pageViews: numeric(row.metricValues?.[2]?.value),
		engagedSessions: numeric(row.metricValues?.[3]?.value),
		engagementRate: numeric(row.metricValues?.[4]?.value),
	}));
	const vehiclePages = input.vehiclePages ?? {};
	const generateLeadDaily = input.generateLeadDaily ?? {};
	const trafficSources = input.trafficSources ?? {};
	const metadata = [input.metrics, input.daily, input.trafficChannels, trafficSources, input.landingPages, vehiclePages, input.deviceCategories, generateLeadDaily, input.generateLeadEvents]
		.map((report) => report.metadata?.timeZone).find((value): value is string => Boolean(value)) ?? null;
	return {
		status: "available",
		message: null,
		propertyId: GA4_PROPERTY_ID,
		timeZone: metadata,
		startDate: input.startDate,
		endDate: input.endDate,
		fetchedAt: input.fetchedAt,
		metrics: {
			activeUsers: numeric(totals[0]?.value),
			totalUsers: numeric(totals[1]?.value),
			sessions: numeric(totals[2]?.value),
			engagedSessions: numeric(totals[3]?.value),
			engagementRate: numeric(totals[4]?.value),
			screenPageViews: numeric(totals[5]?.value),
		},
		trafficChannels: breakdown(input.trafficChannels),
		trafficSources: breakdown(trafficSources),
		landingPages: breakdown(input.landingPages, true),
		vehiclePages: breakdown(vehiclePages, true),
		deviceCategories: breakdown(input.deviceCategories),
		daily: (input.daily.rows ?? []).map((row) => ({
			date: row.dimensionValues?.[0]?.value ?? "",
			activeUsers: numeric(row.metricValues?.[0]?.value),
			sessions: numeric(row.metricValues?.[1]?.value),
			screenPageViews: numeric(row.metricValues?.[2]?.value),
		})),
		generateLeadDaily: (generateLeadDaily.rows ?? []).map((row) => ({
			date: row.dimensionValues?.[0]?.value ?? "",
			eventCount: numeric(row.metricValues?.[0]?.value),
		})),
		generateLeadEvents: numeric(input.generateLeadEvents.rows?.[0]?.metricValues?.[0]?.value),
	};
}

export function unavailableGa4Report(range: Ga4ResolvedRange, message: string, fetchedAt = new Date().toISOString()): Ga4Report {
	return {
		status: "unavailable", message, propertyId: GA4_PROPERTY_ID, timeZone: null,
		startDate: range.startDate, endDate: range.endDate, fetchedAt,
		metrics: null, trafficChannels: null, trafficSources: null, landingPages: null, vehiclePages: null, deviceCategories: null, daily: null, generateLeadDaily: null,
		generateLeadEvents: null,
	};
}

export function safeGa4ErrorMessage(error: unknown): string {
	const candidate = error as { code?: number | string; message?: string; name?: string };
	const code = String(candidate?.code ?? "");
	const detail = candidate?.message ?? "";
	if (detail === "invalid_credentials_config") {
		return "GA4 credentials are invalid. Check the server-side credential configuration.";
	}
	if (/default credentials|credentials.*not found|could not load.*credential/i.test(detail)) {
		return "Google credentials are not configured for the server. Configure GA4 OAuth refresh-token credentials or GA4_SERVICE_ACCOUNT_JSON.";
	}
	if (code === "16" || code === "UNAUTHENTICATED") return "Google authentication failed. Check server credentials.";
	if (code === "7" || code === "PERMISSION_DENIED") return "GA4 access is not authorized. Grant the configured Google identity Viewer access to the Analytics property.";
	if (code === "8" || code === "RESOURCE_EXHAUSTED") return "The Google Analytics reporting quota is temporarily exhausted. Try again later.";
	if (code === "5" || code === "NOT_FOUND" || code === "3" || code === "INVALID_ARGUMENT") {
		return "The configured GA4 property was not found or is invalid for this account.";
	}
	if (code === "4" || code === "DEADLINE_EXCEEDED" || code === "14" || code === "UNAVAILABLE" || candidate?.name === "TimeoutError" || /timed? ?out|deadline exceeded/i.test(detail)) {
		return "Google Analytics is temporarily unavailable. Try again shortly.";
	}
	return "Google Analytics reporting is unavailable. Check server configuration and try again.";
}