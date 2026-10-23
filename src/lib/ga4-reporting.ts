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
/** Existing, non-sensitive events emitted by the website (see analytics.ts). */
export const TRACKED_GA4_EVENTS = [
	"page_view",
	"view_item_list",
	"select_item",
	"view_item",
	"search",
	"appointment_type_selected",
	"appointment_vehicle_selected",
	"form_start",
	"generate_lead",
] as const;
export type Ga4EventCount = { eventName: string; eventCount: number; totalUsers: number | null };
export type Ga4SectionKey =
	| "metrics" | "trafficChannels" | "trafficSources" | "landingPages" | "vehiclePages"
	| "deviceCategories" | "daily" | "generateLeadEvents" | "generateLeadDaily" | "events";
/** Safe, user-facing message for each historical section that failed independently. */
export type Ga4SectionErrors = Partial<Record<Ga4SectionKey, string>>;
export const GA4_SECTION_LABELS: Record<Ga4SectionKey, string> = {
	metrics: "Summary metrics",
	trafficChannels: "Acquisition channels",
	trafficSources: "Source / medium",
	landingPages: "Landing pages",
	vehiclePages: "Vehicle pages",
	deviceCategories: "Devices",
	daily: "Daily traffic",
	generateLeadEvents: "generate_lead total",
	generateLeadDaily: "generate_lead by day",
	events: "Event counts",
};
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
	events: Ga4EventCount[] | null;
	sectionErrors: Ga4SectionErrors;
	timeZoneSource: "property" | "configured" | "unknown";
};
export type Ga4RealtimeReport = {
	status: "available" | "unavailable";
	message: string | null;
	fetchedAt: string;
	windowMinutes: number;
	activeUsers: number | null;
	events: Ga4EventCount[] | null;
	sectionErrors: { activeUsers?: string; events?: string };
};
export type Ga4IntegrationStatus = "Connected" | "Partial Data" | "Not Configured" | "Missing Credentials" | "Permission Denied" | "No Data Yet" | "Temporary API Error" | "Quota Exceeded";
export type Ga4RuntimeDiagnostics = {
	oauthCredentialsPresent: { clientId: boolean; clientSecret: boolean; refreshToken: boolean };
	serviceAccountConfigured: boolean;
	authenticationMode: "oauth" | "service_account" | "partial_oauth" | "invalid_service_account" | "none";
	tokenExchangeAttempted: boolean;
	googleHttpStatus: number | null;
	errorCategory: string | null;
	propertyTimeZoneAvailable: boolean;
};

export function ga4ReportHasData(report: Ga4Report): boolean {
	const metrics = report.metrics;
	return Boolean(
		(metrics && (metrics.totalUsers || metrics.sessions || metrics.screenPageViews))
		|| report.generateLeadEvents
		|| report.daily?.some((row) => row.sessions || row.screenPageViews)
		|| report.events?.some((row) => row.eventCount),
	);
}

