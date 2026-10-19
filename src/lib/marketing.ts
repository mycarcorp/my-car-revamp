import { z } from "zod";

export type IntegrationState = "Connected" | "Not Connected" | "Error";
export type ServiceReport<T = unknown> = { state: IntegrationState; checkedAt: string | null; message: string; data: T | null };
export type SearchRow = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };
export type SearchReport = { siteUrl: string | null; candidates: string[]; startDate?: string; endDate?: string; totals?: SearchRow; keywords?: SearchRow[]; pages?: SearchRow[]; sitemaps?: { path: string; errors?: string; warnings?: string; lastSubmitted?: string }[] };
export type SemrushTable = { columnNames: string[]; rows: (string | number | null)[][] };
export type ResearchReport = { domains?: SemrushTable; backlinks?: SemrushTable; keywords?: SemrushTable };
export type Audit = { url: string; date: string; performance: number | null; accessibility: number | null; seo: number | null; bestPractices: number | null };
export type LighthouseReport = { runUrl: string | null; conclusion: string | null; audits: Audit[]; artifactAvailable: boolean };
export type Article = { slug: string; title: string; publishedAt: string | null; source: "AutoSEO" | "Manual" };
export type SiteHealth = { sitemap: { status: number; urls: number; sameOriginUrls: number }; robots: { status: number; blocksAll: boolean; sitemapDeclared: boolean }; metadata: { status: number; title: string | null; description: boolean; verificationTag: boolean }; articles: Article[]; autoSeoTokenConfigured: boolean };
export type MarketingSnapshot = { search: ServiceReport<SearchReport>; research: ServiceReport<ResearchReport>; lighthouse: ServiceReport<LighthouseReport>; website: ServiceReport<SiteHealth> };
export const unavailable = <T>(message: string): ServiceReport<T> => ({ state: "Not Connected", checkedAt: null, message, data: null });
export const emptySnapshot = (): MarketingSnapshot => ({ search: unavailable("Search Console has not been checked."), research: unavailable("Semrush has not been checked."), lighthouse: unavailable("GitHub has not been checked."), website: unavailable("Website monitoring has not been checked.") });

export function coversTarget(siteUrl: string, targetUrl = "https://mycarcorp.com/"): boolean {
  const target = new URL(targetUrl);
  if (siteUrl.startsWith("sc-domain:")) { const domain = siteUrl.slice(10).toLowerCase(); return target.hostname === domain || target.hostname.endsWith(`.${domain}`); }
  try { const prefix = new URL(siteUrl); return target.href.startsWith(prefix.href); } catch { return false; }
}
export function resolveProperty(entries: { siteUrl: string; permissionLevel?: string }[], choice?: string | null) {
  const candidates = entries.filter((e) => e.permissionLevel !== "siteUnverifiedUser" && coversTarget(e.siteUrl)).map((e) => e.siteUrl);
  if (choice) { if (!candidates.includes(choice)) throw new Error("The selected property is no longer verified for My Car."); return { selected: choice, candidates }; }
  return { selected: candidates.length === 1 ? candidates[0] : null, candidates };
}
export function mergeArticles(auto: Article[], manual: Article[]): Article[] {
  return [...new Map([...auto, ...manual].map((a) => [a.slug, a])).values()].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}
export const prospectSchema = z.object({
  id: z.string().uuid().optional(), domain: z.string().trim().min(3).max(253).regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i, "Enter a domain, without https:// or a path."),
  status: z.enum(["Researching", "Contacted", "In discussion", "Acquired", "Not suitable"]),
  relevance: z.string().trim().max(300), notes: z.string().trim().max(2000),
  backlinkUrl: z.union([z.literal(""), z.string().url().max(2000).refine((s) => /^https?:\/\//i.test(s), "Use an http or https link.")]),
}).superRefine((v, ctx) => { if (v.status === "Acquired" && !v.backlinkUrl) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["backlinkUrl"], message: "Add the acquired backlink URL." }); });
export type ProspectInput = z.infer<typeof prospectSchema>;
export type Prospect = ProspectInput & { id: string; updatedAt: string; updatedBy: string };
export const inspectionSchema = z.object({ url: z.string().url().max(2048).refine((value) => { const u = new URL(value); return u.origin === "https://mycarcorp.com"; }, "Choose a page on https://mycarcorp.com." ) });
export type Inspection = { url: string; inspectedAt: string; lastCrawlTime: string | null; verdict: string | null; coverageState: string | null; indexingState: string | null; googleCanonical: string | null };
export type LeadAttributionReport = {
  startDate: string;
  endDate: string;
  scanned: number;
  total: number | null;
  complete: boolean;
  bySource: Array<{ source: string; count: number }>;
  byMedium: Array<{ medium: string; count: number }>;
  byCampaign: Array<{ campaign: string; count: number }>;
  byLeadType: Array<{ leadType: string; count: number }>;
};