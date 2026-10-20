import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prospectSchema, inspectionSchema } from "./marketing";

export const getMarketing = createServerFn({ method: "POST" }).handler(async () => { const m = await import("./marketing.server"); await m.requireMarketingStaff(); return m.readMarketing(); });
export const getLeadAttribution = createServerFn({ method: "POST" }).inputValidator((input: unknown) => z.object({
	preset: z.union([z.literal(7), z.literal(30), z.literal(90)]).optional(),
	startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine((value) => {
	if (value.preset !== undefined) return value.startDate === undefined && value.endDate === undefined;
	return value.startDate !== undefined && value.endDate !== undefined;
}, "Choose a preset or provide both custom dates.").parse(input)).handler(async ({ data }) => {
	const m = await import("./marketing.server");
	await m.requireMarketingStaff();
	return m.readLeadAttribution(data.preset !== undefined
		? { preset: data.preset }
		: { preset: "custom", startDate: data.startDate!, endDate: data.endDate! });
});
export const refreshMarketingFn = createServerFn({ method: "POST" }).inputValidator((input: unknown) => z.object({ service: z.enum(["search", "research", "lighthouse", "website"]), property: z.string().max(2048).optional() }).parse(input)).handler(async ({ data }) => { const m = await import("./marketing.server"); await m.requireMarketingStaff(); await m.refreshMarketing(data.service, data.property); return m.readMarketing(); });
export const saveMarketingProspect = createServerFn({ method: "POST" }).inputValidator((input: unknown) => prospectSchema.parse(input)).handler(async ({ data }) => { const m = await import("./marketing.server"); const userId = await m.requireMarketingStaff(); return m.saveProspect(data, userId); });
export const deleteMarketingProspect = createServerFn({ method: "POST" }).inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input)).handler(async ({ data }) => { const m = await import("./marketing.server"); await m.requireMarketingStaff(); await m.removeProspect(data.id); return { ok: true }; });
export const inspectMarketingUrl = createServerFn({ method: "POST" }).inputValidator((input: unknown) => inspectionSchema.parse(input)).handler(async ({ data }) => { const m = await import("./marketing.server"); await m.requireMarketingStaff(); return m.inspectUrl(data.url); });