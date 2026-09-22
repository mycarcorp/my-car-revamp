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
};

export const SITE_ORIGIN = "https://mycarcorp.com";

function creds() {
  const url = process.env["LEGACY_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
  const key =
    process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("Blog backend credentials are not configured.");
  return { url, key };
}

async function rest(
  path: string,
  init: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<unknown> {
  const c = creds();
  const method = init.method ?? "GET";
  const headers: Record<string, string> = {
    apikey: c.key,
    Authorization: `Bearer ${c.key}`,
    "Content-Type": "application/json",
    [method === "GET" ? "Accept-Profile" : "Content-Profile"]: "mycarco_db",
  };
  if (init.prefer) headers["Prefer"] = init.prefer;

  const res = await fetch(`${c.url}/rest/v1/${path}`, {
    method,
    headers,
    body: init.body === undefined ? null : JSON.stringify(init.body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`AutoSEO blog request failed (${res.status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const SELECT =
  "id,title,slug,content_html,hero_image_url,hero_image_alt,infographic_url,meta_description,meta_keywords,tags,faq_schema,language,reading_time,published_at,updated_at,created_at";

export async function listAutoseoPosts(): Promise<AutoseoPost[]> {
  return (await rest(
    `blog_posts?select=${SELECT}&order=published_at.desc.nullslast,created_at.desc`,
  )) as AutoseoPost[];
}

/** Admin read: every column the table happens to have, newest activity first. */
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

// ---------------------------------------------------------------- image mirror

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

/** Create the public image bucket if it isn't there yet. Other buckets untouched. */
async function ensureImageBucket(): Promise<void> {
  if (bucketReady) return;
  const c = creds();
  const res = await fetch(`${c.url}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      apikey: c.key,
      Authorization: `Bearer ${c.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: IMAGE_BUCKET, name: IMAGE_BUCKET, public: true }),
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
 * Returns the original URL when anything goes wrong, so an image problem never
 * fails the article delivery.
 */
async function mirrorImage(
  remoteUrl: string | null,
  articleId: number,
  name: "hero" | "infographic",
): Promise<string | null> {
  if (!remoteUrl) return null;
  try {
    await ensureImageBucket();

    const download = await fetch(remoteUrl);
    if (!download.ok) throw new Error(`download failed (${download.status})`);

    const contentType = (download.headers.get("content-type") ?? "").split(";")[0]!.toLowerCase();
    if (!contentType.startsWith("image/")) throw new Error(`not an image (${contentType})`);

    const bytes = new Uint8Array(await download.arrayBuffer());
    if (bytes.byteLength === 0) throw new Error("empty image");
    if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("image too large");

    const fromUrl = new URL(remoteUrl).pathname.split(".").pop()?.toLowerCase() ?? "";
    const ext = EXT_BY_TYPE[contentType] ?? (/^[a-z0-9]{2,5}$/.test(fromUrl) ? fromUrl : "jpg");
    const path = `articles/${articleId}/${name}.${ext}`;

    const c = creds();
    const upload = await fetch(
      `${c.url}/storage/v1/object/${IMAGE_BUCKET}/${path}`,
      {
        method: "POST",
        headers: {
          apikey: c.key,
          Authorization: `Bearer ${c.key}`,
          "Content-Type": contentType,
          "x-upsert": "true",
          "cache-control": "public, max-age=31536000",
        },
        body: bytes,
      },
    );
    if (!upload.ok) throw new Error(`upload failed (${upload.status})`);

    return `${c.url}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`;
  } catch (error) {
    console.error(
      `[autoseo] ${name} image kept as remote URL for article ${articleId}:`,
      error instanceof Error ? error.message : error,
    );
    return remoteUrl;
  }
}

// ---------------------------------------------------------------------- upsert

/** Retry the upsert without columns the table doesn't have (never alters schema). */
async function upsertRow(row: Record<string, unknown>): Promise<void> {
  let payload = { ...row };
  for (let attempt = 0; attempt < 5; attempt += 1) {
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
        ? /'([^']+)' column/.exec(message)?.[1] ?? /column\s+"?([a-z_]+)"?/i.exec(message)?.[1]
        : undefined;
      if (!missing || !(missing in payload)) throw error;
      console.error(`[autoseo] blog_posts has no "${missing}" column — skipping that field.`);
      const { [missing]: _drop, ...rest } = payload;
      payload = rest;
    }
  }
  throw new Error("Could not store the article after removing unknown columns.");
}

export async function upsertAutoseoArticle(body: WebhookBody): Promise<{ slug: string }> {
  const id = Number(body["id"]);
  const title = text(body["title"]);
  const slug = text(body["slug"]);
  if (!Number.isFinite(id) || !title || !slug) throw new Error("Missing id, title or slug.");

  const html = String(body["content_html"] ?? "");
  const faq = body["faqSchema"];
  const now = new Date().toISOString();

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
    meta_keywords:
      text(body["metaKeywords"]) ??
      (Array.isArray(body["keywords"]) ? (body["keywords"] as unknown[]).join(", ") : null),
    tags: text(body["wordpressTags"]),
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
  };

  await upsertRow(row);

  // A new or changed article means the cached sitemap is stale.
  try {
    (await import("./sitemap-cache.server")).invalidateSitemapCache();
  } catch {
    /* sitemap cache is best-effort */
  }

  return { slug };
}

type SitemapRow = {
  slug: string;
  updated_at: string | null;
  published_at: string | null;
  status?: string | null;
};

/** Published articles only (drafts and unpublished rows stay out of the sitemap). */
export async function sitemapUrls(): Promise<Array<{ slug: string; lastmod: string | null }>> {
  let rows: SitemapRow[] = [];
  try {
    rows = (await rest(
      "blog_posts?select=slug,updated_at,published_at,status&or=(status.is.null,status.eq.published)&published_at=not.is.null",
    )) as SitemapRow[];
  } catch {
    // Table without the optional status column.
    rows = (await rest(
      "blog_posts?select=slug,updated_at,published_at&published_at=not.is.null",
    )) as SitemapRow[];
  }
  return (rows ?? [])
    .filter((r) => r.slug)
    .map((r) => ({ slug: r.slug, lastmod: r.updated_at ?? r.published_at }));
}
