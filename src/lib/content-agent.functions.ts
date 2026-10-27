import { createServerFn } from "@tanstack/react-start";

export type TopicOverlap = { slug: string; title: string; source: "AutoSEO" | "Manual" };

/**
 * Staff-only, read-only check of a proposed topic against published articles, using the same search-intent logic that
 * already consolidates overlapping AutoSEO articles. It reads published articles only, writes nothing and publishes nothing.
 */
export const checkContentTopic = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; title: string; keywords?: string }) => {
    const accessToken = String(input?.accessToken ?? "");
    if (!accessToken) throw new Error("Not signed in.");
    const title = String(input?.title ?? "").trim().slice(0, 200);
    if (!title) throw new Error("A topic title is required.");
    return { accessToken, title, keywords: String(input?.keywords ?? "").trim().slice(0, 300) };
  })
  .handler(async ({ data }): Promise<{ overlaps: TopicOverlap[]; checked: number }> => {
    const { requireStaff } = await import("./legacy-blog.server");
    await requireStaff(data.accessToken);
    const [auto, legacy] = await Promise.all([import("./autoseo-blog.server"), import("./legacy-blog.server")]);
    const incoming = auto.derivePrimaryIntent({ title: data.title, metaKeywords: data.keywords || null, tags: null });
    const [autoPosts, manualPosts] = await Promise.all([auto.listAutoseoPostsPublic(true), legacy.listPublishedPosts()]);
    const overlaps: TopicOverlap[] = [];
    if (incoming) {
      for (const p of autoPosts) {
        const intent = auto.derivePrimaryIntent({ title: p.title, metaKeywords: p.meta_keywords ?? null, tags: p.tags ?? null });
        if (intent && auto.intentsOverlap(incoming, intent)) overlaps.push({ slug: p.slug, title: p.title, source: "AutoSEO" });
      }
      for (const p of manualPosts) {
        const intent = auto.derivePrimaryIntent({ title: p.title, metaKeywords: null, tags: null });
        if (intent && auto.intentsOverlap(incoming, intent)) overlaps.push({ slug: p.slug, title: p.title, source: "Manual" });
      }
    }
    return { overlaps, checked: autoPosts.length + manualPosts.length };
  });
