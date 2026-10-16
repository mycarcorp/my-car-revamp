import { createServerFn } from "@tanstack/react-start";

import type {
  AutoseoAdminUpdate,
  AutoseoPost,
  AutoseoQualityFlag,
  AutoseoQualityResult,
  AutoseoQualityStatus,
  AutoseoRiskLevel,
  BlogQualityRule,
  BlogQualityRuleType,
} from "./autoseo-blog.server";

/* -------------------------------------------------------------------------- */
/* EXPORTED TYPES                                                             */
/* -------------------------------------------------------------------------- */

export type {
  AutoseoPost,
  AutoseoQualityFlag,
  AutoseoQualityResult,
  AutoseoQualityStatus,
  AutoseoRiskLevel,
  BlogQualityRule,
  BlogQualityRuleType,
};

/**
 * AutoSEO row as shown in the admin list.
 *
 * The server's AutoseoPost type already contains the quality-gate fields,
 * but these optional fields are repeated here for clarity and compatibility
 * with older database deployments.
 */
export type AutoseoAdminPost = AutoseoPost & {
  status?: string | null;

  published_url?: string | null;

  is_featured?: boolean | null;

  quality_status?: AutoseoQualityStatus | null;

  risk_level?: AutoseoRiskLevel | null;

  requires_human_review?: boolean | null;

  quality_flags?: AutoseoQualityFlag[] | null;

  source_urls?: string[] | null;

  review_notes?: string | null;

  reviewed_at?: string | null;

  reviewed_by?: string | null;
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function cleanAccessToken(value: unknown): string {
  const accessToken = String(value ?? "").trim();

  if (!accessToken) {
    throw new Error("Not signed in.");
  }

  return accessToken;
}

function cleanId(value: unknown): number {
  const id = Number(value);

  if (!Number.isFinite(id)) {
    throw new Error("Invalid AutoSEO post id.");
  }

  return id;
}

function cleanReviewer(value: unknown): string {
  const reviewer = String(value ?? "").trim();

  if (!reviewer) {
    throw new Error("Reviewer is required.");
  }

  return reviewer.slice(0, 250);
}

function cleanNotes(value: unknown): string | null {
  const notes = String(value ?? "").trim();

  return notes ? notes.slice(0, 5000) : null;
}

const BLOG_QUALITY_RULE_TYPES = [
  "blocked_claim",
  "high_risk_topic",
  "finance_trade_topic",
  "source_required_topic",
  "authoritative_source_domain",
] as const satisfies readonly BlogQualityRuleType[];

function cleanRuleCode(value: unknown): string {
  const code = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);

  if (!code) {
    throw new Error("Quality rule code is required.");
  }

  return code;
}

function cleanRuleName(value: unknown): string {
  const name = String(value ?? "")
    .trim()
    .slice(0, 200);

  if (!name) {
    throw new Error("Quality rule name is required.");
  }

  return name;
}

function cleanRuleType(value: unknown): BlogQualityRuleType {
  const ruleType = String(value ?? "").trim() as BlogQualityRuleType;

  if (!BLOG_QUALITY_RULE_TYPES.includes(ruleType)) {
    throw new Error("Invalid quality rule type.");
  }

  return ruleType;
}

function cleanSeverity(value: unknown): "warning" | "blocking" {
  return value === "warning" ? "warning" : "blocking";
}

function cleanPhrases(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("Quality rule phrases must be an array.");
  }

  const phrases = Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .map((item) => item.slice(0, 250)),
    ),
  ).slice(0, 250);

  if (phrases.length === 0) {
    throw new Error("Add at least one phrase or domain to this quality rule.");
  }

  return phrases;
}

function cleanRuleMessage(value: unknown): string {
  return String(value ?? "")
    .trim()
    .slice(0, 2000);
}

function cleanSortOrder(value: unknown): number {
  const sortOrder = Number(value);

  if (!Number.isFinite(sortOrder)) {
    return 100;
  }

  return Math.max(-100000, Math.min(100000, Math.trunc(sortOrder)));
}

