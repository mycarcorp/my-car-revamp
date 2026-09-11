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
  `${selector}{font-size:${s.fontSize};font-weight:${s.fontWeight};line-height:${s.lineHeight};text-align:${s.textAlign};color:${s.color};background-color:${s.backgroundColor ?? "transparent"};${s.marginTop ? `margin-top:${s.marginTop};` : ""}${s.marginBottom ? `margin-bottom:${s.marginBottom};` : ""}${s.paddingLeft ? `padding-left:${s.paddingLeft};` : ""}}`;

function BlogPost() {
  const { post } = Route.useLoaderData();
  const styles = normalizeHeadingStyles(post.heading_styles);
  const cta = normalizeCta(post.primary_cta);

  const bodyHtml = /<(h1|h2|h3|h4|p|ul|ol|blockquote|table)[\s>]/i.test(post.body ?? "")
    ? sanitizeHtml(post.body ?? "")
    : String(post.body ?? "")
        .split(/\n\s*\n/)
        .filter((p) => p.trim())
        .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
        .join("");

  const responsiveBodyHtml = bodyHtml.replace(/<table\b/gi, '<div class="blog-table-wrap"><table').replace(/<\/table>/gi, '</table></div>');

  const css = [
    rule(".blog-body h1", styles.h1),
    rule(".blog-body h2", styles.h2),
    rule(".blog-body h3", styles.h3),
    rule(".blog-body h4", styles.h4),
    ".blog-body h1,.blog-body h2,.blog-body h3,.blog-body h4{margin-top:1.6em;margin-bottom:.5em;}",
    ".blog-body p{margin-bottom:1.1em;line-height:1.75;}",
    ".blog-body a{color:hsl(var(--primary));text-decoration:underline;}",
    ".blog-body ul,.blog-body ol{margin:0 0 1.1em 1.25em;list-style:disc;}",
    ".blog-body .blog-table-wrap{margin:1.5em 0;overflow-x:auto;border:1px solid hsl(var(--border));border-radius:0.75rem;background:rgba(148,163,184,0.04);-webkit-overflow-scrolling:touch;}",
    ".blog-body table{width:100%;min-width:640px;border-collapse:collapse;table-layout:fixed;}",
    ".blog-body th,.blog-body td{padding:0.75rem;border:1px solid hsl(var(--border));vertical-align:top;text-align:left;}",
    ".blog-body th{font-weight:700;background:rgba(148,163,184,0.06);}",
    ".blog-body td p,.blog-body th p{margin:0;}",
    ".blog-body td ul,.blog-body td ol,.blog-body th ul,.blog-body th ol{margin:0.5em 0 0 1.1rem;}",
  ].join("");

  return (
    <article className="w-full overflow-x-hidden">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div className="relative -mx-[50vw] left-1/2 w-screen">
        <div className="relative h-[72vh] min-h-[440px] overflow-hidden bg-muted">
          {post.image_url && (
            <img
              src={post.image_url}
              alt={post.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />

          <div className="relative mx-auto flex h-full max-w-6xl items-end px-4 pb-8 sm:px-8 lg:px-12">
            <div className="max-w-4xl text-left text-white">
              {post.category && (
                <span className="inline-flex rounded-full border border-white/40 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/90 backdrop-blur-sm">
                  {post.category}
                </span>
              )}

              <h1 className="mt-4 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl lg:text-7xl">
                {post.title}
              </h1>

              <p className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/85 sm:text-base">
                <span>{formatDate(post.published_at)}</span>
                {post.author_name && <span>• {post.author_name}</span>}
                {post.read_time ? <span>• {post.read_time} min read</span> : null}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8 lg:px-12">
        <Link to="/blog" className="text-sm text-muted-foreground hover:text-primary">
          ← All articles
        </Link>

        <div
          className="blog-body mt-8 text-base text-foreground/90"
          dangerouslySetInnerHTML={{ __html: responsiveBodyHtml }}
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
      </div>
    </article>
  );
}
