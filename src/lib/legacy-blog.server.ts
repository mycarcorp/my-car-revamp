// Server-only CRUD helpers for the legacy `mycarco_db.mc_blog` table.
// The service-role key never leaves the server and the legacy schema is never
// exposed to the browser.

function creds() {
  const url = process.env["LEGACY_SUPABASE_URL"];
  const key = process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("Legacy backend credentials are not configured.");
  return { url, key };
}

type Profile = "public" | "mycarco_db";

async function rest(
  path: string,
  init: { method?: string; body?: unknown; profile?: Profile; prefer?: string } = {},
): Promise<unknown> {
  const c = creds();
  const method = init.method ?? "GET";
  const headers: Record<string, string> = {
    apikey: c.key,
    Authorization: `Bearer ${c.key}`,
    "Content-Type": "application/json",
  };
  if (init.profile) {
    headers[method === "GET" ? "Accept-Profile" : "Content-Profile"] = init.profile;
  }
  if (init.prefer) headers["Prefer"] = init.prefer;

  const res = await fetch(`${c.url}/rest/v1/${path}`, {
    method,
    headers,
    body: init.body === undefined ? null : JSON.stringify(init.body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Blog request failed (${res.status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

export type LegacyBlogPost = {
  id: number;
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
  body: string | null;
  image_url: string | null;
  author_name: string | null;
  author_initials: string | null;
  author_color: string | null;
  read_time: number | null;
  status: string | null;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  primary_cta?: unknown;
  heading_styles?: unknown;
};

/* -------------------------------------------------------------------------- */
/* Optional-column detection (new SEO/CTA/design columns may not exist yet)    */
/* -------------------------------------------------------------------------- */

const OPTIONAL_COLUMNS = ["meta_title", "meta_description", "primary_cta", "heading_styles"] as const;
let columnCache: Set<string> | null = null;

async function knownColumns(): Promise<Set<string>> {
  if (columnCache) return columnCache;
  const rows = (await rest("mc_blog?select=*&limit=1", { profile: "mycarco_db" })) as Array<
    Record<string, unknown>
  >;
  const base = new Set<string>(rows?.[0] ? Object.keys(rows[0]) : []);
  if (!rows?.[0]) {
    // Empty table: probe each optional column individually.
    for (const col of OPTIONAL_COLUMNS) {
      try {
        await rest(`mc_blog?select=${col}&limit=1`, { profile: "mycarco_db" });
        base.add(col);
      } catch {
        /* column missing */
      }
    }
  }
  columnCache = base;
  return base;
}

async function filterPayload<T extends Record<string, unknown>>(input: T): Promise<Record<string, unknown>> {
  const cols = await knownColumns();
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (!(OPTIONAL_COLUMNS as readonly string[]).includes(k) || cols.has(k)) out[k] = v;
  }
  return out;
}

/** True when the optional editor columns exist in the legacy table. */
export async function schemaStatus(): Promise<{ hasSeoColumns: boolean; hasCategoriesTable: boolean }> {
  const cols = await knownColumns();
  let hasCategoriesTable = true;
  try {
    await rest("mc_blog_categories?select=id&limit=1", { profile: "mycarco_db" });
  } catch {
    hasCategoriesTable = false;
  }
  return {
    hasSeoColumns: OPTIONAL_COLUMNS.every((c) => cols.has(c)),
    hasCategoriesTable,
  };
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                        */
/* -------------------------------------------------------------------------- */

/** Confirm the caller is signed in and has the owner/editor role. */
export async function requireStaff(token: string): Promise<string> {
  const c = creds();
  if (!token) throw new Error("Not signed in.");
  const res = await fetch(`${c.url}/auth/v1/user`, {
    headers: { apikey: c.key, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Not signed in.");
  const user = (await res.json()) as { id?: string };
  if (!user?.id) throw new Error("Not signed in.");

  const roles = (await rest(`user_roles?select=role&user_id=eq.${user.id}`, {
    profile: "public",
  })) as Array<{ role: string }>;
  const staff = (roles ?? []).some((r) => r.role === "owner" || r.role === "editor");
  if (!staff) throw new Error("Staff access required.");
  return user.id;
}

/* -------------------------------------------------------------------------- */
/* Posts                                                                       */
/* -------------------------------------------------------------------------- */

export type BlogInput = {
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
  body: string | null;
  image_url: string | null;
  author_name: string | null;
  author_initials: string | null;
  author_color: string | null;
  read_time: number | null;
  status: string;
  meta_title?: string | null;
  meta_description?: string | null;
  primary_cta?: unknown;
  heading_styles?: unknown;
};

export async function listPosts(): Promise<LegacyBlogPost[]> {
  return (await rest("mc_blog?select=*&order=created_at.desc", {
    profile: "mycarco_db",
  })) as LegacyBlogPost[];
}

export async function getPost(id: number): Promise<LegacyBlogPost | null> {
  const rows = (await rest(`mc_blog?select=*&id=eq.${id}&limit=1`, {
    profile: "mycarco_db",
  })) as LegacyBlogPost[];
  return rows?.[0] ?? null;
}

/** Ensures the slug is unique inside mc_blog (appends -2, -3, … when needed). */
export async function uniqueSlug(slug: string, ignoreId: number | null): Promise<string> {
  const base = slug || "post";
  const rows = (await rest(`mc_blog?select=id,slug&slug=like.${encodeURIComponent(base)}*`, {
    profile: "mycarco_db",
  })) as Array<{ id: number; slug: string }>;
  const taken = new Set(
    (rows ?? []).filter((r) => r.id !== ignoreId).map((r) => r.slug),
  );
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export async function createPost(input: BlogInput): Promise<LegacyBlogPost> {
  const body = await filterPayload({
    ...input,
    slug: await uniqueSlug(input.slug, null),
    published_at: input.status === "published" ? new Date().toISOString() : null,
  });
  const rows = (await rest("mc_blog", {
    method: "POST",
    profile: "mycarco_db",
    prefer: "return=representation",
    body,
  })) as LegacyBlogPost[];
  return rows[0]!;
}

export async function updatePost(id: number, input: BlogInput): Promise<LegacyBlogPost> {
  const current = (await rest(`mc_blog?select=published_at,status&id=eq.${id}&limit=1`, {
    profile: "mycarco_db",
  })) as Array<{ published_at: string | null; status: string | null }>;
  const prev = current?.[0];
  const published_at =
    input.status === "published" ? (prev?.published_at ?? new Date().toISOString()) : null;

  const body = await filterPayload({
    ...input,
    slug: await uniqueSlug(input.slug, id),
    published_at,
    updated_at: new Date().toISOString(),
  });

  const rows = (await rest(`mc_blog?id=eq.${id}`, {
    method: "PATCH",
    profile: "mycarco_db",
    prefer: "return=representation",
    body,
  })) as LegacyBlogPost[];
  return rows[0]!;
}

export async function deletePost(id: number): Promise<void> {
  await rest(`mc_blog?id=eq.${id}`, { method: "DELETE", profile: "mycarco_db" });
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                  */
/* -------------------------------------------------------------------------- */

export async function listCategories(): Promise<string[]> {
  try {
    const rows = (await rest("mc_blog_categories?select=name&order=name.asc", {
      profile: "mycarco_db",
    })) as Array<{ name: string }>;
    return (rows ?? []).map((r) => r.name).filter(Boolean);
  } catch {
    // Categories table not created yet: fall back to distinct post categories.
    const rows = (await rest("mc_blog?select=category", { profile: "mycarco_db" })) as Array<{
      category: string | null;
    }>;
    return [...new Set((rows ?? []).map((r) => r.category).filter((c): c is string => Boolean(c)))].sort();
  }
}

export async function addCategory(name: string, slug: string): Promise<string> {
  try {
    await rest("mc_blog_categories", {
      method: "POST",
      profile: "mycarco_db",
      prefer: "resolution=ignore-duplicates,return=minimal",
      body: { name, slug },
    });
  } catch {
    /* table missing — the name is still usable on the post itself */
  }
  return name;
}

/* -------------------------------------------------------------------------- */
/* Public reads                                                                */
/* -------------------------------------------------------------------------- */

export async function listPublishedPosts(): Promise<LegacyBlogPost[]> {
  return (await rest(
    "mc_blog?select=*&status=eq.published&order=published_at.desc.nullslast,created_at.desc",
    { profile: "mycarco_db" },
  )) as LegacyBlogPost[];
}

export async function getPublishedPost(slug: string): Promise<LegacyBlogPost | null> {
  const rows = (await rest(
    `mc_blog?select=*&status=eq.published&slug=eq.${encodeURIComponent(slug)}&limit=1`,
    { profile: "mycarco_db" },
  )) as LegacyBlogPost[];
  return rows?.[0] ?? null;
}
