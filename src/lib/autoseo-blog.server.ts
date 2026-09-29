// Server-only helpers for the AutoSEO article table `mycarco_db.blog_posts`.

export type AutoseoPost = {
  id: number;
  title: string;
  slug: string;
  content_html: string | null;
  content_markdown: string | null;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  infographic_url: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  tags: string | null;
  faq_schema: Array<{ question: string; answer: string }> | null;
  language: string | null;
  reading_time: number | null;
  published_at: string | null;
  updated_at: string | null;
  created_at: string | null;

  // Optional SEO ownership fields.
  //
  // These are intentionally optional because the current Supabase table may
  // not have these columns yet. upsertRow() already safely removes unknown
  // columns instead of breaking article delivery.
  primary_intent?: string | null;
  canonical_slug?: string | null;
  seo_indexable?: boolean | null;
  status?: string | null;
  published_url?: string | null;
};

export type AutoseoIntentInfo = {
  primaryIntent: string;
  canonicalSlug: string;
  indexable: boolean;
  duplicateOf: string | null;
};

export const SITE_ORIGIN = "https://mycarcorp.com";

function creds() {
  const url = process.env["LEGACY_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];

  const key = process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!url || !key) {
    throw new Error("Blog backend credentials are not configured.");
  }

  return { url, key };
}

async function rest(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    prefer?: string;
  } = {},
): Promise<unknown> {
  const c = creds();
  const method = init.method ?? "GET";

  const headers: Record<string, string> = {
    apikey: c.key,
    Authorization: `Bearer ${c.key}`,
    "Content-Type": "application/json",
    [method === "GET" ? "Accept-Profile" : "Content-Profile"]: "mycarco_db",
  };

  if (init.prefer) {
    headers["Prefer"] = init.prefer;
  }

  const res = await fetch(`${c.url}/rest/v1/${path}`, {
    method,
    headers,
    body: init.body === undefined ? null : JSON.stringify(init.body),
  });

  const responseText = await res.text();

  if (!res.ok) {
    throw new Error(`AutoSEO blog request failed (${res.status}): ${responseText.slice(0, 300)}`);
  }

  return responseText ? JSON.parse(responseText) : null;
}

// ---------------------------------------------------------------------------
// Selects
// ---------------------------------------------------------------------------

const SELECT =
  "id,title,slug,content_html,hero_image_url,hero_image_alt,infographic_url,meta_description,meta_keywords,tags,faq_schema,language,reading_time,published_at,updated_at,created_at";

/**
 * Public AutoSEO list.
 *
 * Keep this compatible with the existing table. The blog index will perform
 * its own intent-aware filtering in the next update.
 */
export async function listAutoseoPosts(): Promise<AutoseoPost[]> {
  return (await rest(`blog_posts?select=${SELECT}&order=published_at.desc.nullslast,created_at.desc`)) as AutoseoPost[];
}

/**
 * Admin read: every column the table happens to have, newest activity first.
 */
export async function listAutoseoAdminRows(): Promise<Array<Record<string, unknown>>> {
  return (await rest(
    "blog_posts?select=*&order=updated_at.desc.nullslast,published_at.desc.nullslast,created_at.desc.nullslast",
  )) as Array<Record<string, unknown>>;
}

export async function getAutoseoPost(slug: string): Promise<AutoseoPost | null> {
  const rows = (await rest(
    `blog_posts?select=${SELECT},content_markdown&slug=eq.${encodeURIComponent(slug)}&limit=1`,
  )) as AutoseoPost[];

  return rows?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// Reading time
// ---------------------------------------------------------------------------

export function readingTimeFromHtml(html: string): number {
  const words = html
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(words / 200));
}

type WebhookBody = Record<string, unknown>;

const text = (v: unknown): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s ? s : null;
};

// ---------------------------------------------------------------------------
// SEO intent ownership
// ---------------------------------------------------------------------------

/**
 * These words usually add little value when comparing whether two article
 * topics target the same organic-search intent.
 *
 * IMPORTANT:
 * We intentionally do NOT remove meaningful financing modifiers such as:
 *
 * - pre approval
 * - pre qualification
 * - bad credit
 * - interest rates
 * - down payment
 * - refinance
 *
 * Those represent potentially different search intents.
 */
const INTENT_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "best",
  "by",
  "for",
  "from",
  "guide",
  "how",
  "in",
  "is",
  "it",
  "my",
  "of",
  "on",
  "the",
  "to",
  "what",
  "when",
  "where",
  "why",
  "with",
  "your",
  "you",

  // Local modifiers. My Car is already locally associated with these terms,
  // so they should not create separate intent ownership.
  "fredericksburg",
  "virginia",
  "va",
]);

