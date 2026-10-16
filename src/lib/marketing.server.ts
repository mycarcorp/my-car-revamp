import { unzip } from "fflate";
import { getRequest } from "@tanstack/react-start/server";
import { appAdminCreds } from "./app-admin.server";
import { emptySnapshot, mergeArticles, resolveProperty, type MarketingSnapshot, type ServiceReport, type SearchReport, type SearchRow, type ResearchReport, type SemrushTable, type LighthouseReport, type SiteHealth, type Prospect, type ProspectInput } from "./marketing";

const BUCKET = "marketing-private";
const ORIGIN = "https://mycarcorp.com";
const REPO = "/repos/mycarcorp/my-car-revamp";
const ENV = { google_search_console: "GOOGLE_SEARCH_CONSOLE_API_KEY", github: "GITHUB_API_KEY", semrush: "SEMRUSH_API_KEY" } as const;
type Connector = keyof typeof ENV;
const now = () => new Date().toISOString();
export async function requireMarketingStaff() {
  const token = getRequest().headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Not signed in.");
  const { requireStaff } = await import("./legacy-blog.server");
  return requireStaff(token);
}
function storageHeaders() { const { key } = appAdminCreds(); return { apikey: key, ...(key.split(".").length === 3 ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json" }; }
async function storage(path: string, init: RequestInit = {}) { const { url } = appAdminCreds(); return fetch(`${url}/storage/v1/${path}`, { ...init, headers: { ...storageHeaders(), ...init.headers }, signal: AbortSignal.timeout(25000) }); }
async function ensureStorage() {
  const found = await storage(`bucket/${BUCKET}`);
  if (found.ok) { const b = await found.json() as { public?: boolean }; if (b.public) throw new Error("Marketing storage must be private."); return; }
  if (found.status !== 404 && found.status !== 400) throw new Error(`Marketing storage unavailable (${found.status}).`);
  const created = await storage("bucket", { method: "POST", body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: 5242880 }) });
  if (!created.ok) throw new Error(`Could not prepare private marketing storage (${created.status}).`);
}
async function readObject<T>(key: string, fallback: T): Promise<T> {
  const response = await storage(`object/authenticated/${BUCKET}/${key}`);
  if (response.status === 404 || response.status === 400) return fallback;
  if (!response.ok) throw new Error(`Could not read marketing records (${response.status}).`);
  return await response.json() as T;
}
async function writeObject(key: string, value: unknown) {
  await ensureStorage();
  const response = await storage(`object/${BUCKET}/${key}`, { method: "POST", headers: { "x-upsert": "true", "Cache-Control": "no-store" }, body: JSON.stringify(value) });
  if (!response.ok) throw new Error(`Could not save marketing records (${response.status}).`);
}
export async function readMarketing() {
  const defaults = emptySnapshot();
  const [search, research, lighthouse, website, config, listing] = await Promise.all([
    readObject("search.json", defaults.search), readObject("research.json", defaults.research), readObject("lighthouse.json", defaults.lighthouse), readObject("website.json", defaults.website),
    readObject<{ property: string | null }>("config.json", { property: null }),
    storage(`object/list/${BUCKET}`, { method: "POST", body: JSON.stringify({ prefix: "prospects", limit: 1000, sortBy: { column: "name", order: "asc" } }) }),
  ]);
  let prospects: Prospect[] = [];
  if (listing.ok) { const objects = await listing.json() as { name: string }[]; prospects = (await Promise.all(objects.filter((o) => o.name.endsWith(".json")).map((o) => readObject<Prospect | null>(`prospects/${o.name}`, null)))).filter((p): p is Prospect => Boolean(p)); }
  else if (listing.status !== 404 && listing.status !== 400) throw new Error(`Could not list outreach records (${listing.status}).`);
  return { snapshot: { search, research, lighthouse, website }, property: config.property, prospects, configured: { search: Boolean(process.env[ENV.google_search_console]), research: Boolean(process.env[ENV.semrush]), lighthouse: Boolean(process.env[ENV.github]) } };
}
async function gateway(connector: Connector, path: string, body?: unknown): Promise<Response> {
  const apiKey = process.env[ENV[connector]], lovable = process.env["LOVABLE_API_KEY"];
  if (!apiKey || !lovable) throw new Error(`${connector} is not connected.`);
  const response = await fetch(`https://connector-gateway.lovable.dev/${connector}${path}`, {
    method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": apiKey, "Content-Type": "application/json", ...(connector === "github" ? { Accept: "application/vnd.github+json" } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000), redirect: "manual",
  });
  if (!response.ok && response.status !== 302) { const text = await response.text(); console.error(`[marketing:${connector}] HTTP ${response.status}`, text.slice(0, 2000)); throw new Error(`${connector} report failed [${response.status}]: ${text.slice(0, 500)}`); }
  return response;
}
async function api<T>(c: Connector, path: string, body?: unknown): Promise<T> {
  const response = await gateway(c, path, body); const value = await response.json() as T & { error?: unknown; status?: number };
  if (value.error || (value.status && value.status >= 400)) { console.error(`[marketing:${c}]`, value.status, value.error); throw new Error(`${c} report failed [${value.status ?? 200}]: ${String(value.error)}`); }
  return value;
}
async function searchReport(choice: string | null): Promise<SearchReport> {
  const sites = await api<{ siteEntry?: { siteUrl: string; permissionLevel?: string }[] }>("google_search_console", "/webmasters/v3/sites");
  const resolution = resolveProperty(sites.siteEntry ?? [], choice);
  if (!resolution.selected) { if (!resolution.candidates.length) throw new Error("No verified property covers https://mycarcorp.com/."); return { siteUrl: null, candidates: resolution.candidates }; }
  const siteUrl = resolution.selected;
  // Every refresh re-lists and validates the exact selection before any per-site call.
  const end = new Date(Date.now() - 3 * 86400000), start = new Date(end.getTime() - 27 * 86400000);
  const startDate = start.toISOString().slice(0, 10), endDate = end.toISOString().slice(0, 10);
  const base = `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}`;
  const query = async (dimensions: string[]) => api<{ rows?: SearchRow[] }>("google_search_console", `${base}/searchAnalytics/query`, { startDate, endDate, dimensions, rowLimit: dimensions.length ? 100 : 1, type: "web", dataState: "final" });
  // Stop the batch on an access or quota error; never auto-retry.
  const totals = await query([]), keywords = await query(["query"]), pages = await query(["page"]);
  const sitemaps = await api<{ sitemap?: SearchReport["sitemaps"] }>("google_search_console", `${base}/sitemaps`);
  return { siteUrl, candidates: resolution.candidates, startDate, endDate, totals: totals.rows?.[0], keywords: keywords.rows ?? [], pages: pages.rows ?? [], sitemaps: sitemaps.sitemap ?? [] };
}
async function semrushTable(path: string): Promise<SemrushTable> {
  const report = await api<{ data?: SemrushTable }>("semrush", path);
  if (!Array.isArray(report.data?.columnNames) || !Array.isArray(report.data?.rows)) throw new Error("Semrush returned an unsupported report format.");
  return { columnNames: report.data.columnNames, rows: report.data.rows.slice(0, 100) };
}
async function researchReport(): Promise<ResearchReport> {
  const domains = await semrushTable("/backlinks/backlinks_refdomains?target=mycarcorp.com&target_type=root_domain&export_columns=domain,domain_ascore,backlinks_num&display_limit=10");
  const backlinks = await semrushTable("/backlinks/backlinks?target=mycarcorp.com&target_type=root_domain&export_columns=page_ascore,source_title,source_url,target_url&display_limit=10");
  const keywords = await semrushTable("/domains/domain_organic?domain=mycarcorp.com&database=us&export_columns=Ph,Po,Nq,Ur&display_limit=10");
  return { domains, backlinks, keywords };
}
async function lighthouseReport(): Promise<LighthouseReport> {
  const response = await api<{ workflow_runs?: { id: number; html_url: string; conclusion: string | null }[] }>("github", `${REPO}/actions/workflows/lighthouse.yml/runs?per_page=5`);
  const run = response.workflow_runs?.[0];
  if (!run) return { runUrl: null, conclusion: null, audits: [], artifactAvailable: false };
  const artifacts = await api<{ artifacts?: { id: number; name: string; expired: boolean; size_in_bytes: number }[] }>("github", `${REPO}/actions/runs/${run.id}/artifacts`);
  const artifact = artifacts.artifacts?.find((a) => a.name === "lighthouse-reports" && !a.expired);
  if (!artifact) return { runUrl: run.html_url, conclusion: run.conclusion, audits: [], artifactAvailable: false };
  if (artifact.size_in_bytes > 25000000) throw new Error("Lighthouse archive exceeds the safe report size.");
  let archive = await gateway("github", `${REPO}/actions/artifacts/${artifact.id}/zip`);
  if (archive.status === 302) { const location = archive.headers.get("location"); if (!location || new URL(location).protocol !== "https:") throw new Error("Invalid Lighthouse archive location."); archive = await fetch(location, { signal: AbortSignal.timeout(30000) }); }
  if (!archive.ok) throw new Error(`Could not read Lighthouse archive (${archive.status}).`);
  const bytes = new Uint8Array(await archive.arrayBuffer()); if (bytes.length > 25000000) throw new Error("Lighthouse archive exceeds the safe report size.");
  let totalSize = 0;
  const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) => unzip(bytes, { filter: (file) => { const include = file.name.endsWith(".json") && file.originalSize <= 5000000; if (include) totalSize += file.originalSize; return include && totalSize <= 30000000; } }, (error, result) => error ? reject(error) : resolve(result)));
  const audits: LighthouseReport["audits"] = [];
  for (const bytes of Object.values(files)) {
    if (!(bytes instanceof Uint8Array)) continue;
    try { const report = JSON.parse(new TextDecoder().decode(bytes)); if (!report.categories || !report.finalUrl) continue;
      const score = (key: string) => { const v = report.categories[key]?.score; return typeof v === "number" ? Math.round(v * 100) : null; };
      if (report.runtimeError) continue;
      audits.push({ url: String(report.finalUrl), date: String(report.fetchTime ?? ""), performance: score("performance"), accessibility: score("accessibility"), seo: score("seo"), bestPractices: score("best-practices") });
    } catch { /* Non-LHR JSON files in the artifact are not scores. */ }
  }
  return { runUrl: run.html_url, conclusion: run.conclusion, audits, artifactAvailable: true };
}
async function websiteReport(): Promise<SiteHealth> {
  const fetchPage = (path: string) => fetch(`${ORIGIN}${path}`, { signal: AbortSignal.timeout(25000) });
  const [sitemap, robots, homepage] = await Promise.all([fetchPage("/sitemap.xml"), fetchPage("/robots.txt"), fetchPage("/")]);
  const [xml, txt, html] = await Promise.all([sitemap.text(), robots.text(), homepage.text()]);
  const locations = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map((m) => m[1] ?? "");
  const [{ listAutoseoPosts }, { listPublishedPosts }] = await Promise.all([import("./autoseo-blog.server"), import("./legacy-blog.server")]);
  const auto = await listAutoseoPosts(true), manual = await listPublishedPosts();
  return { sitemap: { status: sitemap.status, urls: locations.length, sameOriginUrls: locations.filter((v) => v.startsWith(`${ORIGIN}/`)).length },
    robots: { status: robots.status, blocksAll: /User-agent:\s*\*[\s\S]*?Disallow:\s*\/(?:\s|$)/i.test(txt), sitemapDeclared: txt.includes(`${ORIGIN}/sitemap.xml`) },
    metadata: { status: homepage.status, title: html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? null, description: /name=["']description["']/i.test(html), verificationTag: /name=["']google-site-verification["']/i.test(html) },
    articles: mergeArticles(auto.map((a) => ({ slug: a.slug, title: a.title, publishedAt: a.published_at, source: "AutoSEO" })), manual.map((a) => ({ slug: a.slug, title: a.title, publishedAt: a.published_at, source: "Manual" }))), autoSeoTokenConfigured: Boolean(process.env["AUTOSEO_WEBHOOK_TOKEN"]) };
}
export async function refreshMarketing(service: keyof MarketingSnapshot, property?: string | null) {
  const defaults = emptySnapshot(); const previous = await readObject(`${service}.json`, defaults[service]);
  const config = await readObject<{ property: string | null }>("config.json", { property: null });
  let report: ServiceReport;
  const connector = service === "search" ? "google_search_console" : service === "research" ? "semrush" : service === "lighthouse" ? "github" : null;
  if (connector && !process.env[ENV[connector]]) report = { state: "Not Connected", checkedAt: now(), message: `${connector} is not connected.`, data: null };
  else try {
    const data = service === "search" ? await searchReport(property ?? config.property) : service === "research" ? await researchReport() : service === "lighthouse" ? await lighthouseReport() : await websiteReport();
    if (service === "search" && property) await writeObject("config.json", { property });
    report = { state: "Connected", checkedAt: now(), message: service === "search" && !(data as SearchReport).siteUrl ? "Select a verified property to load reports." : "Last successful report saved.", data };
  } catch (error) { report = { state: "Error", checkedAt: now(), data: previous.data, message: error instanceof Error ? error.message : "Report unavailable." }; }
  await writeObject(`${service}.json`, report); return report;
}
export async function saveProspect(input: ProspectInput, userId: string): Promise<Prospect> { const record = { ...input, domain: input.domain.toLowerCase(), id: input.id ?? crypto.randomUUID(), updatedAt: now(), updatedBy: userId }; await writeObject(`prospects/${record.id}.json`, record); return record; }
export async function removeProspect(id: string) { const response = await storage(`object/${BUCKET}`, { method: "DELETE", body: JSON.stringify({ prefixes: [`prospects/${id}.json`] }) }); if (!response.ok) throw new Error(`Could not remove outreach record (${response.status}).`); }