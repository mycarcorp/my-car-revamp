import { createServerFn } from "@tanstack/react-start";
import { normalizeCta, normalizeHeadingStyles, readTimeFromHtml, sanitizeHtml, slugify } from "./blog-content";
import type { HeadingStyles, PrimaryCta } from "./blog-content";
import type { EditorialReview, LegacyBlogPost } from "./legacy-blog.server";

export type { EditorialReview, LegacyBlogPost };

const str = (v: unknown, max: number): string | null => {
  const s = String(v ?? "").trim();

  return s ? s.slice(0, max) : null;
};

/* -------------------------------------------------------------------------- */
/* Input types                                                                */
/* -------------------------------------------------------------------------- */

type RawInput = {
  accessToken: string;
  id?: number | null;
  title?: string;
  slug?: string;
  category?: string | null;
  excerpt?: string | null;
  body?: string | null;
  image_url?: string | null;
  author_name?: string | null;
  author_initials?: string | null;
  author_color?: string | null;
  read_time?: number | string | null;
  status?: string;
  meta_title?: string | null;
  meta_description?: string | null;
  primary_cta?: PrimaryCta | null;
  heading_styles?: HeadingStyles | null;
};

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Validate and normalize blog editor input before it reaches the server CRUD
 * layer.
 *
 * IMPORTANT:
 *
 * Editorial policy is NOT enforced here.
 *
 * The authoritative publication check lives in legacy-blog.server.ts so it
 * cannot be bypassed by calling another server function or changing the UI.
 */
