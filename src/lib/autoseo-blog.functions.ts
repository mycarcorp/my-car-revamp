import { createServerFn } from "@tanstack/react-start";
import type {
  AutoseoAdminUpdate,
  AutoseoPost,
} from "./autoseo-blog.server";

export type { AutoseoPost };

/** AutoSEO row as shown in the admin list (extra optional columns tolerated). */
export type AutoseoAdminPost = AutoseoPost & {
  status?: string | null;
  published_url?: string | null;
  is_featured?: boolean | null;
};

export const publicAutoseoList = createServerFn({ method: "GET" }).handler(
  async (): Promise<AutoseoPost[]> => {
    try {
      const m = await import("./autoseo-blog.server");
      return await m.listAutoseoPosts();
    } catch {
      return [];
    }
  },
);

export const publicAutoseoPost = createServerFn({ method: "GET" })
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

/** Staff-only read of every AutoSEO article (drafts included). */
export const listAutoseoAdminPosts = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => {
    const accessToken = String(input?.accessToken ?? "");
    if (!accessToken) throw new Error("Not signed in.");
    return { accessToken };
  })
  .handler(async ({ data }): Promise<AutoseoAdminPost[]> => {
    const auth = await import("./legacy-blog.server");
    await auth.requireStaff(data.accessToken);

    const m = await import("./autoseo-blog.server");
    return (await m.listAutoseoAdminRows()) as AutoseoAdminPost[];
  });

/** Staff-only update of an AutoSEO article's editable content fields. */
export const updateAutoseoAdminPost = createServerFn({ method: "POST" })
  .inputValidator(
    (
      input: AutoseoAdminUpdate & {
        accessToken: string;
      },
    ) => {
      const accessToken = String(input?.accessToken ?? "");
      if (!accessToken) throw new Error("Not signed in.");

      const id = Number(input?.id);
      if (!Number.isFinite(id)) throw new Error("Invalid AutoSEO post id.");

      return {
        accessToken,
        id,
        title: String(input?.title ?? "").trim(),
        slug: String(input?.slug ?? "").trim(),
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
  .handler(async ({ data }): Promise<{ ok: true }> => {
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

    return { ok: true };
  });

/** Staff-only publish/unpublish of an AutoSEO article. */
export const setAutoseoPublishedAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; id: number; published: boolean }) => {
    const accessToken = String(input?.accessToken ?? "");
    if (!accessToken) throw new Error("Not signed in.");
    const id = Number(input?.id);
    if (!Number.isFinite(id)) throw new Error("Invalid AutoSEO post id.");
    return { accessToken, id, published: Boolean(input?.published) };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const auth = await import("./legacy-blog.server");
    await auth.requireStaff(data.accessToken);
    const m = await import("./autoseo-blog.server");
    await m.setAutoseoPublished(data.id, data.published);
    return { ok: true };
  });

/** Staff-only: mark one AutoSEO article as the featured post. */
export const setFeaturedAutoseoPostAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; id: number }) => {
    const accessToken = String(input?.accessToken ?? "");
    if (!accessToken) throw new Error("Not signed in.");
    const id = Number(input?.id);
    if (!Number.isFinite(id)) throw new Error("Invalid AutoSEO post id.");
    return { accessToken, id };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const auth = await import("./legacy-blog.server");
    await auth.requireStaff(data.accessToken);
    const m = await import("./autoseo-blog.server");
    await m.setFeaturedAutoseoPost(data.id);
    return { ok: true };
  });
