// Server-only sitemap builder with an in-memory cache.
// Crawlers always get valid XML fast: a fresh cached copy is served immediately,
// and a slow/failing database never turns into a timeout, a 500 or an empty file.

const SITE_ORIGIN = "https://mycarcorp.com";
const FRESH_MS = 10 * 60 * 1000; // serve cached XML without touching the database
const BUILD_TIMEOUT_MS = 4000; // never let a slow query hold a crawler

const STATIC_PAGES: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/search", priority: "0.9", changefreq: "daily" },
  { path: "/blog", priority: "0.8", changefreq: "daily" },
  { path: "/finance", priority: "0.7", changefreq: "monthly" },
  { path: "/sell", priority: "0.7", changefreq: "monthly" },
  { path: "/schedule", priority: "0.6", changefreq: "monthly" },
  { path: "/contact", priority: "0.6", changefreq: "monthly" },
];

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** W3C / ISO 8601 date, or null when the stored value isn't a real date. */
function isoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function urlEntry(path: string, lastmod: string | null, changefreq: string, priority: string) {
  const mod = lastmod ? `<lastmod>${escape(lastmod)}</lastmod>` : "";
  return `<url><loc>${SITE_ORIGIN}${escape(path)}</loc>${mod}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

function wrap(entries: string[]): string {
  const ns = "http://www.sitemaps.org/schemas/sitemap/0.9";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${ns}">${entries.join("")}</urlset>`;
}

function staticOnlyXml(): string {
  return wrap(STATIC_PAGES.map((p) => urlEntry(p.path, null, p.changefreq, p.priority)));
}

async function collectBlogUrls(): Promise<Array<{ slug: string; lastmod: string | null }>> {
  const bySlug = new Map<string, string | null>();

  const sources: Array<() => Promise<Array<{ slug: string; lastmod: string | null }>>> = [
    async () => {
      const m = await import("./autoseo-blog.server");
      return await m.sitemapUrls();
    },
    async () => {
      const m = await import("./legacy-blog.server");
      const posts = await m.listPublishedPosts();
      return posts.map((p) => ({ slug: p.slug, lastmod: p.updated_at ?? p.published_at ?? null }));
    },
  ];

  const results = await Promise.allSettled(sources.map((run) => run()));
  let anyOk = false;
  for (const result of results) {
    if (result.status !== "fulfilled") {
      console.error("[sitemap] a blog source was unavailable", result.reason);
      continue;
    }
    anyOk = true;
    for (const row of result.value) {
      const slug = String(row.slug ?? "").trim();
      if (!slug) continue;
      if (!bySlug.has(slug)) bySlug.set(slug, isoDate(row.lastmod));
    }
  }
  if (!anyOk) throw new Error("No blog source responded");

  return [...bySlug.entries()].map(([slug, lastmod]) => ({ slug, lastmod }));
}

async function buildXml(): Promise<string> {
  const entries = STATIC_PAGES.map((p) => urlEntry(p.path, null, p.changefreq, p.priority));
  for (const post of await collectBlogUrls()) {
    entries.push(urlEntry(`/blog/${post.slug}`, post.lastmod, "weekly", "0.7"));
  }
  return wrap(entries);
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`sitemap build timed out after ${ms}ms`)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

type Cache = { xml: string; at: number };
let cache: Cache | null = null;

/** Always resolves with valid sitemap XML. */
export async function getSitemapXml(): Promise<{ xml: string; cached: boolean }> {
  const now = Date.now();
  if (cache && now - cache.at < FRESH_MS) return { xml: cache.xml, cached: true };

  try {
    const xml = await withTimeout(buildXml(), BUILD_TIMEOUT_MS);
    cache = { xml, at: Date.now() };
    return { xml, cached: false };
  } catch (error) {
    console.error("[sitemap] rebuild failed; serving last known sitemap", error);
    if (cache) return { xml: cache.xml, cached: true };
    return { xml: staticOnlyXml(), cached: false };
  }
}

/** Drop the cache so the next request rebuilds from the database. */
export function invalidateSitemapCache(): void {
  cache = null;
}