function validate(input: RawInput) {
  const accessToken = String(input?.accessToken ?? "");

  if (!accessToken) {
    throw new Error("Not signed in.");
  }

  const title = str(input?.title, 255);

  if (!title) {
    throw new Error("A title is required.");
  }

  const slug = slugify(str(input?.slug, 255) ?? title);

  const body = sanitizeHtml(String(input?.body ?? ""));

  const readTimeNum = Number(input?.read_time);

  return {
    accessToken,

    id: input?.id != null ? Number(input.id) : null,

    post: {
      title,

      slug: slug || "post",

      category: str(input?.category, 60),

      excerpt: str(input?.excerpt, 1000),

      body,

      image_url: str(input?.image_url, 1000),

      author_name: str(input?.author_name, 120),

      author_initials: str(input?.author_initials, 8),

      author_color: str(input?.author_color, 20),

      read_time: Number.isFinite(readTimeNum) && readTimeNum > 0 ? Math.round(readTimeNum) : readTimeFromHtml(body),

      status: input?.status === "published" ? "published" : "draft",

      meta_title: str(input?.meta_title, 255),

      meta_description: str(input?.meta_description, 500),

      primary_cta: input?.primary_cta ? normalizeCta(input.primary_cta) : null,

      heading_styles: input?.heading_styles ? normalizeHeadingStyles(input.heading_styles) : null,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Staff post reads                                                           */
/* -------------------------------------------------------------------------- */

export const listLegacyPosts = createServerFn({
  method: "POST",
})
  .inputValidator((input: { accessToken: string }) => {
    const accessToken = String(input?.accessToken ?? "");

    if (!accessToken) {
      throw new Error("Not signed in.");
    }

    return {
      accessToken,
    };
  })
  .handler(async ({ data }): Promise<LegacyBlogPost[]> => {
    const m = await import("./legacy-blog.server");

    await m.requireStaff(data.accessToken);

    return await m.listPosts();
  });

export const getLegacyPost = createServerFn({
  method: "POST",
})
  .inputValidator((input: { accessToken: string; id: number }) => {
    const accessToken = String(input?.accessToken ?? "");

    const id = Number(input?.id);

    if (!accessToken || !Number.isFinite(id)) {
      throw new Error("Invalid request.");
    }

    return {
      accessToken,
      id,
    };
  })
  .handler(async ({ data }): Promise<LegacyBlogPost | null> => {
    const m = await import("./legacy-blog.server");

    await m.requireStaff(data.accessToken);

    return await m.getPost(data.id);
  });

/* -------------------------------------------------------------------------- */
/* Editorial review                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Preview My Car's editorial review from the admin/editor UI.
 *
 * This lets the editor see the exact financing-language issues BEFORE trying
 * to publish.
 *
 * The server CRUD functions still perform the same review again during
 * create/update, so this preview is not the security/enforcement boundary.
 */
export const reviewLegacyPostEditorial = createServerFn({
  method: "POST",
})
  .inputValidator((input: RawInput) => {
    return validate(input);
  })
  .handler(async ({ data }): Promise<EditorialReview> => {
    const m = await import("./legacy-blog.server");

    await m.requireStaff(data.accessToken);

    return m.reviewBlogEditorialPolicy(data.post);
  });

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

export const createLegacyPost = createServerFn({
  method: "POST",
})
  .inputValidator(validate)
  .handler(async ({ data }): Promise<LegacyBlogPost> => {
    const m = await import("./legacy-blog.server");

    await m.requireStaff(data.accessToken);

    /**
     * createPost() performs the authoritative editorial publication check.
     *
     * Draft:
     *   saves normally.
     *
     * Published:
     *   must pass My Car editorial policy.
     */
    return await m.createPost(data.post);
  });

/* -------------------------------------------------------------------------- */
/* Update                                                                     */
/* -------------------------------------------------------------------------- */

export const updateLegacyPost = createServerFn({
  method: "POST",
})
  .inputValidator((input: RawInput) => {
    const v = validate(input);

    if (!v.id || !Number.isFinite(v.id)) {
      throw new Error("Missing post id.");
    }

    return {
      ...v,
      id: v.id,
    };
  })
  .handler(async ({ data }): Promise<LegacyBlogPost> => {
    const m = await import("./legacy-blog.server");

    await m.requireStaff(data.accessToken);

    /**
     * updatePost() performs the authoritative editorial publication check.
     */
    return await m.updatePost(data.id, data.post);
  });

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

export const deleteLegacyPost = createServerFn({
  method: "POST",
})
  .inputValidator((input: { accessToken: string; id: number }) => {
    const accessToken = String(input?.accessToken ?? "");

    const id = Number(input?.id);

    if (!accessToken || !Number.isFinite(id)) {
      throw new Error("Invalid request.");
    }

    return {
      accessToken,
      id,
    };
  })
  .handler(
    async ({
      data,
    }): Promise<{
      deleted: boolean;
    }> => {
      const m = await import("./legacy-blog.server");

      await m.requireStaff(data.accessToken);

      await m.deletePost(data.id);

      return {
        deleted: true,
      };
    },
  );

/* -------------------------------------------------------------------------- */
/* Featured article                                                           */
/* -------------------------------------------------------------------------- */

export const setFeaturedLegacyPost = createServerFn({
  method: "POST",
})
  .inputValidator((input: { accessToken: string; id: number }) => {
    const accessToken = String(input?.accessToken ?? "");

    const id = Number(input?.id);

    if (!accessToken || !Number.isFinite(id)) {
      throw new Error("Invalid request.");
    }

    return {
      accessToken,
      id,
    };
  })
  .handler(
    async ({
      data,
    }): Promise<{
      featured: boolean;
    }> => {
      const m = await import("./legacy-blog.server");

      await m.requireStaff(data.accessToken);

      await m.setFeaturedPost(data.id);

      return {
        featured: true,
      };
    },
  );

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

export const listBlogCategories = createServerFn({
  method: "POST",
})
  .inputValidator((input: { accessToken: string }) => {
    const accessToken = String(input?.accessToken ?? "");

    if (!accessToken) {
      throw new Error("Not signed in.");
    }

    return {
      accessToken,
    };
  })
  .handler(async ({ data }): Promise<string[]> => {
    const m = await import("./legacy-blog.server");

    await m.requireStaff(data.accessToken);

    return await m.listCategories();
  });

export const addBlogCategory = createServerFn({
  method: "POST",
})
  .inputValidator((input: { accessToken: string; name: string }) => {
    const accessToken = String(input?.accessToken ?? "");

    const name = String(input?.name ?? "")
      .trim()
      .slice(0, 60);

    if (!accessToken) {
      throw new Error("Not signed in.");
    }

    if (!name) {
      throw new Error("Enter a category name.");
    }

    return {
      accessToken,
      name,
    };
  })
  .handler(
    async ({
      data,
    }): Promise<{
      name: string;
    }> => {
      const m = await import("./legacy-blog.server");

      await m.requireStaff(data.accessToken);

      const name = await m.addCategory(data.name, slugify(data.name));

      return {
        name,
      };
    },
  );

/* -------------------------------------------------------------------------- */
/* Schema status                                                              */
/* -------------------------------------------------------------------------- */

export const getBlogSchemaStatus = createServerFn({
  method: "POST",
})
  .inputValidator((input: { accessToken: string }) => {
    const accessToken = String(input?.accessToken ?? "");

    if (!accessToken) {
      throw new Error("Not signed in.");
    }

    return {
      accessToken,
    };
  })
  .handler(async ({ data }) => {
    const m = await import("./legacy-blog.server");

    await m.requireStaff(data.accessToken);

    return await m.schemaStatus();
  });

/* -------------------------------------------------------------------------- */
/* Public reads                                                               */
/* -------------------------------------------------------------------------- */

export const publicBlogList = createServerFn({
  method: "GET",
}).handler(async (): Promise<LegacyBlogPost[]> => {
  const m = await import("./legacy-blog.server");

  try {
    return await m.listPublishedPosts();
  } catch {
    return [];
  }
});

export const publicBlogPost = createServerFn({
  method: "GET",
})
  .inputValidator((input: { slug: string }) => ({
    slug: String(input?.slug ?? "").slice(0, 200),
  }))
  .handler(async ({ data }): Promise<LegacyBlogPost | null> => {
    const m = await import("./legacy-blog.server");

    try {
      return await m.getPublishedPost(data.slug);
    } catch {
      return null;
    }
  });
