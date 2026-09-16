import { createServerFn } from "@tanstack/react-start";
import type { AutoseoPost } from "./autoseo-blog.server";

export type { AutoseoPost };

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
