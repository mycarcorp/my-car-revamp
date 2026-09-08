import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQuery } from "@tanstack/react-query";
import { blogListQuery, blogPostQuery, type BlogPost as BlogPostRow } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";

const SITE_URL = "https://mycarcorp.com";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ context, params }) => {
    const post = await context.queryClient.ensureQueryData(blogPostQuery(params.slug));
    if (!post || !post.published) throw notFound();
    return { post };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Article unavailable — MyCar" }, { name: "robots", content: "noindex" }],
      };
    }
    const p = loaderData.post;
    const canonical = `${SITE_URL}/blog/${params.slug}`;
    const description =
      p.meta_description ?? p.excerpt ?? `${p.title} — from the MyCar team in Fredericksburg, VA.`;
    const title = p.seo_title ?? `${p.title} — MyCar`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: p.seo_title ?? p.title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: canonical },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: p.seo_title ?? p.title },
      { name: "twitter:description", content: description },
    ];
    if (p.cover_image_url?.startsWith("https://")) {
      meta.push(
        { property: "og:image", content: p.cover_image_url },
        { name: "twitter:image", content: p.cover_image_url },
      );
    }
    return { meta, links: [{ rel: "canonical", href: canonical }] };
  },
  component: BlogPost,
});

/** Pull "### Question?" headings and the text under them into FAQ pairs. */
function extractFaq(body: string) {
  const out: { question: string; answer: string }[] = [];
  const lines = body.split("\n");
  let current: { question: string; answer: string[] } | null = null;
  for (const line of lines) {
    const heading = /^(#{2,4})\s+(.*\?)\s*$/.exec(line.trim());
    if (heading) {
      if (current) out.push({ question: current.question, answer: current.answer.join(" ").trim() });
      current = { question: heading[2], answer: [] };
      continue;
    }
    if (/^#{1,4}\s+/.test(line.trim())) {
      if (current) out.push({ question: current.question, answer: current.answer.join(" ").trim() });
      current = null;
      continue;
    }
    if (current && line.trim()) current.answer.push(line.trim());
  }
  if (current) out.push({ question: current.question, answer: current.answer.join(" ").trim() });
  return out.filter((f) => f.answer);
}

function readingMinutes(body: string) {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 225));
}

function BlogPost() {
  const { post } = Route.useLoaderData() as { post: BlogPostRow };
  const { data: all } = useQuery(blogListQuery());
  const canonical = `${SITE_URL}/blog/${post.slug}`;
  const faq = extractFaq(post.body ?? "");
  const tags = post.tags ?? [];

  const related = (all ?? [])
    .filter((p) => p.slug !== post.slug)
    .sort((a, b) => {
      const score = (p: BlogPostRow) =>
        (p.category && post.category && p.category === post.category ? 2 : 0) +
        (/financ|credit|loan|trade|buying/i.test(`${p.title} ${p.excerpt ?? ""}`) ? 1 : 0);
      return score(b as BlogPostRow) - score(a as BlogPostRow);
    })
    .slice(0, 3);

  const jsonLd: unknown[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.meta_description ?? post.excerpt ?? undefined,
      author: post.author_name ? { "@type": "Person", name: post.author_name } : undefined,
      datePublished: post.published_at ?? undefined,
      dateModified: post.updated_at ?? post.published_at ?? undefined,
      mainEntityOfPage: canonical,
      url: canonical,
      image: post.cover_image_url ?? undefined,
      articleSection: post.category ?? undefined,
      keywords: tags.length ? tags.join(", ") : undefined,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
        { "@type": "ListItem", position: 3, name: post.title, item: canonical },
      ],
    },
  ];
  if (faq.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link to="/" className="hover:text-primary">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link to="/blog" className="hover:text-primary">
              Blog
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="truncate text-foreground">{post.title}</li>
        </ol>
      </nav>

      {post.category && (
        <p className="mt-6 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          {post.category}
        </p>
      )}
      <h1 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl">
        {post.title}
      </h1>
      {post.excerpt && <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>}
      <p className="mt-4 text-sm text-muted-foreground">
        {formatDate(post.published_at)}
        {post.updated_at && post.updated_at !== post.published_at
          ? ` · Updated ${formatDate(post.updated_at)}`
          : ""}
        {post.author_name ? ` · ${post.author_name}` : ""}
        {post.body ? ` · ${readingMinutes(post.body)} min read` : ""}
      </p>

      {post.cover_image_url && (
        <img
          src={post.cover_image_url}
          alt={post.title}
          className="mt-8 aspect-[16/9] w-full rounded-xl object-cover"
        />
      )}

      <div className="prose-mycar mt-8 text-base leading-relaxed text-foreground/90">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h2 className="mt-10 font-display text-2xl font-bold text-foreground">{children}</h2>
            ),
            h2: ({ children }) => (
              <h2 className="mt-10 font-display text-2xl font-bold text-foreground">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="mt-8 font-display text-xl font-semibold text-foreground">{children}</h3>
            ),
            p: ({ children }) => <p className="mt-4">{children}</p>,
            strong: ({ children }) => (
              <strong className="font-semibold text-foreground">{children}</strong>
            ),
            ul: ({ children }) => <ul className="mt-4 list-disc space-y-2 pl-6">{children}</ul>,
            ol: ({ children }) => <ol className="mt-4 list-decimal space-y-2 pl-6">{children}</ol>,
            a: ({ href, children }) => (
              <a href={href} className="font-medium text-primary underline underline-offset-4">
                {children}
              </a>
            ),
            blockquote: ({ children }) => (
              <blockquote className="mt-6 border-l-4 border-primary/40 pl-4 italic">
                {children}
              </blockquote>
            ),
            table: ({ children }) => (
              <div className="mt-6 -mx-4 overflow-x-auto px-4">
                <table className="w-full min-w-[34rem] border-collapse overflow-hidden rounded-lg border border-border text-left text-sm">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
            th: ({ children }) => (
              <th className="border border-border px-3 py-2 font-semibold text-foreground">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-border px-3 py-2 align-top">{children}</td>
            ),
          }}
        >
          {post.body ?? ""}
        </ReactMarkdown>
      </div>

      {tags.length > 0 && (
        <ul className="mt-10 flex flex-wrap gap-2">
          {tags.map((t) => (
            <li
              key={t}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
            >
              {t}
            </li>
          ))}
        </ul>
      )}

      <section className="mt-12 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h2 className="font-display text-2xl font-bold">
          Ready to Start Shopping With a Clearer Financing Picture?
        </h2>
        <p className="mt-3 text-muted-foreground">
          Start by exploring your potential financing options, then browse available used vehicles
          that fit your needs.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/finance">Get Pre-Qualified</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/search">Explore Inventory</Link>
          </Button>
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl font-bold">Keep reading</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            {related.map((p) => (
              <li key={p.id}>
                <Link
                  to="/blog/$slug"
                  params={{ slug: p.slug }}
                  className="card-lift block h-full rounded-xl border border-border bg-card p-4"
                >
                  <p className="font-medium leading-snug">{p.title}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDate(p.published_at)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
