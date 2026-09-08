import { createServerFn } from "@tanstack/react-start";
import type { LegacyBlogPost } from "./legacy-blog.server";

export type { LegacyBlogPost };

const str = (v: unknown, max: number): string | null => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

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
};

function validate(input: RawInput) {
  const accessToken = String(input?.accessToken ?? "");
  if (!accessToken) throw new Error("Not signed in.");
  const title = str(input?.title, 255);
  if (!title) throw new Error("A title is required.");
  const slug = str(input?.slug, 255) ?? slugify(title);
  const readTimeNum = Number(input?.read_time);
  return {
    accessToken,
    id: input?.id != null ? Number(input.id) : null,
    post: {
      title,
      slug: slugify(slug),
      category: str(input?.category, 60),
      excerpt: str(input?.excerpt, 1000),
      body: String(input?.body ?? ""),
      image_url: str(input?.image_url, 1000),
      author_name: str(input?.author_name, 120),
      author_initials: str(input?.author_initials, 8),
      author_color: str(input?.author_color, 20),
      read_time: Number.isFinite(readTimeNum) && readTimeNum > 0 ? Math.round(readTimeNum) : null,
      status: input?.status === "published" ? "published" : "draft",
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
