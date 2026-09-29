// Server-only sitemap builder with an in-memory cache.
//
// Crawlers always get valid XML fast:
// - A fresh cached copy is served immediately.
// - A slow/failing database never turns into a timeout, 500, or empty file.
// - Static pages, published blog posts, and live vehicle detail pages are included.
// - Vehicle URLs are generated from the same public legacy inventory source
//   used by the public inventory/search experience.

const SITE_ORIGIN = "https://mycarcorp.com";

const FRESH_MS = 10 * 60 * 1000; // Serve cached XML for 10 minutes.
const BUILD_TIMEOUT_MS = 4000; // Never let a slow query hold a crawler too long.

const STATIC_PAGES: Array<{
  path: string;
  priority: string;
  changefreq: string;
}> = [
  {
    path: "/",
    priority: "1.0",
    changefreq: "daily",
  },
  {
    path: "/search",
    priority: "0.9",
    changefreq: "daily",
  },
  {
    path: "/blog",
    priority: "0.8",
    changefreq: "daily",
  },
  {
    path: "/finance",
    priority: "0.7",
    changefreq: "monthly",
  },
  {
    path: "/sell",
    priority: "0.7",
    changefreq: "monthly",
  },
  {
    path: "/schedule",
    priority: "0.6",
    changefreq: "monthly",
  },
  {
    path: "/contact",
    priority: "0.6",
    changefreq: "monthly",
  },
];

/**
 * Escape values before placing them inside XML.
 */
const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Convert a stored date into W3C / ISO 8601 format.
 *
 * Returns null when the stored value is missing or invalid.
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

  return (
    `<url>` +
    `<loc>${SITE_ORIGIN}${escape(path)}</loc>` +
    mod +
    `<changefreq>${changefreq}</changefreq>` +
    `<priority>${priority}</priority>` +
    `</url>`
  );
}

/**
 * Wrap sitemap URL entries in a valid XML sitemap document.
 */
function wrap(entries: string[]): string {
  const ns = "http://www.sitemaps.org/schemas/sitemap/0.9";

  return `<?xml version="1.0" encoding="UTF-8"?>\n` + `<urlset xmlns="${ns}">` + entries.join("") + `</urlset>`;
}

/**
 * Emergency fallback sitemap.
 *
 * If database-backed content cannot be loaded and there is no cached
 * sitemap yet, crawlers still receive a valid sitemap containing the
 * site's important static pages.
 */
function staticOnlyXml(): string {
  return wrap(STATIC_PAGES.map((p) => urlEntry(p.path, null, p.changefreq, p.priority)));
}

/**
 * Collect published blog URLs from both publishing systems.
 *
 * Duplicate slugs are removed so a URL appears only once.
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
 * Collect every public/live vehicle URL from the same legacy inventory
 * source used by the public vehicle search and VDP.
 *
 * This makes vehicle detail pages discoverable through sitemap.xml
 * without manually submitting every VDP in Google Search Console.
 */
async function collectVehicleUrls(): Promise<
  Array<{
    slug: string;
    lastmod: string | null;
  }>
> {
  const { listPublicLegacyInventoryRows } = await import("./legacy-inventory.functions");

  const data = await listPublicLegacyInventoryRows({
    data: {
      page: 1,
      pageSize: 10000,
    },
  });

  const bySlug = new Map<string, string | null>();

  for (const vehicle of data.vehicles ?? []) {
    const slug = String(vehicle.slug ?? "").trim();

    if (!slug) {
      continue;
    }

    /*
     * Prefer the most meaningful modification timestamp available.
     *
     * Because legacy inventory row types may vary, we safely inspect
     * the possible timestamp fields instead of requiring one specific
     * field to exist.
     */
    const row = vehicle as unknown as Record<string, unknown>;

    const possibleLastmod =
      row.updated_at ?? row.modified_at ?? row.date_updated ?? row.date_received ?? row.created_at ?? null;

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
 * Includes:
 * 1. Important static pages
 * 2. Published AutoSEO/manual blog posts
 * 3. Public vehicle detail pages
 */
async function buildXml(): Promise<string> {
  const entries = STATIC_PAGES.map((p) => urlEntry(p.path, null, p.changefreq, p.priority));

  /*
   * Blog and inventory can be collected concurrently.
   */
  const [blogResult, vehicleResult] = await Promise.allSettled([collectBlogUrls(), collectVehicleUrls()]);

  /*
   * Add blog URLs.
   *
   * A temporary blog-source failure should not prevent vehicle URLs
   * or static pages from being served.
   */
  if (blogResult.status === "fulfilled") {
    for (const post of blogResult.value) {
      entries.push(urlEntry(`/blog/${encodeURIComponent(post.slug)}`, post.lastmod, "weekly", "0.7"));
    }
  } else {
    console.error("[sitemap] blog URL collection failed", blogResult.reason);
  }

  /*
   * Add every live/public vehicle detail page.
   *
   * Inventory changes frequently, so daily is an appropriate
   * crawl hint for these URLs.
   */
  if (vehicleResult.status === "fulfilled") {
    for (const vehicle of vehicleResult.value) {
      entries.push(urlEntry(`/inventory/${encodeURIComponent(vehicle.slug)}`, vehicle.lastmod, "daily", "0.8"));
    }
  } else {
    console.error("[sitemap] vehicle URL collection failed", vehicleResult.reason);
  }

  return wrap(entries);
}

/**
 * Reject a slow sitemap rebuild after the configured timeout.
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
 * Always resolves with valid sitemap XML.
 *
 * Fresh cache:
 * Return immediately.
 *
 * Successful rebuild:
 * Store the newly generated sitemap.
 *
 * Failed rebuild:
 * Return the last known sitemap, or the static fallback when the
 * application has not successfully generated a sitemap yet.
 */
export async function getSitemapXml(): Promise<{
  xml: string;
  cached: boolean;
}> {
  const now = Date.now();

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

    if (cache) {
      return {
        xml: cache.xml,
        cached: true,
      };
    }

    return {
      xml: staticOnlyXml(),
      cached: false,
    };
  }
}

/**
 * Drop the in-memory sitemap cache.
 *
 * The next request to /sitemap.xml will rebuild it from the current
 * blog and vehicle inventory data.
 */
export function invalidateSitemapCache(): void {
  cache = null;
}
