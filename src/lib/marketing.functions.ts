import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { prospectSchema } from "./marketing";

async function staff() {
  const token = getRequest().headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Not signed in.");
  const { requireStaff } = await import("./legacy-blog.server");
  return requireStaff(token);
}
export const getMarketing = createServerFn({ method: "POST" }).handler(async () => { await staff(); const m = await import("./marketing.server"); return m.readMarketing(); });
export const refreshMarketingFn = createServerFn({ method: "POST" }).inputValidator((input: unknown) => z.object({ service: z.enum(["search", "research", "lighthouse", "website"]), property: z.string().max(2048).optional() }).parse(input)).handler(async ({ data }) => { await staff(); const m = await import("./marketing.server"); await m.refreshMarketing(data.service, data.property); return m.readMarketing(); });
export const saveMarketingProspect = createServerFn({ method: "POST" }).inputValidator((input: unknown) => prospectSchema.parse(input)).handler(async ({ data }) => { const userId = await staff(); const m = await import("./marketing.server"); return m.saveProspect(data, userId); });
export const deleteMarketingProspect = createServerFn({ method: "POST" }).inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input)).handler(async ({ data }) => { await staff(); const m = await import("./marketing.server"); await m.removeProspect(data.id); return { ok: true }; });