const INTENT_SYNONYMS: Record<string, string> = {
  automobiles: "car",
  automobile: "car",
  cars: "car",
  vehicles: "vehicle",
  loans: "loan",
  rates: "rate",
  payments: "payment",
  dealerships: "dealership",
  dealers: "dealer",
};

/**
 * Normalize common keyword formatting so small variations don't create
 * artificial differences.
 */
function normalizeIntentText(value: string): string {
  return (
    value
      .toLowerCase()

      // Normalize common forms before punctuation is removed.
      .replace(/\bpre[\s-]?approved\b/g, "pre approval")
      .replace(/\bpre[\s-]?approve\b/g, "pre approval")
      .replace(/\bpre[\s-]?approval\b/g, "pre approval")
      .replace(/\bpre[\s-]?qualified\b/g, "pre qualification")
      .replace(/\bpre[\s-]?qualify\b/g, "pre qualification")
      .replace(/\bpre[\s-]?qualification\b/g, "pre qualification")

      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function intentTokens(value: string): string[] {
  const normalized = normalizeIntentText(value);

  if (!normalized) {
    return [];
  }

  return normalized
    .split(" ")
    .map((token) => INTENT_SYNONYMS[token] ?? token)
    .filter((token) => token.length > 1 && !INTENT_STOP_WORDS.has(token));
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

/**
 * Create a stable normalized search-intent key.
 *
 * Examples:
 *
 * "How to Get Pre-Approved for a Used Car in Fredericksburg, VA"
 * becomes roughly:
 *
 * "car pre approval used"
 *
 * while:
 *
 * "Used Car Interest Rates"
 * becomes:
 *
 * "car interest rate used"
 *
 * Therefore the two pages remain separate intents.
 */
export function normalizePrimaryIntent(value: string): string {
  return uniqueSorted(intentTokens(value)).join(" ");
}

/**
 * AutoSEO normally provides metaKeywords/keywords. Those are our preferred
 * source for the article's primary target query.
 *
 * If AutoSEO does not provide them, fall back to the article title.
 */
export function derivePrimaryIntent(input: {
  title: string;
  metaKeywords?: string | null;
  tags?: string | null;
}): string {
  const keywordSource = text(input.metaKeywords);

  if (keywordSource) {
    const firstKeyword =
      keywordSource
        .split(",")
        .map((part) => part.trim())
        .find(Boolean) ?? keywordSource;

    const normalizedKeyword = normalizePrimaryIntent(firstKeyword);

    if (normalizedKeyword) {
      return normalizedKeyword;
    }
  }

  const normalizedTitle = normalizePrimaryIntent(input.title);

  if (normalizedTitle) {
    return normalizedTitle;
  }

  const normalizedTags = normalizePrimaryIntent(input.tags ?? "");

  return normalizedTags;
}

function tokenSet(value: string): Set<string> {
  return new Set(
    value
      .split(" ")
      .map((token) => token.trim())
      .filter(Boolean),
  );
}

/**
 * Jaccard similarity between two normalized intent keys.
 *
 * This is deliberately conservative. We do not want to accidentally merge
 * two useful financing articles simply because they both mention "used car"
 * or "financing".
 */
export function intentSimilarity(a: string, b: string): number {
  if (!a || !b) {
    return 0;
  }

  if (a === b) {
    return 1;
  }

  const setA = tokenSet(a);
  const setB = tokenSet(b);

  if (!setA.size || !setB.size) {
    return 0;
  }

  let intersection = 0;

  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...setA, ...setB]).size;

  return union ? intersection / union : 0;
}

/**
 * Exact normalized intents are duplicates.
 *
 * For non-exact matches we use a high threshold so pages such as:
 *
 * - used car pre approval
 * - bad credit car financing
 * - used car interest rates
 *
 * are NOT collapsed merely because they share broad financing terminology.
 */
export function intentsOverlap(a: string, b: string): boolean {
  if (!a || !b) {
    return false;
  }

  if (a === b) {
    return true;
  }

  return intentSimilarity(a, b) >= 0.82;
}

function articleIntent(post: { title: string; meta_keywords?: string | null; tags?: string | null }): string {
  return derivePrimaryIntent({
    title: post.title,
    metaKeywords: post.meta_keywords ?? null,
    tags: post.tags ?? null,
  });
}

/**
 * Find an existing AutoSEO article that already owns the same search intent.
 *
 * We exclude the current AutoSEO ID so webhook updates to an existing article
 * never identify themselves as duplicates.
 */
async function findExistingIntentOwner(input: {
  id: number;
  title: string;
  metaKeywords: string | null;
  tags: string | null;
}): Promise<{
  post: AutoseoPost;
  intent: string;
} | null> {
  const incomingIntent = derivePrimaryIntent({
    title: input.title,
    metaKeywords: input.metaKeywords,
    tags: input.tags,
  });

  if (!incomingIntent) {
    return null;
  }

  let existing: AutoseoPost[];

  try {
    existing = (await rest(
      `blog_posts?select=${SELECT}&id=neq.${encodeURIComponent(
        String(input.id),
      )}&order=published_at.asc.nullslast,created_at.asc`,
    )) as AutoseoPost[];
  } catch (error) {
    console.error("[autoseo] Could not check existing search intents:", error instanceof Error ? error.message : error);

    // Never fail article delivery because the defensive SEO check could not
    // complete.
    return null;
  }

  for (const post of existing ?? []) {
    if (!post?.slug || !post?.title) {
      continue;
    }

    const existingIntent = articleIntent(post);

    if (existingIntent && intentsOverlap(incomingIntent, existingIntent)) {
      return {
        post,
        intent: existingIntent,
      };
    }
  }

  return null;
}

/**
 * Return SEO ownership information for a stored article.
 *
 * This helper will be used by the blog route/index in the next update.
 */
export async function getAutoseoIntentInfo(article: AutoseoPost): Promise<AutoseoIntentInfo> {
  const primaryIntent = articleIntent(article);

  if (!primaryIntent) {
    return {
      primaryIntent: "",
      canonicalSlug: article.slug,
      indexable: true,
      duplicateOf: null,
    };
  }

  const owner = await findExistingIntentOwner({
    id: article.id,
    title: article.title,
    metaKeywords: article.meta_keywords,
    tags: article.tags,
  });

  if (!owner) {
    return {
      primaryIntent,
      canonicalSlug: article.slug,
      indexable: true,
      duplicateOf: null,
    };
  }

  const articleDate = new Date(article.published_at ?? article.created_at ?? 0).getTime();

  const ownerDate = new Date(owner.post.published_at ?? owner.post.created_at ?? 0).getTime();

  /**
   * Prefer the older established URL as the owner.
   *
   * This avoids allowing a newly generated AutoSEO article to displace an
   * existing URL simply because it arrived later.
   */
  if (articleDate && ownerDate && articleDate < ownerDate) {
    return {
      primaryIntent,
      canonicalSlug: article.slug,
      indexable: true,
      duplicateOf: null,
    };
  }

  return {
    primaryIntent,
    canonicalSlug: owner.post.slug,
    indexable: false,
    duplicateOf: owner.post.slug,
  };
}

/**
 * Remove duplicate-intent AutoSEO articles from a public collection.
 *
 * The oldest article owns an intent. Different intents remain untouched.
 */
export function dedupeAutoseoPostsByIntent(posts: AutoseoPost[]): AutoseoPost[] {
  const sorted = [...posts].sort((a, b) => {
    const aTime = new Date(a.published_at ?? a.created_at ?? 0).getTime();

    const bTime = new Date(b.published_at ?? b.created_at ?? 0).getTime();

    return aTime - bTime;
  });

  const owners: Array<{
    post: AutoseoPost;
    intent: string;
  }> = [];

  for (const post of sorted) {
    const intent = articleIntent(post);

    if (!intent) {
      owners.push({
        post,
        intent: `__slug:${post.slug}`,
      });

      continue;
    }

    const duplicate = owners.some(
      (owner) => !owner.intent.startsWith("__slug:") && intentsOverlap(intent, owner.intent),
    );

    if (!duplicate) {
      owners.push({
        post,
        intent,
      });
    }
  }

  const ownerIds = new Set(owners.map(({ post }) => post.id));

  // Preserve the original ordering supplied by the caller.
  return posts.filter((post) => ownerIds.has(post.id));
}

// ---------------------------------------------------------------------------
// Image mirror
// ---------------------------------------------------------------------------

const IMAGE_BUCKET = "autoseo-images";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

let bucketReady = false;

/**
 * Create the public image bucket if it isn't there yet.
 * Other buckets untouched.
 */
async function ensureImageBucket(): Promise<void> {
  if (bucketReady) {
    return;
  }

  const c = creds();

  const res = await fetch(`${c.url}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      apikey: c.key,
      Authorization: `Bearer ${c.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: IMAGE_BUCKET,
      name: IMAGE_BUCKET,
      public: true,
    }),
  });

  if (res.ok || res.status === 409) {
    bucketReady = true;
    return;
  }

  const detail = await res.text();

  if (/already exists|Duplicate/i.test(detail)) {
    bucketReady = true;
    return;
  }

  throw new Error(`Could not prepare image bucket (${res.status}): ${detail.slice(0, 200)}`);
}

