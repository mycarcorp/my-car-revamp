// Server-only sitemap builder with an in-memory cache.
//
// Includes:
// - Static website pages
// - Published blog posts
// - Every live vehicle VDP from the legacy inventory
//
// Crawlers always receive valid XML. A cached copy can be served immediately,
// and a slow/failing source will not intentionally produce an empty sitemap.

const SITE_ORIGIN = "https://mycarcorp.com";

const FRESH_MS = 10 * 60 * 1000;

// Inventory + multiple blog sources may take longer than the previous
// 4-second limit, so allow a little more time for a complete rebuild.
const BUILD_TIMEOUT_MS = 10_000;

const STATIC_PAGES: Array<{
  path: string;
  priority: string;
  changefreq: string;
}> = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/search", priority: "0.9", changefreq: "daily" },
  { path: "/blog", priority: "0.8", changefreq: "daily" },
  { path: "/finance", priority: "0.7", changefreq: "monthly" },
  { path: "/sell", priority: "0.7", changefreq: "monthly" },
  { path: "/lease-to-own", priority: "0.7", changefreq: "monthly" },
  { path: "/schedule", priority: "0.6", changefreq: "monthly" },
  { path: "/contact", priority: "0.6", changefreq: "monthly" },
];

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Return a valid W3C / ISO 8601 date.
 * Invalid or missing dates are omitted from the sitemap.
 */
function isoDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const d = new Date(value);

  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Build one sitemap URL entry.
 */
function urlEntry(path: string, lastmod: string | null, changefreq: string, priority: string) {
  const mod = lastmod ? `<lastmod>${escape(lastmod)}</lastmod>` : "";

  return `<url><loc>${SITE_ORIGIN}${escape(
    path,
  )}</loc>${mod}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

/**
 * Wrap URL entries in a valid sitemap document.
 */
function wrap(entries: string[]): string {
  const ns = "http://www.sitemaps.org/schemas/sitemap/0.9";

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${ns}">${entries.join("")}</urlset>`;
}

/**
 * Emergency fallback sitemap.
 *
 * This is only used when a full sitemap has never been cached and
 * rebuilding fails completely.
 */
function staticOnlyXml(): string {
  return wrap(STATIC_PAGES.map((p) => urlEntry(p.path, null, p.changefreq, p.priority)));
}

/**
 * Collect published blog URLs from both blog systems.
 *
 * Duplicate slugs are removed so Google receives one canonical URL
 * per article.
 */
async function collectBlogUrls(): Promise<
  Array<{
    slug: string;
    lastmod: string | null;
  }>
> {
  const bySlug = new Map<string, string | null>();

  const sources: Array<
    () => Promise<
      Array<{
        slug: string;
        lastmod: string | null;
      }>
    >
  > = [
    async () => {
      const m = await import("./autoseo-blog.server");

      return await m.sitemapUrls();
    },

    async () => {
      const m = await import("./legacy-blog.server");

      const posts = await m.listPublishedPosts();

      return posts.map((p) => ({
        slug: p.slug,
        lastmod: p.updated_at ?? p.published_at ?? null,
      }));
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

      if (!slug) {
        continue;
      }

      if (!bySlug.has(slug)) {
        bySlug.set(slug, isoDate(row.lastmod));
      }
    }
  }

  if (!anyOk) {
    throw new Error("No blog source responded");
  }

  return [...bySlug.entries()].map(([slug, lastmod]) => ({
    slug,
    lastmod,
  }));
}

/**
 * Collect every live public vehicle from the same legacy inventory
 * source used by the public MyCar inventory pages.
 *
 * listPublicLegacyInventory() already limits public inventory to
 * vehicles that are allowed to appear publicly.
 */
async function collectVehicleUrls(): Promise<
  Array<{
    slug: string;
    lastmod: string | null;
  }>
> {
  const { listPublicLegacyInventory } = await import("./legacy-inventory.server");

  const data = await listPublicLegacyInventory({
    page: 1,
    pageSize: 10000,
  });

  const bySlug = new Map<string, string | null>();

  for (const vehicle of data.vehicles ?? []) {
    const slug = String(vehicle.slug ?? "").trim();

    if (!slug) {
      continue;
    }

    /*
     * Different inventory sources may expose different timestamp
     * fields. Use the best available real timestamp without
     * fabricating one.
     */
    const row = vehicle as unknown as Record<string, unknown>;

    const possibleLastmod =
      row["updated_at"] ?? row["modified_at"] ?? row["date_updated"] ?? row["date_received"] ?? row["created_at"] ?? null;

    const lastmod = typeof possibleLastmod === "string" ? isoDate(possibleLastmod) : null;

    if (!bySlug.has(slug)) {
      bySlug.set(slug, lastmod);
    }
  }

  return [...bySlug.entries()].map(([slug, lastmod]) => ({
    slug,
    lastmod,
  }));
}

/**
 * Build the complete sitemap.
 *
 * Blog and inventory data are collected concurrently so the sitemap
 * does not wait for one source before starting the other.
 */
async function buildXml(): Promise<string> {
  const entries = STATIC_PAGES.map((p) => urlEntry(p.path, null, p.changefreq, p.priority));

  const [blogResult, vehicleResult] = await Promise.allSettled([collectBlogUrls(), collectVehicleUrls()]);

  /**
   * BLOG URLs
   */
  if (blogResult.status === "fulfilled") {
    for (const post of blogResult.value) {
      entries.push(urlEntry(`/blog/${encodeURIComponent(post.slug)}`, post.lastmod, "weekly", "0.7"));
    }
  } else {
    console.error("[sitemap] blog URLs unavailable", blogResult.reason);
  }

  /**
   * VEHICLE DETAIL PAGE URLs
   */
  if (vehicleResult.status === "fulfilled") {
    for (const vehicle of vehicleResult.value) {
      entries.push(urlEntry(`/inventory/${encodeURIComponent(vehicle.slug)}`, vehicle.lastmod, "daily", "0.8"));
    }
  } else {
    console.error("[sitemap] vehicle URLs unavailable", vehicleResult.reason);
  }

  /*
   * A temporary failure in one source should not remove the
   * successfully loaded URLs from the other source.
   */
  return wrap(entries);
}

/**
 * Prevent a database/API issue from holding the sitemap request
 * indefinitely.
 */
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

type Cache = {
  xml: string;
  at: number;
};

let cache: Cache | null = null;

/**
 * Always resolve with valid sitemap XML.
 */
export async function getSitemapXml(): Promise<{
  xml: string;
  cached: boolean;
}> {
  const now = Date.now();

  /*
   * Serve a fresh cached sitemap without rebuilding.
   */
  if (cache && now - cache.at < FRESH_MS) {
    return {
      xml: cache.xml,
      cached: true,
    };
  }

  try {
    const xml = await withTimeout(buildXml(), BUILD_TIMEOUT_MS);

    cache = {
      xml,
      at: Date.now(),
    };

    return {
      xml,
      cached: false,
    };
  } catch (error) {
    console.error("[sitemap] rebuild failed; serving last known sitemap", error);

    /*
     * If a previous complete sitemap exists, keep serving it.
     */
    if (cache) {
      return {
        xml: cache.xml,
        cached: true,
      };
    }

    /*
     * Last-resort fallback.
     */
    return {
      xml: staticOnlyXml(),
      cached: false,
    };
  }
}

/**
 * Drop the in-memory sitemap cache so the next request rebuilds
 * directly from the current database inventory.
 */
export function invalidateSitemapCache(): void {
  cache = null;
}
