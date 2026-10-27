import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AutoseoRestError,
  getAutoseoPost,
  getAutoseoPostPublic,
  isMissingColumnError,
  listAutoseoPosts,
  listAutoseoPostsPublic,
  sitemapUrls,
} from "./autoseo-blog.server";
import { getPublishedPost, listPublishedPosts } from "./legacy-blog.server";

const read = (path: string) => readFileSync(path, "utf8");

/* -------------------------------------------------------------------------- */
/* A synthetic PostgREST stand-in. All records are invented test data.         */
/* -------------------------------------------------------------------------- */

type Row = Record<string, unknown>;

const ROWS: Row[] = [
  { id: 1, title: "Approved and published", slug: "approved-published", status: "published", quality_status: "approved", published_at: "2026-01-10T00:00:00Z", updated_at: "2026-01-11T00:00:00Z", created_at: "2026-01-10T00:00:00Z", meta_keywords: "alpha topic", tags: "" },
  { id: 2, title: "Draft that was approved", slug: "draft-approved", status: "draft", quality_status: "approved", published_at: "2026-02-01T00:00:00Z", updated_at: null, created_at: null, meta_keywords: "bravo topic", tags: "" },
  { id: 3, title: "Published but held for review", slug: "published-held", status: "published", quality_status: "needs_review", published_at: "2026-02-02T00:00:00Z", updated_at: null, created_at: null, meta_keywords: "charlie topic", tags: "" },
  { id: 4, title: "Published with no approval recorded", slug: "published-no-approval", status: "published", quality_status: null, published_at: "2026-02-03T00:00:00Z", updated_at: null, created_at: null, meta_keywords: "delta topic", tags: "" },
  { id: 5, title: "Draft held for review", slug: "draft-held", status: "draft", quality_status: "needs_review", published_at: "2026-02-04T00:00:00Z", updated_at: null, created_at: null, meta_keywords: "echo topic", tags: "" },
  { id: 6, title: "Approved, published, no publish date", slug: "no-publish-date", status: "published", quality_status: "approved", published_at: null, updated_at: null, created_at: null, meta_keywords: "foxtrot topic", tags: "" },
];

const UNSAFE_SLUGS = ["draft-approved", "published-held", "published-no-approval", "draft-held", "no-publish-date"];

type Call = { url: string; authorization: string | null; table: string };

let calls: Call[] = [];
let missingColumns = new Set<string>();
/** Decides a response before the table is read; return null to continue normally. */
let intercept: ((call: Call, index: number) => Response | Promise<Response> | null) | null = null;

const failure = (status: number, body: Record<string, unknown> | string = "boom") =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status });

function installFakeDatabase(tableRows: Record<string, Row[]> = { blog_posts: ROWS }) {
  calls = [];
  missingColumns = new Set();
  intercept = null;
  process.env["LEGACY_SUPABASE_URL"] = "https://example.test";
  process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"] = "synthetic-test-key";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      const table = url.pathname.split("/").pop() ?? "";
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const call: Call = { url: String(input), authorization: headers["Authorization"] ?? null, table };
      calls.push(call);
      const injected = intercept?.(call, calls.length - 1);
      if (injected) return injected;

      const select = (url.searchParams.get("select") ?? "*").split(",");
      const referenced = [...select, ...[...url.searchParams.keys()].filter((k) => !["select", "order", "limit"].includes(k))];
      const missing = referenced.find((column) => missingColumns.has(column));
      if (missing) return failure(400, { code: "42703", message: `column ${table}.${missing} does not exist` });

      let rows = [...(tableRows[table] ?? [])];
      for (const [key, value] of url.searchParams) {
        if (["select", "order", "limit"].includes(key)) continue;
        if (value.startsWith("eq.")) rows = rows.filter((r) => String(r[key]) === decodeURIComponent(value.slice(3)));
        else if (value === "not.is.null") rows = rows.filter((r) => r[key] !== null && r[key] !== undefined);
      }
      const limit = Number(url.searchParams.get("limit") ?? "");
      if (Number.isFinite(limit) && limit > 0) rows = rows.slice(0, limit);
      const project = (r: Row) => (select.includes("*") ? r : Object.fromEntries(select.filter((c) => c in r).map((c) => [c, r[c]])));
      return new Response(JSON.stringify(rows.map(project)), { status: 200 });
    }),
  );
}