/**
 * Copy a remote image into storage and return its public URL.
 *
 * Returns the original URL when anything goes wrong, so an image problem
 * never fails article delivery.
 */
async function mirrorImage(
  remoteUrl: string | null,
  articleId: number,
  name: "hero" | "infographic",
): Promise<string | null> {
  if (!remoteUrl) {
    return null;
  }

  try {
    await ensureImageBucket();

    const download = await fetch(remoteUrl);

    if (!download.ok) {
      throw new Error(`download failed (${download.status})`);
    }

    const contentType = (download.headers.get("content-type") ?? "").split(";")[0]!.toLowerCase();

    if (!contentType.startsWith("image/")) {
      throw new Error(`not an image (${contentType})`);
    }

    const bytes = new Uint8Array(await download.arrayBuffer());

    if (bytes.byteLength === 0) {
      throw new Error("empty image");
    }

    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("image too large");
    }

    const fromUrl = new URL(remoteUrl).pathname.split(".").pop()?.toLowerCase() ?? "";

    const ext = EXT_BY_TYPE[contentType] ?? (/^[a-z0-9]{2,5}$/.test(fromUrl) ? fromUrl : "jpg");

    const path = `articles/${articleId}/${name}.${ext}`;

    const c = creds();

    const upload = await fetch(`${c.url}/storage/v1/object/${IMAGE_BUCKET}/${path}`, {
      method: "POST",
      headers: {
        apikey: c.key,
        Authorization: `Bearer ${c.key}`,
        "Content-Type": contentType,
        "x-upsert": "true",
        "cache-control": "public, max-age=31536000",
      },
      body: bytes,
    });

    if (!upload.ok) {
      throw new Error(`upload failed (${upload.status})`);
    }

    return `${c.url}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`;
  } catch (error) {
    console.error(
      `[autoseo] ${name} image kept as remote URL for article ${articleId}:`,
      error instanceof Error ? error.message : error,
    );

    return remoteUrl;
  }
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