function qualityRuleCreds() {
  const url = process.env["LEGACY_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];

  const key = process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!url || !key) {
    throw new Error("Blog backend credentials are not configured.");
  }

  return { url, key };
}

async function qualityRuleRest(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    prefer?: string;
  } = {},
): Promise<unknown> {
  const { url, key } = qualityRuleCreds();

  const method = init.method ?? "GET";

  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    [method === "GET" ? "Accept-Profile" : "Content-Profile"]: "mycarco_db",
  };

  if (init.prefer) {
    headers["Prefer"] = init.prefer;
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers,
    body: init.body === undefined ? null : JSON.stringify(init.body),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Quality-rule request failed (${response.status}): ${responseText.slice(0, 500)}`);
  }

  return responseText ? JSON.parse(responseText) : null;
}

type BlogQualityRuleWriteInput = {
  code: string;
  name: string;
  rule_type: BlogQualityRuleType;
  severity: "warning" | "blocking";
  phrases: string[];
  message: string;
  requires_source: boolean;
  requires_human_review: boolean;
  allow_negated: boolean;
  is_enabled: boolean;
  sort_order: number;
};

function cleanQualityRuleWriteInput(input: {
  code: unknown;
  name: unknown;
  rule_type: unknown;
  severity?: unknown;
  phrases: unknown;
  message?: unknown;
  requires_source?: unknown;
  requires_human_review?: unknown;
  allow_negated?: unknown;
  is_enabled?: unknown;
  sort_order?: unknown;
}): BlogQualityRuleWriteInput {
  return {
    code: cleanRuleCode(input.code),
    name: cleanRuleName(input.name),
    rule_type: cleanRuleType(input.rule_type),
    severity: cleanSeverity(input.severity),
    phrases: cleanPhrases(input.phrases),
    message: cleanRuleMessage(input.message),
    requires_source: Boolean(input.requires_source),
    requires_human_review: Boolean(input.requires_human_review),
    allow_negated: Boolean(input.allow_negated),
    is_enabled: input.is_enabled !== false,
    sort_order: cleanSortOrder(input.sort_order),
  };
}

/* -------------------------------------------------------------------------- */
/* QUALITY GATE RULE ADMIN                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Staff-only list of every quality-gate rule, including disabled rules.
 *
 * The server helper falls back to built-in defaults when the migration has
 * not been applied yet. After the table exists, database rows are returned.
 */
export const listBlogQualityRulesAdmin = createServerFn({
  method: "POST",
})
  .inputValidator((input: { accessToken: string }) => ({
    accessToken: cleanAccessToken(input?.accessToken),
  }))
  .handler(async ({ data }): Promise<BlogQualityRule[]> => {
    const auth = await import("./legacy-blog.server");

    await auth.requireStaff(data.accessToken);

    const m = await import("./autoseo-blog.server");

    return await m.listAllBlogQualityRules();
  });

/**
 * Staff-only creation of a custom/system quality-gate rule.
 *
 * Phrases are stored as plain strings. Admin users never enter raw regular
 * expressions, which prevents an invalid regex from breaking article scans.
 */
export const createBlogQualityRuleAdmin = createServerFn({
  method: "POST",
})
  .inputValidator(
    (input: {
      accessToken: string;
      code: string;
      name: string;
      rule_type: BlogQualityRuleType;
      severity?: "warning" | "blocking";
      phrases: string[];
      message?: string;
      requires_source?: boolean;
      requires_human_review?: boolean;
      allow_negated?: boolean;
      is_enabled?: boolean;
      sort_order?: number;
    }) => ({
      accessToken: cleanAccessToken(input?.accessToken),
      ...cleanQualityRuleWriteInput(input),
    }),
  )

  .handler(async ({ data }): Promise<BlogQualityRule> => {
    const auth = await import("./legacy-blog.server");

    await auth.requireStaff(data.accessToken);

    const now = new Date().toISOString();

    const rows = (await qualityRuleRest("blog_quality_rules", {
      method: "POST",
      prefer: "return=representation",
      body: {
        code: data.code,
        name: data.name,
        rule_type: data.rule_type,
        severity: data.severity,
        phrases: data.phrases,
        message: data.message,
        requires_source: data.requires_source,
        requires_human_review: data.requires_human_review,
        allow_negated: data.allow_negated,
        is_enabled: data.is_enabled,
        is_system_rule: false,
        sort_order: data.sort_order,
        created_at: now,
        updated_at: now,
      },
    })) as BlogQualityRule[];

    const created = rows?.[0];

    if (!created) {
      throw new Error("Quality rule was created but no row was returned.");
    }

    return created;
  });

/**
 * Staff-only update of an existing quality-gate rule.
 *
 * System rules may be edited, but their is_system_rule identity is preserved.
 */
export const updateBlogQualityRuleAdmin = createServerFn({
  method: "POST",
})
  .inputValidator(
    (input: {
      accessToken: string;
      id: number;
      code: string;
      name: string;
      rule_type: BlogQualityRuleType;
      severity?: "warning" | "blocking";
      phrases: string[];
      message?: string;
      requires_source?: boolean;
      requires_human_review?: boolean;
      allow_negated?: boolean;
      is_enabled?: boolean;
      sort_order?: number;
    }) => ({
      accessToken: cleanAccessToken(input?.accessToken),
      id: cleanId(input?.id),
      ...cleanQualityRuleWriteInput(input),
    }),
  )
  .handler(async ({ data }): Promise<BlogQualityRule> => {
    const auth = await import("./legacy-blog.server");

    await auth.requireStaff(data.accessToken);

    const existing = (await qualityRuleRest(
      `blog_quality_rules?select=id,is_system_rule&id=eq.${encodeURIComponent(String(data.id))}&limit=1`,
    )) as Array<{
      id: number;
      is_system_rule?: boolean;
    }>;

    if (!existing?.[0]) {
      throw new Error("Quality rule not found.");
    }

    const rows = (await qualityRuleRest(`blog_quality_rules?id=eq.${encodeURIComponent(String(data.id))}`, {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        code: data.code,
        name: data.name,
        rule_type: data.rule_type,
        severity: data.severity,
        phrases: data.phrases,
        message: data.message,
        requires_source: data.requires_source,
        requires_human_review: data.requires_human_review,
        allow_negated: data.allow_negated,
        is_enabled: data.is_enabled,
        sort_order: data.sort_order,
        updated_at: new Date().toISOString(),
      },
    })) as BlogQualityRule[];

    const updated = rows?.[0];

    if (!updated) {
      throw new Error("Quality rule was updated but no row was returned.");
    }

    return updated;
  });

/**
 * Staff-only enable / disable switch.
 *
 * A disabled rule remains in the database and can be turned back on later.
 * This is intentionally safer than deleting system protection rules.
 */
export const setBlogQualityRuleEnabledAdmin = createServerFn({
  method: "POST",
})
  .inputValidator((input: { accessToken: string; id: number; enabled: boolean }) => ({
    accessToken: cleanAccessToken(input?.accessToken),
    id: cleanId(input?.id),
    enabled: Boolean(input?.enabled),
  }))
  .handler(async ({ data }): Promise<BlogQualityRule> => {
    const auth = await import("./legacy-blog.server");

    await auth.requireStaff(data.accessToken);

    const rows = (await qualityRuleRest(`blog_quality_rules?id=eq.${encodeURIComponent(String(data.id))}`, {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        is_enabled: data.enabled,
        updated_at: new Date().toISOString(),
      },
    })) as BlogQualityRule[];

    const updated = rows?.[0];

    if (!updated) {
      throw new Error("Quality rule not found.");
    }

    return updated;
  });

/**
 * Convenience wrappers used by the Admin UI when explicit actions read better
 * than passing a boolean.
 */
export const enableBlogQualityRuleAdmin = createServerFn({
  method: "POST",
})
  .inputValidator((input: { accessToken: string; id: number }) => ({
    accessToken: cleanAccessToken(input?.accessToken),
    id: cleanId(input?.id),
  }))
  .handler(async ({ data }): Promise<BlogQualityRule> => {
    const auth = await import("./legacy-blog.server");

    await auth.requireStaff(data.accessToken);

    const rows = (await qualityRuleRest(`blog_quality_rules?id=eq.${encodeURIComponent(String(data.id))}`, {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        is_enabled: true,
        updated_at: new Date().toISOString(),
      },
    })) as BlogQualityRule[];

    const updated = rows?.[0];

    if (!updated) {
      throw new Error("Quality rule not found.");
    }

    return updated;
  });

export const disableBlogQualityRuleAdmin = createServerFn({
  method: "POST",
})
  .inputValidator((input: { accessToken: string; id: number }) => ({
    accessToken: cleanAccessToken(input?.accessToken),
    id: cleanId(input?.id),
  }))
  .handler(async ({ data }): Promise<BlogQualityRule> => {
    const auth = await import("./legacy-blog.server");

    await auth.requireStaff(data.accessToken);

    const rows = (await qualityRuleRest(`blog_quality_rules?id=eq.${encodeURIComponent(String(data.id))}`, {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        is_enabled: false,
        updated_at: new Date().toISOString(),
      },
    })) as BlogQualityRule[];

    const updated = rows?.[0];

    if (!updated) {
      throw new Error("Quality rule not found.");
    }

    return updated;
  });

/* -------------------------------------------------------------------------- */
/* PUBLIC AUTOSEO                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Public AutoSEO list.
 *
 * The server now enforces:
 *
 * status = published
 * quality_status = approved
 * published_at != null
 *
 * so unapproved AutoSEO content cannot reach the public blog collection.
 */

export const publicAutoseoList = createServerFn({
  method: "GET",
}).handler(async (): Promise<AutoseoPost[]> => {
  try {
    const m = await import("./autoseo-blog.server");

    return await m.listAutoseoPosts();
  } catch {
    return [];
  }
});

/** Listing/intent ownership only: do not transfer every article body or FAQ. */
export const publicAutoseoSummaryList = createServerFn({ method: "GET" }).handler(async (): Promise<AutoseoPost[]> => {
  try {
    const m = await import("./autoseo-blog.server");
    return (await m.listAutoseoPosts(true)).map((post) => ({ ...post, content_html: null, faq_schema: null }));
  } catch {
    return [];
  }
});

/**
 * Public AutoSEO article lookup.
 *
 * The server applies the mandatory quality gate before returning an article.
 */
export const publicAutoseoPost = createServerFn({
  method: "GET",
})
  .inputValidator((input: { slug: string }) => ({
    slug: String(input?.slug ?? "").slice(0, 200),
  }))
  .handler(async ({ data }): Promise<AutoseoPost | null> => {
    try {
      const m = await import("./autoseo-blog.server");

      return await m.getAutoseoPost(data.slug);
    } catch {
      return null;
    }
  });

/* -------------------------------------------------------------------------- */
/* ADMIN LIST                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Staff-only read of every AutoSEO article.
 *
 * Includes:
 * - drafts
 * - published posts
 * - pending reviews
 * - approved posts
 * - flagged posts
 * - quality flags
 * - risk levels
 * - sources
 * - reviewer information
 */

export const listAutoseoAdminPosts = createServerFn({
  method: "POST",
})
  .inputValidator((input: { accessToken: string }) => ({
    accessToken: cleanAccessToken(input?.accessToken),
  }))
  .handler(async ({ data }): Promise<AutoseoAdminPost[]> => {
    const auth = await import("./legacy-blog.server");

    await auth.requireStaff(data.accessToken);

    const m = await import("./autoseo-blog.server");

    return (await m.listAutoseoAdminRows()) as AutoseoAdminPost[];
  });

/* -------------------------------------------------------------------------- */
/* AUTOSEO EDITING                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Staff-only update of an AutoSEO article's editable content.
 *
 * IMPORTANT:
 * updateAutoseoAdminRow() automatically re-runs the mandatory quality gate.
 *
 * A substantive edit can therefore return an article to:
 *
 * needs_review
 *
 * and can automatically move its publication status back to draft.
 */
export const updateAutoseoAdminPost = createServerFn({
  method: "POST",
})
  .inputValidator(
    (
      input: AutoseoAdminUpdate & {
        accessToken: string;
      },
    ) => {
      const accessToken = cleanAccessToken(input?.accessToken);

      const id = cleanId(input?.id);

      const title = String(input?.title ?? "").trim();

      const slug = String(input?.slug ?? "").trim();

      if (!title) {
        throw new Error("AutoSEO article title is required.");
      }

      if (!slug) {
        throw new Error("AutoSEO article slug is required.");
      }

      return {
        accessToken,

        id,

        title,

        slug,

        content_html: input?.content_html ?? null,

        content_markdown: input?.content_markdown ?? null,

        hero_image_url: input?.hero_image_url ?? null,

        hero_image_alt: input?.hero_image_alt ?? null,

        infographic_url: input?.infographic_url ?? null,

        meta_description: input?.meta_description ?? null,

        meta_keywords: input?.meta_keywords ?? null,

        tags: input?.tags ?? null,

        faq_schema: input?.faq_schema ?? null,

        language: input?.language ?? "en",
      };
    },
  )

  .handler(
    async ({
      data,
    }): Promise<{
      ok: true;
    }> => {
      const auth = await import("./legacy-blog.server");

      await auth.requireStaff(data.accessToken);

      const m = await import("./autoseo-blog.server");

      await m.updateAutoseoAdminRow({
        id: data.id,

        title: data.title,

        slug: data.slug,

        content_html: data.content_html,

        content_markdown: data.content_markdown,

        hero_image_url: data.hero_image_url,

        hero_image_alt: data.hero_image_alt,

        infographic_url: data.infographic_url,

        meta_description: data.meta_description,

        meta_keywords: data.meta_keywords,

        tags: data.tags,

        faq_schema: data.faq_schema,

        language: data.language,
      });

      return {
        ok: true,
      };
    },
  );

/* -------------------------------------------------------------------------- */
/* QUALITY SCAN                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Staff-only live quality scan.
 *
 * This does NOT approve or publish anything.
 *
 * It lets the admin UI re-check the article and display:
 *
 * - risk level
 * - human-review requirement
 * - quality flags
 * - source URLs
 * - recommended quality status
 *
 * without changing the database.
 */
export const scanAutoseoQualityAdmin = createServerFn({
  method: "POST",
})
  .inputValidator(
    (input: {
      accessToken: string;

      id: number;

      title: string;

      slug: string;

      content_html: string | null;

      meta_description?: string | null;

      meta_keywords?: string | null;

      tags?: string | null;
    }) => {
      const accessToken = cleanAccessToken(input?.accessToken);

      const id = cleanId(input?.id);

      return {
        accessToken,

        id,

        title: String(input?.title ?? "").trim(),

        slug: String(input?.slug ?? "").trim(),

        content_html: input?.content_html ?? null,

        meta_description: input?.meta_description ?? null,

        meta_keywords: input?.meta_keywords ?? null,

        tags: input?.tags ?? null,
      };
    },
  )
  .handler(async ({ data }): Promise<AutoseoQualityResult> => {
    const auth = await import("./legacy-blog.server");

    await auth.requireStaff(data.accessToken);

    const m = await import("./autoseo-blog.server");

    return await m.evaluateAutoseoQuality({
      id: data.id,

      title: data.title,

      slug: data.slug,

      contentHtml: data.content_html,

      metaDescription: data.meta_description,

      metaKeywords: data.meta_keywords,

      tags: data.tags,
    });
  });

/* -------------------------------------------------------------------------- */
/* QUALITY APPROVAL                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Staff-only approval of an AutoSEO article.
 *
 * The server runs the quality scanner again before approval.
 *
 * Approval will fail if blocking quality issues still exist.
 *
 * Approving does NOT automatically publish the article.
 * It unlocks publication.
 */
export const approveAutoseoPostAdmin = createServerFn({
  method: "POST",
})
  .inputValidator(
    (input: {
      accessToken: string;

      id: number;

      reviewer: string;

      notes?: string | null;
    }) => ({
      accessToken: cleanAccessToken(input?.accessToken),

      id: cleanId(input?.id),

      reviewer: cleanReviewer(input?.reviewer),

      notes: cleanNotes(input?.notes),
    }),
  )

  .handler(
    async ({
      data,
    }): Promise<{
      ok: true;
    }> => {
      const auth = await import("./legacy-blog.server");

      await auth.requireStaff(data.accessToken);

      const m = await import("./autoseo-blog.server");

      await m.approveAutoseoPost(data.id, data.reviewer, data.notes);

      return {
        ok: true,
      };
    },
  );

/* -------------------------------------------------------------------------- */
/* QUALITY FLAG                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Staff-only manual flag.
 *
 * Flagging:
 *
 * - sets quality_status = flagged
 * - moves article to draft
 * - removes featured state
 * - keeps article out of public pages
 * - keeps article out of sitemap
 * - stores reviewer notes
 * - writes to the revision log
 */
export const flagAutoseoPostAdmin = createServerFn({
  method: "POST",
})
  .inputValidator(
    (input: {
      accessToken: string;

      id: number;

      reviewer: string;

      notes?: string | null;
    }) => ({
      accessToken: cleanAccessToken(input?.accessToken),

      id: cleanId(input?.id),

      reviewer: cleanReviewer(input?.reviewer),

      notes: cleanNotes(input?.notes),
    }),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      ok: true;
    }> => {
      const auth = await import("./legacy-blog.server");

      await auth.requireStaff(data.accessToken);

      const m = await import("./autoseo-blog.server");

      await m.flagAutoseoPost(data.id, data.reviewer, data.notes);

      return {
        ok: true,
      };
    },
  );

/* -------------------------------------------------------------------------- */
/* PUBLISH / UNPUBLISH                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Staff-only publish/unpublish.
 *
 * IMPORTANT:
 * The server now refuses publication unless:
 *
 * quality_status = approved
 *
 * so this endpoint cannot bypass the mandatory quality gate.
 */
export const setAutoseoPublishedAdmin = createServerFn({
  method: "POST",
})
  .inputValidator(
    (input: {
      accessToken: string;

      id: number;

      published: boolean;
    }) => ({
      accessToken: cleanAccessToken(input?.accessToken),

      id: cleanId(input?.id),

      published: Boolean(input?.published),
    }),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      ok: true;
    }> => {
      const auth = await import("./legacy-blog.server");

      await auth.requireStaff(data.accessToken);

      const m = await import("./autoseo-blog.server");

      await m.setAutoseoPublished(data.id, data.published);

      return {
        ok: true,
      };
    },
  );

/* -------------------------------------------------------------------------- */
/* FEATURE AUTOSEO                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Staff-only feature control.
 *
 * The server refuses to feature an AutoSEO article unless it is:
 *
 * - published
 * - quality_status = approved
 */
export const setFeaturedAutoseoPostAdmin = createServerFn({
  method: "POST",
})
  .inputValidator(
    (input: {
      accessToken: string;

      id: number;
    }) => ({
      accessToken: cleanAccessToken(input?.accessToken),

      id: cleanId(input?.id),
    }),
  )

  .handler(
    async ({
      data,
    }): Promise<{
      ok: true;
    }> => {
      const auth = await import("./legacy-blog.server");

      await auth.requireStaff(data.accessToken);

      const m = await import("./autoseo-blog.server");

      await m.setFeaturedAutoseoPost(data.id);

      return {
        ok: true,
      };
    },
  );
