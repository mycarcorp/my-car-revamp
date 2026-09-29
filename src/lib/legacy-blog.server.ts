// Server-only CRUD helpers for `mycarco_db.mc_blog`.
// If the legacy-specific env vars are absent, this falls back to the current
// project's Supabase URL and service-role key so the editor can use the
// configured mycarco_db table in this workspace.

import type { HeadingStyles, PrimaryCta } from "./blog-content";

function creds() {
  const url = process.env["LEGACY_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];

  const key = process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!url || !key) {
    throw new Error(
      "Blog backend credentials are not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the project that hosts mycarco_db.mc_blog, or set LEGACY_SUPABASE_URL / LEGACY_SUPABASE_SERVICE_ROLE_KEY explicitly.",
    );
  }

  return { url, key };
}

type Profile = "public" | "mycarco_db";

async function rest(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    profile?: Profile;
    prefer?: string;
  } = {},
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

  if (init.prefer) {
    headers["Prefer"] = init.prefer;
  }

  const res = await fetch(`${c.url}/rest/v1/${path}`, {
    method,
    headers,
    body: init.body === undefined ? null : JSON.stringify(init.body),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Blog request failed (${res.status}): ${text.slice(0, 300)}`);
  }

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

  meta_title?: string | null | undefined;

  meta_description?: string | null | undefined;

  primary_cta?: PrimaryCta | null | undefined;

  heading_styles?: HeadingStyles | null | undefined;

  is_featured?: boolean | null | undefined;
};

/* -------------------------------------------------------------------------- */
/* Optional-column detection                                                  */
/* -------------------------------------------------------------------------- */

const OPTIONAL_COLUMNS = ["meta_title", "meta_description", "primary_cta", "heading_styles", "is_featured"] as const;

let columnCache: Set<string> | null = null;

async function knownColumns(): Promise<Set<string>> {
  const base = new Set<string>(columnCache ?? []);

  try {
    const rows = (await rest("mc_blog?select=*&limit=1", {
      profile: "mycarco_db",
    })) as Array<Record<string, unknown>>;

    for (const column of Object.keys(rows?.[0] ?? {})) {
      base.add(column);
    }
  } catch {
    /* Optional-column probes below provide the useful result. */
  }

  // Probe missing optional columns on every call so a newly applied migration
  // is detected without restarting the server.
  for (const col of OPTIONAL_COLUMNS) {
    if (base.has(col)) {
      continue;
    }

    try {
      await rest(`mc_blog?select=${col}&limit=1`, {
        profile: "mycarco_db",
      });

      base.add(col);
    } catch {
      /* column missing */
    }
  }

  columnCache = base;

  return base;
}

async function filterPayload<T extends Record<string, unknown>>(input: T): Promise<Record<string, unknown>> {
  const cols = await knownColumns();

  const out: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(input)) {
    if (!(OPTIONAL_COLUMNS as readonly string[]).includes(k) || cols.has(k)) {
      out[k] = v;
    }
  }

  return out;
}

/** True when the optional editor columns exist in the legacy table. */
export async function schemaStatus(): Promise<{
  hasSeoColumns: boolean;
  hasFeaturedColumn: boolean;
  hasCategoriesTable: boolean;
}> {
  const cols = await knownColumns();

  let hasCategoriesTable = true;

  try {
    await rest("mc_blog_categories?select=id&limit=1", {
      profile: "mycarco_db",
    });
  } catch {
    hasCategoriesTable = false;
  }

  return {
    hasSeoColumns: ["meta_title", "meta_description", "primary_cta", "heading_styles"].every((c) => cols.has(c)),

    hasFeaturedColumn: cols.has("is_featured"),

    hasCategoriesTable,
  };
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

/** Confirm the caller is signed in and has the owner/editor role. */
export async function requireStaff(token: string): Promise<string> {
  const c = creds();

  if (!token) {
    throw new Error("Not signed in.");
  }

  const res = await fetch(`${c.url}/auth/v1/user`, {
    headers: {
      apikey: c.key,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Not signed in.");
  }

  const user = (await res.json()) as {
    id?: string;
  };

  if (!user?.id) {
    throw new Error("Not signed in.");
  }

  const roles = (await rest(`user_roles?select=role&user_id=eq.${user.id}`, {
    profile: "public",
  })) as Array<{
    role: string;
  }>;

  const staff = (roles ?? []).some((r) => r.role === "owner" || r.role === "editor");

  if (!staff) {
    throw new Error("Staff access required.");
  }

  return user.id;
}

/* -------------------------------------------------------------------------- */
/* My Car editorial policy                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The manual editor and AutoSEO should ultimately use the same My Car
 * editorial standard.
 *
 * This server-side layer protects manually published posts from the most
 * important financing claims that can create inconsistent brand voice,
 * misleading promises or factual ambiguity.
 *
 * IMPORTANT:
 * Drafts can still be saved with warnings. These checks block PUBLICATION,
 * not drafting.
 */

export type EditorialIssue = {
  code: string;
  message: string;
  match: string;
};

export type EditorialReview = {
  passed: boolean;
  issues: EditorialIssue[];
};

/**
 * Financing language that should not be published as an unconditional My Car
 * promise.
 *
 * These patterns intentionally focus on high-confidence problem phrases.
 * They do not attempt to rewrite the article automatically.
 */
const FINANCING_CLAIM_RULES: Array<{
  code: string;
  pattern: RegExp;
  message: string;
}> = [
  {
    code: "guaranteed-approval",

    pattern: /\bguaranteed?\s+(?:car\s+|auto\s+|vehicle\s+|loan\s+|financing\s+)?approval\b/i,

    message: 'Avoid "guaranteed approval." Use qualified language about exploring available financing options instead.',
  },

  {
    code: "approval-guaranteed",

    pattern: /\bapproval\s+(?:is\s+)?guaranteed\b/i,

    message:
      "Do not state that approval is guaranteed. Financing approval depends on applicable lender and applicant requirements.",
  },

  {
    code: "everyone-approved",

    pattern: /\b(?:everyone|everybody|anyone)\s+(?:gets?|is|will\s+be)\s+approved\b/i,

    message:
      'Avoid claims that everyone gets approved. Use language such as "we work with customers across a range of credit situations."',
  },

  {
    code: "we-will-get-you-approved",

    pattern: /\bwe(?:'ll|\s+will)\s+get\s+you\s+approved\b/i,

    message:
      'Avoid promising "we will get you approved." Say the team can help customers explore available financing options.',
  },

  {
    code: "we-can-get-you-approved",

    pattern: /\bwe\s+can\s+get\s+you\s+approved\b/i,

    message: "Avoid promising that My Car can get someone approved. Use qualified financing language.",
  },

  {
    code: "instant-approval",

    pattern: /\b(?:instant|instantly|immediate|immediately)\s+(?:loan\s+|financing\s+)?approval\b/i,

    message:
      'Avoid promising instant approval unless that exact process and timing are verified. Prefer "start the financing or prequalification process online."',
  },

  {
    code: "approved-instantly",

    pattern: /\b(?:get|be)\s+approved\s+(?:instantly|immediately|in\s+seconds|in\s+minutes)\b/i,

    message: "Avoid promising a specific approval speed unless the claim is verified for the actual financing process.",
  },

  {
    code: "bad-credit-no-problem",

    pattern: /\bbad\s+credit[\s?!,.:;-]*(?:is\s+)?no\s+problem\b/i,

    message:
      'Avoid the generic claim "bad credit, no problem." Prefer factual language explaining that customers with credit challenges can explore available financing options.',
  },

  {
    code: "credit-doesnt-matter",

    pattern: /\b(?:your\s+)?credit\s+(?:doesn['’]?t|does\s+not|won['’]?t|will\s+not)\s+matter\b/i,

    message:
      "Do not imply that credit is irrelevant to financing. Creditworthiness and lender requirements may affect available terms.",
  },

  {
    code: "any-credit-approved",

    pattern: /\b(?:any|all)\s+credit\s+(?:accepted|approved)\b/i,

    message: "Avoid unconditional claims that any or all credit is accepted or approved.",
  },

  {
    code: "no-credit-check",

    pattern: /\bno\s+credit\s+check\b/i,

    message:
      'Use "no credit check" only when it is verified for the exact process being described. Remove or revise this claim before publication.',
  },

  {
    code: "lowest-rate",

    pattern: /\b(?:the\s+)?lowest\s+(?:interest\s+)?rates?\b/i,

    message:
      'Avoid claiming "lowest rates" unless the comparison is substantiated. Explain that available rates vary based on applicant, lender, vehicle, term and other factors.',
  },

  {
    code: "best-rate-guarantee",

    pattern: /\b(?:best|lowest)\s+rate\s+guarantee(?:d)?\b/i,

    message: "Do not guarantee the best or lowest financing rate without substantiation.",
  },

  {
    code: "zero-down-guarantee",

    pattern: /\b(?:guaranteed?\s+)?(?:zero|0)\s*(?:dollars?\s*)?down\b/i,

    message:
      "Do not present zero-down financing as universally available. If discussing it, clearly qualify that availability depends on the applicant, lender, vehicle and financing terms.",
  },

  {
    code: "no-money-down-guarantee",

    pattern: /\bno\s+money\s+down\b/i,

    message:
      'Do not present "no money down" as universally available. Qualify the statement when it refers to a real financing option.',
  },
];

/**
 * Normalize rich-text HTML into reviewable plain text while preserving enough
 * spacing to avoid accidentally joining unrelated words.
 */
function editorialPlainText(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, " and ")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build the complete editorial surface for a manual article.
 *
 * We review the title, excerpt, body and SEO metadata because a problematic
 * claim should not be allowed simply because it appears in a meta description
 * instead of the visible article body.
 */
function editorialSource(input: BlogInput): string {
  return [input.title, input.excerpt, input.body, input.meta_title, input.meta_description]
    .map((value) => editorialPlainText(value ?? ""))
    .filter(Boolean)
    .join(" ");
}

/**
 * Public helper so the admin/editor UI can eventually show the exact issues
 * before the editor clicks Publish.
 */
export function reviewBlogEditorialPolicy(input: BlogInput): EditorialReview {
  const source = editorialSource(input);

  const issues: EditorialIssue[] = [];

  for (const rule of FINANCING_CLAIM_RULES) {
    const match = source.match(rule.pattern);

    if (!match?.[0]) {
      continue;
    }

    issues.push({
      code: rule.code,
      message: rule.message,
      match: match[0],
    });
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

/**
 * Block publication when the article contains a high-confidence financing
 * claim that conflicts with My Car's approved editorial standard.
 *
 * Drafts are deliberately allowed so an editor never loses work.
 */
function assertPublishableEditorialContent(input: BlogInput): void {
  if (input.status !== "published") {
    return;
  }

  const review = reviewBlogEditorialPolicy(input);

  if (review.passed) {
    return;
  }

  const details = review.issues.map((issue, index) => `${index + 1}. "${issue.match}" — ${issue.message}`).join("\n");

  throw new Error(
    `This article cannot be published until the My Car editorial review issues are corrected:\n${details}`,
  );
}

/* -------------------------------------------------------------------------- */
/* Posts                                                                      */
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

  meta_title?: string | null | undefined;

  meta_description?: string | null | undefined;

  primary_cta?: PrimaryCta | null | undefined;

  heading_styles?: HeadingStyles | null | undefined;
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

/**
 * Ensures the slug is unique inside mc_blog
 * (appends -2, -3, … when needed).
 */
export async function uniqueSlug(slug: string, ignoreId: number | null): Promise<string> {
  const base = slug || "post";

  const rows = (await rest(`mc_blog?select=id,slug&slug=like.${encodeURIComponent(base)}*`, {
    profile: "mycarco_db",
  })) as Array<{
    id: number;
    slug: string;
  }>;

  const taken = new Set((rows ?? []).filter((r) => r.id !== ignoreId).map((r) => r.slug));

  if (!taken.has(base)) {
    return base;
  }

  let n = 2;

  while (taken.has(`${base}-${n}`)) {
    n += 1;
  }

  return `${base}-${n}`;
}

/**
 * Create a manual blog post.
 *
 * Drafts can always be saved.
 * Published posts must pass My Car editorial review.
 */
export async function createPost(input: BlogInput): Promise<LegacyBlogPost> {
  assertPublishableEditorialContent(input);

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

  (await import("./sitemap-cache.server")).invalidateSitemapCache();

  return rows[0]!;
}

/**
 * Update a manual blog post.
 *
 * If an editor changes an existing article and attempts to publish it, the
 * updated version must pass the same editorial review as a newly created post.
 */
export async function updatePost(id: number, input: BlogInput): Promise<LegacyBlogPost> {
  assertPublishableEditorialContent(input);

  const current = (await rest(`mc_blog?select=published_at,status&id=eq.${id}&limit=1`, {
    profile: "mycarco_db",
  })) as Array<{
    published_at: string | null;

    status: string | null;
  }>;

  const prev = current?.[0];

  const published_at = input.status === "published" ? (prev?.published_at ?? new Date().toISOString()) : null;

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

  (await import("./sitemap-cache.server")).invalidateSitemapCache();

  return rows[0]!;
}

export async function deletePost(id: number): Promise<void> {
  await rest(`mc_blog?id=eq.${id}`, {
    method: "DELETE",
    profile: "mycarco_db",
  });

  (await import("./sitemap-cache.server")).invalidateSitemapCache();
}

export async function setFeaturedPost(id: number): Promise<void> {
  const columns = await knownColumns();

  if (!columns.has("is_featured")) {
    throw new Error("The featured post option needs the latest blog database migration.");
  }

  const current = (await rest(`mc_blog?select=status&id=eq.${id}&limit=1`, {
    profile: "mycarco_db",
  })) as Array<{
    status: string | null;
  }>;

  if (current?.[0]?.status !== "published") {
    throw new Error("Only published posts can be featured.");
  }

  await rest("mc_blog?is_featured=eq.true", {
    method: "PATCH",
    profile: "mycarco_db",
    body: {
      is_featured: false,
    },
  });

  await rest(`mc_blog?id=eq.${id}`, {
    method: "PATCH",
    profile: "mycarco_db",
    prefer: "return=minimal",
    body: {
      is_featured: true,
      updated_at: new Date().toISOString(),
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

export async function listCategories(): Promise<string[]> {
  try {
    const rows = (await rest("mc_blog_categories?select=name&order=name.asc", {
      profile: "mycarco_db",
    })) as Array<{
      name: string;
    }>;

    return (rows ?? []).map((r) => r.name).filter(Boolean);
  } catch {
    // Categories table not created yet:
    // fall back to distinct post categories.
    const rows = (await rest("mc_blog?select=category", {
      profile: "mycarco_db",
    })) as Array<{
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

      body: {
        name,
        slug,
      },
    });
  } catch {
    /* table missing — the name is still usable on the post itself */
  }

  return name;
}

/* -------------------------------------------------------------------------- */
/* Public reads                                                               */
/* -------------------------------------------------------------------------- */

export async function listPublishedPosts(): Promise<LegacyBlogPost[]> {
  try {
    return (await rest(
      "mc_blog?select=*&status=eq.published&order=is_featured.desc.nullslast,published_at.desc.nullslast,created_at.desc",
      {
        profile: "mycarco_db",
      },
    )) as LegacyBlogPost[];
  } catch (error) {
    // Keep publishing available while the optional featured column is being
    // deployed.
    console.warn("[blog] featured ordering unavailable; using publication date", error);

    return (await rest("mc_blog?select=*&status=eq.published&order=published_at.desc.nullslast,created_at.desc", {
      profile: "mycarco_db",
    })) as LegacyBlogPost[];
  }
}

export async function getPublishedPost(slug: string): Promise<LegacyBlogPost | null> {
  const rows = (await rest(`mc_blog?select=*&status=eq.published&slug=eq.${encodeURIComponent(slug)}&limit=1`, {
    profile: "mycarco_db",
  })) as LegacyBlogPost[];

  return rows?.[0] ?? null;
}