/**
 * Retry the upsert without columns the table doesn't have.
 *
 * This preserves compatibility with the current database and means the new
 * optional SEO ownership fields can be added later without breaking article
 * publishing today.
 */
async function upsertRow(row: Record<string, unknown>): Promise<void> {
  let payload = { ...row };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rest("blog_posts?on_conflict=id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: payload,
      });

      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      const missing = /PGRST204/.test(message)
        ? (/'([^']+)' column/.exec(message)?.[1] ?? /column\s+"?([a-z_]+)"?/i.exec(message)?.[1])
        : undefined;

      if (!missing || !(missing in payload)) {
        throw error;
      }

      console.error(`[autoseo] blog_posts has no "${missing}" column — skipping that field.`);

      const { [missing]: _drop, ...remaining } = payload;

      payload = remaining;
    }
  }

  throw new Error("Could not store the article after removing unknown columns.");
}

export async function upsertAutoseoArticle(body: WebhookBody): Promise<{
  slug: string;
}> {
  const id = Number(body["id"]);

  const title = text(body["title"]);

  const slug = text(body["slug"]);

  if (!Number.isFinite(id) || !title || !slug) {
    throw new Error("Missing id, title or slug.");
  }

  const html = String(body["content_html"] ?? "");

  const faq = body["faqSchema"];

  const now = new Date().toISOString();

  const metaKeywords =
    text(body["metaKeywords"]) ??
    (Array.isArray(body["keywords"])
      ? (body["keywords"] as unknown[])
          .map((value) => String(value).trim())
          .filter(Boolean)
          .join(", ")
      : null);

  const tags = text(body["wordpressTags"]);

  const primaryIntent = derivePrimaryIntent({
    title,
    metaKeywords,
    tags,
  });

  /**
   * Check whether an older AutoSEO article already owns this search intent.
   *
   * IMPORTANT:
   * We still store the incoming article. We do NOT automatically delete,
   * overwrite or redirect content at webhook time.
   *
   * Instead we record ownership metadata when the table supports it. The
   * public route/index updates will use the same intent logic even if those
   * optional DB columns do not exist yet.
   */
  const existingOwner = await findExistingIntentOwner({
    id,
    title,
    metaKeywords,
    tags,
  });

  const canonicalSlug = existingOwner?.post.slug ?? slug;

  const seoIndexable = !existingOwner;

  if (existingOwner) {
    console.warn(
      `[autoseo] Search-intent overlap detected for "${slug}". ` +
        `Primary intent: "${primaryIntent}". ` +
        `Existing owner: "${existingOwner.post.slug}".`,
    );
  }

  const [heroUrl, infographicUrl] = await Promise.all([
    mirrorImage(text(body["heroImageUrl"]), id, "hero"),

    mirrorImage(text(body["infographicImageUrl"]), id, "infographic"),
  ]);

  const sourceArticleId = Number(body["sourceArticleId"]);

  const row = {
    id,
    title,
    slug,

    content_html: html || null,

    content_markdown: text(body["content_markdown"]),

    hero_image_url: heroUrl,

    hero_image_alt: text(body["heroImageAlt"]),

    infographic_url: infographicUrl,

    meta_description: text(body["metaDescription"]),

    meta_keywords: metaKeywords,

    tags,

    faq_schema: Array.isArray(faq) && faq.length > 0 ? faq : null,

    language: text(body["languageCode"]) ?? "en",

    reading_time: readingTimeFromHtml(html),

    published_url: text(body["published_url"]) ?? text(body["publishedUrl"]),

    source_article_id: Number.isFinite(sourceArticleId) ? sourceArticleId : null,

    status: text(body["status"]),

    published_at: text(body["publishedAt"]) ?? now,

    updated_at: text(body["updatedAt"]) ?? now,

    created_at: text(body["createdAt"]) ?? now,

    received_at: now,

    /**
     * Optional SEO ownership fields.
     *
     * If these columns do not yet exist, upsertRow() safely removes them.
     */
    primary_intent: primaryIntent || null,

    canonical_slug: canonicalSlug,

    seo_indexable: seoIndexable,
  };

  await upsertRow(row);

  // A new or changed article means the cached sitemap is stale.
  try {
    (await import("./sitemap-cache.server")).invalidateSitemapCache();
  } catch {
    // Sitemap cache is best-effort.
  }

  return { slug };
}

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------