beforeEach(() => {
  installFakeDatabase();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env["LEGACY_SUPABASE_URL"];
  delete process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"];
});

const STRICT = "status=eq.published&quality_status=eq.approved&published_at=not.is.null";
const isStrict = (c: Call) => c.url.includes(STRICT);

/* -------------------------------------------------------------------------- */
/* Eligibility                                                                 */
/* -------------------------------------------------------------------------- */

describe("only published, approved articles with a publish date are public", () => {
  it("blog index and list: only the eligible article is returned", async () => {
    const posts = await listAutoseoPosts(true);
    expect(posts.map((p) => p.slug)).toEqual(["approved-published"]);
    expect((await listAutoseoPostsPublic()).map((p) => p.slug)).toEqual(["approved-published"]);
  });

  it("single article: the eligible one is found; drafts, held, unapproved and undated ones are not", async () => {
    expect((await getAutoseoPost("approved-published"))?.slug).toBe("approved-published");
    for (const slug of [...UNSAFE_SLUGS, "does-not-exist"]) expect(await getAutoseoPost(slug), slug).toBeNull();
    for (const slug of UNSAFE_SLUGS) expect(await getAutoseoPostPublic(slug), slug).toBeNull();
  });

  it("sitemap: only the eligible article is listed, with its real update time", async () => {
    expect(await sitemapUrls()).toEqual([{ slug: "approved-published", lastmod: "2026-01-11T00:00:00Z" }]);
  });

  it("a published article whose approval was never recorded stays hidden", async () => {
    expect((await listAutoseoPosts()).map((p) => p.slug)).not.toContain("published-no-approval");
  });

  it("every request is the strict one when the database is healthy", async () => {
    await listAutoseoPosts();
    await getAutoseoPost("approved-published");
    await sitemapUrls();
    expect(calls).toHaveLength(3);
    expect(calls.every(isStrict)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Failures never widen what is public                                         */
/* -------------------------------------------------------------------------- */

describe("a failed request never exposes draft or unapproved articles", () => {
  it("a brief outage is retried with the same strict query and still returns only eligible articles", async () => {
    intercept = (_call, index) => (index === 0 ? failure(503) : null);
    const posts = await listAutoseoPosts();
    expect(posts.map((p) => p.slug)).toEqual(["approved-published"]);
    expect(calls).toHaveLength(2);
    expect(calls.every(isStrict)).toBe(true);
  });

  it("when the first two requests fail, no weaker query is ever sent, even though later requests would succeed", async () => {
    intercept = (_call, index) => (index < 2 ? failure(503) : null);
    await expect(listAutoseoPosts()).rejects.toBeInstanceOf(AutoseoRestError);
    expect(calls).toHaveLength(2);
    expect(calls.every(isStrict)).toBe(true);
    // Once the outage is over, the strict query succeeds again and still returns only the eligible article.
    expect((await listAutoseoPostsPublic()).map((p) => p.slug)).toEqual(["approved-published"]);
    expect(calls.every(isStrict)).toBe(true);
  });

  it("a persistent outage returns nothing for the list and the sitemap, and never a weaker result", async () => {
    intercept = () => failure(503);
    expect(await listAutoseoPostsPublic(true)).toEqual([]);
    await expect(sitemapUrls()).rejects.toBeInstanceOf(AutoseoRestError);
    expect(calls.every(isStrict)).toBe(true);
  });

  it("a failed article lookup is an error (5xx), not a 404, with no database details for the visitor", async () => {
    intercept = () => failure(503, { code: "XX000", message: "internal table blog_posts details", hint: "secret hint" });
    const error = await getAutoseoPostPublic("approved-published").catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("This article is temporarily unavailable.");
    expect((error as Error).message).not.toMatch(/503|blog_posts|AutoSEO blog request|secret|XX000/);
    expect(calls.every(isStrict)).toBe(true);
  });

  it("a missing article is still null (404), distinct from a failed lookup", async () => {
    await expect(getAutoseoPostPublic("does-not-exist")).resolves.toBeNull();
  });

  it("a network failure is retried once and then fails closed", async () => {
    intercept = () => {
      throw new TypeError("fetch failed");
    };
    await expect(listAutoseoPosts()).rejects.toBeInstanceOf(TypeError);
    expect(calls).toHaveLength(2);
    expect(await listAutoseoPostsPublic()).toEqual([]);
  });

  it("a transient clock-skew authentication rejection is retried without the bearer token and then succeeds", async () => {
    intercept = (_call, index) => (index === 0 ? failure(401, { code: "PGRST303", message: "JWT issued at future" }) : null);
    const posts = await listAutoseoPosts();
    expect(posts.map((p) => p.slug)).toEqual(["approved-published"]);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.authorization).toMatch(/^Bearer /);
    expect(calls[1]!.authorization).toBeNull();
    expect(calls.every(isStrict)).toBe(true);
  });

  it("a persistent authentication failure fails closed", async () => {
    intercept = () => failure(401, { code: "PGRST303", message: "JWT issued at future" });
    expect(await listAutoseoPostsPublic()).toEqual([]);
    expect(calls.every(isStrict)).toBe(true);
  });

  it("a real permission error is not retried and does not weaken the query", async () => {
    intercept = () => failure(403, { code: "42501", message: "permission denied for table blog_posts" });
    await expect(listAutoseoPosts()).rejects.toBeInstanceOf(AutoseoRestError);
    expect(calls).toHaveLength(1);
  });

  it("a rate limit is retried once", async () => {
    intercept = (_call, index) => (index === 0 ? failure(429) : null);
    expect((await listAutoseoPosts()).map((p) => p.slug)).toEqual(["approved-published"]);
    expect(calls).toHaveLength(2);
  });
});

/* -------------------------------------------------------------------------- */
/* Older schemas keep working                                                  */
/* -------------------------------------------------------------------------- */

describe("older databases without the gate columns keep working as before", () => {
  it("without quality_status, the published-only query is used and drafts are still excluded", async () => {
    missingColumns = new Set(["quality_status"]);
    const slugs = (await listAutoseoPosts()).map((p) => p.slug).sort();
    // Published rows with a publish date: the old schema has no approval concept to apply.
    expect(slugs).toEqual(["approved-published", "published-held", "published-no-approval"]);
    expect(slugs).not.toContain("draft-held");
    expect(slugs).not.toContain("draft-approved");
    expect(await getAutoseoPost("draft-held")).toBeNull();
  });

  it("without a status column either, the oldest schema's query is used", async () => {
    missingColumns = new Set(["quality_status", "status"]);
    expect((await listAutoseoPosts()).length).toBe(5);
    expect((await sitemapUrls()).length).toBe(5);
  });

  it("an error about any other column is not treated as an older schema, so nothing falls back", async () => {
    missingColumns = new Set(["faq_schema"]);
    await expect(listAutoseoPosts()).rejects.toBeInstanceOf(AutoseoRestError);
    expect(calls.every(isStrict)).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("only a 400 that names a gate column counts as a missing column", () => {
    const missing = (status: number, code: string | null, message: string) => new AutoseoRestError(message, status, code);
    expect(isMissingColumnError(missing(400, "42703", "column blog_posts.quality_status does not exist"), "quality_status")).toBe(true);
    expect(isMissingColumnError(missing(400, "PGRST204", "Could not find the 'quality_status' column of 'blog_posts'"), "quality_status")).toBe(true);
    expect(isMissingColumnError(missing(400, "42703", "column blog_posts.quality_status does not exist"), "status")).toBe(false);
    expect(isMissingColumnError(missing(400, "42703", "column blog_posts.status does not exist"), "status")).toBe(true);
    expect(isMissingColumnError(missing(503, "42703", "column quality_status does not exist"), "quality_status")).toBe(false);
    expect(isMissingColumnError(missing(400, "PGRST100", "quality_status"), "quality_status")).toBe(false);
    expect(isMissingColumnError(new TypeError("quality_status"), "quality_status")).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Hand-written articles and routing are untouched                             */
/* -------------------------------------------------------------------------- */

describe("hand-written articles and consolidation redirects", () => {
  const LEGACY_ROWS: Row[] = [
    { id: 1, title: "Published legacy", slug: "legacy-published", status: "published", published_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z" },
    { id: 2, title: "Draft legacy", slug: "legacy-draft", status: "draft", published_at: null, created_at: "2026-01-02T00:00:00Z" },
  ];

  it("only published hand-written posts are listed or found, exactly as before", async () => {
    installFakeDatabase({ mc_blog: LEGACY_ROWS });
    expect((await listPublishedPosts()).map((p) => p.slug)).toEqual(["legacy-published"]);
    expect((await getPublishedPost("legacy-published"))?.slug).toBe("legacy-published");
    expect(await getPublishedPost("legacy-draft")).toBeNull();
    expect(calls.every((c) => c.url.includes("status=eq.published"))).toBe(true);
  });

  it("the article page keeps its 404 for ineligible articles and its 301 to the established URL", () => {
    const route = read("src/routes/blog.$slug.tsx");
    expect(route).toMatch(/if \(!article\) throw notFound\(\);/);
    expect(route).toMatch(/throw redirect\(\{[\s\S]*?statusCode:\s*301/);
    expect(route).toContain("const owner = getIntentOwner(article, all);");
  });

  it("the blog index and sitemap still use the gated reads and keep one URL per intent", async () => {
    expect(read("src/routes/blog.index.tsx")).toContain("dedupeAutoseoByIntent(rawArticles)");
    expect(read("src/lib/sitemap-cache.server.ts")).toContain("m.sitemapUrls()");
    const rows = [
      { ...ROWS[0]!, id: 11, slug: "older", title: "Used car test drive checklist", meta_keywords: "test drive checklist", published_at: "2026-01-01T00:00:00Z" },
      { ...ROWS[0]!, id: 12, slug: "newer-overlap", title: "Used car test drive checklist guide", meta_keywords: "test drive checklist", published_at: "2026-03-01T00:00:00Z" },
    ];
    installFakeDatabase({ blog_posts: rows });
    expect((await sitemapUrls()).map((u) => u.slug)).toEqual(["older"]);
  });
});

/* -------------------------------------------------------------------------- */
/* The webhook and publishing behavior are not part of this change             */
/* -------------------------------------------------------------------------- */

describe("public read changes do not alter the webhook or publishing", () => {
  const server = read("src/lib/autoseo-blog.server.ts");
  const functions = read("src/lib/autoseo-blog.functions.ts");

  it("public functions use the fail-closed wrappers and no longer turn an error into a 404", () => {
    expect(functions).toContain("m.listAutoseoPostsPublic()");
    expect(functions).toContain("m.listAutoseoPostsPublic(true)");
    expect(functions).toContain("return m.getAutoseoPostPublic(data.slug);");
    const post = functions.slice(functions.indexOf("export const publicAutoseoPost"), functions.indexOf("ADMIN LIST"));
    expect(post).not.toMatch(/catch\s*\{\s*return null/);
  });

  it("the ingestion path is unchanged: same upsert, quality gate, draft rule and sitemap invalidation", () => {
    expect(server).toContain('await rest("blog_posts?on_conflict=id", {');
    expect(server).toContain('quality.status === "approved" && (text(body["status"]) ?? "published") === "published" ? "published" : "draft"');
    expect(server).toContain("invalidateSitemapCache()");
    expect(server).toContain("seo_indexable: seoIndexable && quality.status === \"approved\"");
  });

  it("retries are limited to read queries: writes still go through rest() once", () => {
    expect(server).toContain("async function restRead(path: string)");
    const upsert = server.slice(server.indexOf("async function upsertRow"), server.indexOf("export async function upsertAutoseoArticle"));
    expect(upsert).not.toContain("restRead(");
  });
});
