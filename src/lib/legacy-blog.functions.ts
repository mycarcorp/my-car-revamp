import { createServerFn } from "@tanstack/react-start";
import { sanitizeHtml, readTimeFromHtml, slugify } from "./blog-content";
import type { LegacyBlogPost } from "./legacy-blog.server";

export type { LegacyBlogPost };

const str = (v: unknown, max: number): string | null => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};

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
  primary_cta?: unknown;
  heading_styles?: unknown;
};

function validate(input: RawInput) {
  const accessToken = String(input?.accessToken ?? "");
  if (!accessToken) throw new Error("Not signed in.");
  const title = str(input?.title, 255);
  if (!title) throw new Error("A title is required.");
  const slug = slugify(str(input?.slug, 255) ?? title);
  const body = sanitizeHtml(String(input?.body ?? ""));
  const readTimeNum = Number(input?.read_time);
  const cta = (input?.primary_cta ?? null) as { enabled?: boolean; url?: string } | null;

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
      read_time:
        Number.isFinite(readTimeNum) && readTimeNum > 0
          ? Math.round(readTimeNum)
          : readTimeFromHtml(body),
      status: input?.status === "published" ? "published" : "draft",
      meta_title: str(input?.meta_title, 255),
      meta_description: str(input?.meta_description, 500),
      primary_cta: cta && typeof cta === "object" ? cta : null,
      heading_styles: input?.heading_styles ?? null,
    },
  };
}

export const listLegacyPosts = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => {
    const accessToken = String(input?.accessToken ?? "");
    if (!accessToken) throw new Error("Not signed in.");
    return { accessToken };
  })
  .handler(async ({ data }): Promise<LegacyBlogPost[]> => {
    const m = await import("./legacy-blog.server");
    await m.requireStaff(data.accessToken);
    return await m.listPosts();
  });

export const getLegacyPost = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; id: number }) => {
    const accessToken = String(input?.accessToken ?? "");
    const id = Number(input?.id);
    if (!accessToken || !Number.isFinite(id)) throw new Error("Invalid request.");
    return { accessToken, id };
  })
  .handler(async ({ data }): Promise<LegacyBlogPost | null> => {
    const m = await import("./legacy-blog.server");
    await m.requireStaff(data.accessToken);
    return await m.getPost(data.id);
  });

export const createLegacyPost = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }): Promise<LegacyBlogPost> => {
    const m = await import("./legacy-blog.server");
    await m.requireStaff(data.accessToken);
    return await m.createPost(data.post);
  });

export const updateLegacyPost = createServerFn({ method: "POST" })
  .inputValidator((input: RawInput) => {
    const v = validate(input);
    if (!v.id) throw new Error("Missing post id.");
    return { ...v, id: v.id };
  })
  .handler(async ({ data }): Promise<LegacyBlogPost> => {
    const m = await import("./legacy-blog.server");
    await m.requireStaff(data.accessToken);
    return await m.updatePost(data.id, data.post);
  });

export const deleteLegacyPost = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; id: number }) => {
    const accessToken = String(input?.accessToken ?? "");
    const id = Number(input?.id);
    if (!accessToken || !Number.isFinite(id)) throw new Error("Invalid request.");
    return { accessToken, id };
  })
  .handler(async ({ data }): Promise<{ deleted: boolean }> => {
    const m = await import("./legacy-blog.server");
    await m.requireStaff(data.accessToken);
    await m.deletePost(data.id);
    return { deleted: true };
  });

export const listBlogCategories = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => {
    const accessToken = String(input?.accessToken ?? "");
    if (!accessToken) throw new Error("Not signed in.");
    return { accessToken };
  })
  .handler(async ({ data }): Promise<string[]> => {
    const m = await import("./legacy-blog.server");
    await m.requireStaff(data.accessToken);
    return await m.listCategories();
  });

export const addBlogCategory = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; name: string }) => {
    const accessToken = String(input?.accessToken ?? "");
    const name = String(input?.name ?? "").trim().slice(0, 60);
    if (!accessToken) throw new Error("Not signed in.");
    if (!name) throw new Error("Enter a category name.");
    return { accessToken, name };
  })
  .handler(async ({ data }): Promise<{ name: string }> => {
    const m = await import("./legacy-blog.server");
    await m.requireStaff(data.accessToken);
    const name = await m.addCategory(data.name, slugify(data.name));
    return { name };
  });

export const getBlogSchemaStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => {
    const accessToken = String(input?.accessToken ?? "");
    if (!accessToken) throw new Error("Not signed in.");
    return { accessToken };
  })
  .handler(async ({ data }) => {
    const m = await import("./legacy-blog.server");
    await m.requireStaff(data.accessToken);
    return await m.schemaStatus();
  });

/* ------------------------------ public reads ------------------------------ */

export const publicBlogList = createServerFn({ method: "GET" }).handler(
  async (): Promise<LegacyBlogPost[]> => {
    const m = await import("./legacy-blog.server");
    try {
      return await m.listPublishedPosts();
    } catch {
      return [];
    }
  },
);

export const publicBlogPost = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input?.slug ?? "").slice(0, 200) }))
  .handler(async ({ data }): Promise<LegacyBlogPost | null> => {
    const m = await import("./legacy-blog.server");
    try {
      return await m.getPublishedPost(data.slug);
    } catch {
      return null;
    }
  });