type SitemapRow = {
  id?: number;
  title?: string;
  slug: string;
  meta_keywords?: string | null;
  tags?: string | null;
  updated_at: string | null;
  published_at: string | null;
  created_at?: string | null;
  status?: string | null;
};

/**
 * Published AutoSEO articles for the sitemap.
 *
 * We perform the same intent deduplication here in application code instead
 * of depending on optional database columns. That means the protection works
 * even before primary_intent/canonical_slug/seo_indexable are added to the
 * Supabase table.
 */
export async function sitemapUrls(): Promise<
  Array<{
    slug: string;
    lastmod: string | null;
  }>
> {
  let rows: SitemapRow[] = [];

  try {
    rows = (await rest(
      "blog_posts?select=id,title,slug,meta_keywords,tags,updated_at,published_at,created_at,status&or=(status.is.null,status.eq.published)&published_at=not.is.null",
    )) as SitemapRow[];
  } catch {
    // Table without the optional status column.
    rows = (await rest(
      "blog_posts?select=id,title,slug,meta_keywords,tags,updated_at,published_at,created_at&published_at=not.is.null",
    )) as SitemapRow[];
  }

  const validRows = (rows ?? []).filter((row) => row.slug && row.title);

  /**
   * Oldest URL owns a normalized intent.
   *
   * This keeps established URLs in the sitemap and prevents a newer AutoSEO
   * article targeting the same intent from receiving another strong
   * indexation signal.
   */
  const chronological = [...validRows].sort((a, b) => {
    const aTime = new Date(a.published_at ?? a.created_at ?? 0).getTime();

    const bTime = new Date(b.published_at ?? b.created_at ?? 0).getTime();

    return aTime - bTime;
  });

  const owners: Array<{
    row: SitemapRow;
    intent: string;
  }> = [];

  for (const row of chronological) {
    const intent = derivePrimaryIntent({
      title: row.title ?? row.slug,
      metaKeywords: row.meta_keywords ?? null,
      tags: row.tags ?? null,
    });

    if (!intent) {
      owners.push({
        row,
        intent: `__slug:${row.slug}`,
      });

      continue;
    }

    const duplicate = owners.some(
      (owner) => !owner.intent.startsWith("__slug:") && intentsOverlap(intent, owner.intent),
    );

    if (!duplicate) {
      owners.push({
        row,
        intent,
      });
    }
  }

  return owners.map(({ row }) => ({
    slug: row.slug,
    lastmod: row.updated_at ?? row.published_at,
  }));
}