export function resolveGa4IntegrationStatus(report?: Ga4Report | null, requestError?: unknown): Ga4IntegrationStatus {
	const message = report?.message ?? (requestError instanceof Error ? requestError.message : "");
	if (report?.status === "available") {
		const hasFailures = Object.keys(report.sectionErrors ?? {}).length > 0;
		if (hasFailures) return "Partial Data";
		return ga4ReportHasData(report) ? "Connected" : "No Data Yet";
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

/**
 * Date range sent to the Data API. Presets use GA4 relative dates, which the API
 * evaluates in the property's own time zone, so "today" always matches the property
 * calendar. Custom ranges are sent exactly as selected.
 */
export function ga4ApiDateRange(input: Ga4RangeInput, resolved: Ga4ResolvedRange): { startDate: string; endDate: string } {
	return input.preset !== undefined
		? { startDate: `${input.preset - 1}daysAgo`, endDate: "today" }
		: { startDate: resolved.startDate, endDate: resolved.endDate };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Formats GA4 date values (YYYYMMDD or YYYY-MM-DD) for chart axes ("10/23") and tooltips ("Oct 23, 2026"). */
export function formatGa4DateLabel(value: string, style: "axis" | "full" = "full"): string {
	const match = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(value);
	if (!match) return value;
	const [, year, month, day] = match;
	const monthIndex = Number(month) - 1;
	if (monthIndex < 0 || monthIndex > 11) return value;
	return style === "axis" ? `${month}/${day}` : `${MONTHS[monthIndex]} ${Number(day)}, ${year}`;
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

/** Maps eventName rows to the fixed list of tracked events, with zero for events not present. */
export function mapEventRows(report: ApiReport): Ga4EventCount[] {
	const byName = new Map<string, Ga4EventCount>();
	for (const row of report.rows ?? []) {
		const eventName = row.dimensionValues?.[0]?.value ?? "";
		if (!eventName) continue;
		const second = row.metricValues?.[1]?.value;
		byName.set(eventName, {
			eventName,
			eventCount: numeric(row.metricValues?.[0]?.value),
			totalUsers: second === undefined || second === null ? null : numeric(second),
		});
	}
	return TRACKED_GA4_EVENTS.map((eventName) => byName.get(eventName) ?? { eventName, eventCount: 0, totalUsers: null });
}

type MapInput = {
	startDate: string;
	endDate: string;
	fetchedAt: string;
	configuredTimeZone?: string;
	/** null means the query failed; an empty object means GA4 returned no rows. */
	metrics: ApiReport | null;
	trafficChannels: ApiReport | null;
	trafficSources?: ApiReport | null;
	landingPages: ApiReport | null;
	vehiclePages?: ApiReport | null;
	deviceCategories: ApiReport | null;
	daily: ApiReport | null;
	generateLeadDaily?: ApiReport | null;
	generateLeadEvents: ApiReport | null;
	events?: ApiReport | null;
	sectionErrors?: Ga4SectionErrors;
};

export function mapGa4Reports(input: MapInput): Ga4Report {
	const breakdown = (report: ApiReport | null | undefined, sanitizePath = false): Ga4Breakdown[] | null => {
		if (report === null) return null;
		return (report?.rows ?? []).map((row) => ({
			label: sanitizePath ? sanitizeGa4PagePath(row.dimensionValues?.[0]?.value || "/") : row.dimensionValues?.[0]?.value || "(not set)",
			sessions: numeric(row.metricValues?.[0]?.value),
			activeUsers: numeric(row.metricValues?.[1]?.value),
			pageViews: numeric(row.metricValues?.[2]?.value),
			engagedSessions: numeric(row.metricValues?.[3]?.value),
			engagementRate: numeric(row.metricValues?.[4]?.value),
		}));
	};
	const reports = [input.metrics, input.daily, input.trafficChannels, input.trafficSources, input.landingPages, input.vehiclePages, input.deviceCategories, input.generateLeadDaily, input.generateLeadEvents, input.events];
	const propertyTimeZone = reports.map((report) => report?.metadata?.timeZone).find((value): value is string => Boolean(value));
	const totals = input.metrics?.rows?.[0]?.metricValues ?? [];
	return {
		status: "available",
		message: null,
		propertyId: GA4_PROPERTY_ID,
		timeZone: propertyTimeZone ?? input.configuredTimeZone ?? null,
		timeZoneSource: propertyTimeZone ? "property" : input.configuredTimeZone ? "configured" : "unknown",
		startDate: input.startDate,
		endDate: input.endDate,
		fetchedAt: input.fetchedAt,
		metrics: input.metrics === null ? null : {
			activeUsers: numeric(totals[0]?.value),
			totalUsers: numeric(totals[1]?.value),
			sessions: numeric(totals[2]?.value),
			engagedSessions: numeric(totals[3]?.value),
			engagementRate: numeric(totals[4]?.value),
			screenPageViews: numeric(totals[5]?.value),
		},
		trafficChannels: breakdown(input.trafficChannels),
		trafficSources: breakdown(input.trafficSources),
		landingPages: breakdown(input.landingPages, true),
		vehiclePages: breakdown(input.vehiclePages, true),
		deviceCategories: breakdown(input.deviceCategories),
		daily: input.daily === null ? null : (input.daily.rows ?? []).map((row) => ({
			date: row.dimensionValues?.[0]?.value ?? "",
			activeUsers: numeric(row.metricValues?.[0]?.value),
			sessions: numeric(row.metricValues?.[1]?.value),
			screenPageViews: numeric(row.metricValues?.[2]?.value),
		})),
		generateLeadDaily: input.generateLeadDaily === null ? null : (input.generateLeadDaily?.rows ?? []).map((row) => ({
			date: row.dimensionValues?.[0]?.value ?? "",
			eventCount: numeric(row.metricValues?.[0]?.value),
		})),
		generateLeadEvents: input.generateLeadEvents === null ? null : numeric(input.generateLeadEvents.rows?.[0]?.metricValues?.[0]?.value),
		events: input.events === null ? null : mapEventRows(input.events ?? {}),
		sectionErrors: input.sectionErrors ?? {},
	};
}

export function unavailableGa4Report(range: Ga4ResolvedRange, message: string, fetchedAt = new Date().toISOString()): Ga4Report {
	return {
		status: "unavailable", message, propertyId: GA4_PROPERTY_ID, timeZone: null, timeZoneSource: "unknown",
		startDate: range.startDate, endDate: range.endDate, fetchedAt,
		metrics: null, trafficChannels: null, trafficSources: null, landingPages: null, vehiclePages: null, deviceCategories: null, daily: null, generateLeadDaily: null,
		generateLeadEvents: null, events: null, sectionErrors: {},
	};
}

export const GA4_REALTIME_WINDOW_MINUTES = 30;

export function mapGa4Realtime(input: {
	fetchedAt: string;
	activeUsers: ApiReport | null;
	events: ApiReport | null;
	sectionErrors?: { activeUsers?: string; events?: string };
}): Ga4RealtimeReport {
	return {
		status: "available",
		message: null,
		fetchedAt: input.fetchedAt,
		windowMinutes: GA4_REALTIME_WINDOW_MINUTES,
		// A no-dimension realtime report has no rows when nobody is active.
		activeUsers: input.activeUsers === null ? null : numeric(input.activeUsers.rows?.[0]?.metricValues?.[0]?.value),
		events: input.events === null ? null : mapEventRows(input.events),
		sectionErrors: input.sectionErrors ?? {},
	};
}

export function unavailableGa4Realtime(message: string, fetchedAt = new Date().toISOString()): Ga4RealtimeReport {
	return { status: "unavailable", message, fetchedAt, windowMinutes: GA4_REALTIME_WINDOW_MINUTES, activeUsers: null, events: null, sectionErrors: {} };
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