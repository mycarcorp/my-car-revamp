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

export async function upsertAutoseoArticle(body: WebhookBody): Promise<{ slug: string }> {
  const id = Number(body["id"]);
  const title = text(body["title"]);
  const slug = text(body["slug"]);
  if (!Number.isFinite(id) || !title || !slug) throw new Error("Missing id, title or slug.");

  const html = String(body["content_html"] ?? "");
  const faq = body["faqSchema"];
  const now = new Date().toISOString();

  const row = {
    id,
    title,
    slug,
    content_html: html || null,
    content_markdown: text(body["content_markdown"]),
    hero_image_url: text(body["heroImageUrl"]),
    hero_image_alt: text(body["heroImageAlt"]),
    infographic_url: text(body["infographicImageUrl"]),
    meta_description: text(body["metaDescription"]),
    meta_keywords:
      text(body["metaKeywords"]) ??
      (Array.isArray(body["keywords"]) ? (body["keywords"] as unknown[]).join(", ") : null),
    tags: text(body["wordpressTags"]),
    faq_schema: Array.isArray(faq) && faq.length > 0 ? faq : null,
    language: text(body["languageCode"]) ?? "en",
    reading_time: readingTimeFromHtml(html),
    published_at: text(body["publishedAt"]) ?? now,
    updated_at: text(body["updatedAt"]) ?? now,
    created_at: text(body["createdAt"]) ?? now,
    received_at: now,
  };

  await rest("blog_posts?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: row,
  });

  return { slug };
}

export async function sitemapUrls(): Promise<Array<{ slug: string; lastmod: string | null }>> {
  const rows = (await rest("blog_posts?select=slug,updated_at,published_at")) as Array<{
    slug: string;
    updated_at: string | null;
    published_at: string | null;
  }>;
  return (rows ?? []).map((r) => ({ slug: r.slug, lastmod: r.updated_at ?? r.published_at }));
}
