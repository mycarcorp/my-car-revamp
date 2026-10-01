import { createServerFn } from "@tanstack/react-start";

import type {
  AutoseoAdminUpdate,
  AutoseoPost,
  AutoseoQualityFlag,
  AutoseoQualityResult,
  AutoseoQualityStatus,
  AutoseoRiskLevel,
} from "./autoseo-blog.server";

/* -------------------------------------------------------------------------- */
/* EXPORTED TYPES                                                             */
/* -------------------------------------------------------------------------- */

export type { AutoseoPost, AutoseoQualityFlag, AutoseoQualityResult, AutoseoQualityStatus, AutoseoRiskLevel };

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
