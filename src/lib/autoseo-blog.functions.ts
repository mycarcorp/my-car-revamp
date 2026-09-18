import { createServerFn } from "@tanstack/react-start";
import type { AutoseoPost } from "./autoseo-blog.server";

export type { AutoseoPost };

/** AutoSEO row as shown in the admin list (extra optional columns tolerated). */
export type AutoseoAdminPost = AutoseoPost & {
  status?: string | null;
  published_url?: string | null;
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
  .inputValidator((input: { slug: string }) => ({ slug: String(input?.slug ?? "").slice(0, 200) }))
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
