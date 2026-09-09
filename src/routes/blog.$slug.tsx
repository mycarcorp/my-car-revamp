import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { formatDate } from "@/lib/format";
import { publicBlogPost } from "@/lib/legacy-blog.functions";
import {
  escapeHtml,
  normalizeCta,
  normalizeHeadingStyles,
  sanitizeHtml,
  type HeadingStyle,
} from "@/lib/blog-content";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const post = await publicBlogPost({ data: { slug: params.slug } });
    if (!post) throw notFound();
    return { post };
  },
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center text-sm text-muted-foreground">
      This article is unavailable right now.
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-bold">Article not found</h1>
      <Link to="/blog" className="mt-4 inline-block text-sm text-primary">
        ← All articles
      </Link>
    </div>
  ),
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Article unavailable — MyCar" }, { name: "robots", content: "noindex" }] };
    }
    const p = loaderData.post;
    const title = (p.meta_title as string) || `${p.title} — MyCar`;
    const description =
      (p.meta_description as string) ||
      p.excerpt ||
      `${p.title} — from the MyCar team in Fredericksburg, VA.`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (p.image_url?.startsWith("https://")) {
      meta.push(
        { property: "og:image", content: p.image_url },
        { name: "twitter:image", content: p.image_url },
      );
    }
    return { meta };
  },
  component: BlogPost,
});

const rule = (selector: string, s: HeadingStyle) =>
  `${selector}{font-size:${s.fontSize};font-weight:${s.fontWeight};line-height:${s.lineHeight};text-align:${s.textAlign};color:${s.color};}`;

function BlogPost() {
  const { post } = Route.useLoaderData();
  const styles = normalizeHeadingStyles(post.heading_styles);
  const cta = normalizeCta(post.primary_cta);

  const bodyHtml = /<(h1|h2|h3|p)[\s>]/i.test(post.body ?? "")
    ? sanitizeHtml(post.body ?? "")
    : String(post.body ?? "")
        .split(/\n\s*\n/)
        .filter((p) => p.trim())
        .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
        .join("");

  const css = [
    rule(".blog-body h1", styles.h1),
    rule(".blog-body h2", styles.h2),
    rule(".blog-body h3", styles.h3),
    ".blog-body h1,.blog-body h2,.blog-body h3{margin-top:1.6em;margin-bottom:.5em;}",
    ".blog-body p{margin-bottom:1.1em;line-height:1.75;}",
    ".blog-body a{color:hsl(var(--primary));text-decoration:underline;}",
    ".blog-body ul,.blog-body ol{margin:0 0 1.1em 1.25em;list-style:disc;}",
  ].join("");

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <Link to="/blog" className="text-sm text-muted-foreground hover:text-primary">
        ← All articles
      </Link>
      <h1 className="mt-4 font-display text-4xl font-bold">{post.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {formatDate(post.published_at)}
        {post.author_name ? ` · ${post.author_name}` : ""}
        {post.category ? ` · ${post.category}` : ""}
        {post.read_time ? ` · ${post.read_time} min read` : ""}
      </p>
      {post.image_url && (
        <img
          src={post.image_url}
          alt={post.title}
          className="mt-8 aspect-[16/9] w-full rounded-xl object-cover"
        />
      )}
      <div
        className="blog-body mt-8 text-base text-foreground/90"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />

      {cta.enabled && (cta.headline || cta.button_text) && (
        <aside className="mt-12 rounded-xl border border-border bg-card p-8 text-center">
          {cta.headline && <h2 className="font-display text-2xl font-bold">{cta.headline}</h2>}
          {cta.button_text && cta.url && (
            <a
              href={cta.url}
              {...(/^https?:/i.test(cta.url) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="mt-5 inline-flex items-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
            >
              {cta.button_text}
            </a>
          )}
        </aside>
      )}
    </article>
  );
}
