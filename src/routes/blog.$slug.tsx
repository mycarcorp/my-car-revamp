import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { formatDate } from "@/lib/format";
import { publicBlogPost } from "@/lib/legacy-blog.functions";
import { publicAutoseoSummaryList, publicAutoseoPost, type AutoseoPost } from "@/lib/autoseo-blog.functions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { escapeHtml, normalizeCta, normalizeHeadingStyles, sanitizeHtml, type HeadingStyle } from "@/lib/blog-content";
import { normalizeArticleLists } from "@/lib/article-lists";
import { buildBlogPostingJsonLd, buildBreadcrumbJsonLd, jsonLdScript } from "@/lib/seo";
import logoUrl from "@/assets/mycar-logo.png";

const ORIGIN = "https://mycarcorp.com";

type Faq = {
  question: string;
  answer: string;
};

const faqList = (post: AutoseoPost): Faq[] =>
  Array.isArray(post.faq_schema) ? post.faq_schema.filter((f) => f && f.question && f.answer) : [];

/* -------------------------------------------------------------------------- */
/* SEO INTENT HELPERS                                                         */
/* -------------------------------------------------------------------------- */

/**
 * These words do not normally change the primary organic-search intent.
 *
 * IMPORTANT:
 * Meaningful financing modifiers such as:
 *
 * - pre approval
 * - pre qualification
 * - bad credit
 * - interest rates
 * - down payment
 *
 * are intentionally NOT removed.
 */
const INTENT_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "best",
  "by",
  "for",
  "from",
  "guide",
  "how",
  "in",
  "is",
  "it",
  "my",
  "of",
  "on",
  "the",
  "to",
  "what",
  "when",
  "where",
  "why",
  "with",
  "your",
  "you",

  // Local modifiers.
  "fredericksburg",
  "virginia",
  "va",
]);

const INTENT_SYNONYMS: Record<string, string> = {
  automobiles: "car",
  automobile: "car",
  cars: "car",
  vehicles: "vehicle",
  loans: "loan",
  rates: "rate",
  payments: "payment",
  dealerships: "dealership",
  dealers: "dealer",
};

function normalizeIntentText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bpre[\s-]?approved\b/g, "pre approval")
    .replace(/\bpre[\s-]?approve\b/g, "pre approval")
    .replace(/\bpre[\s-]?approval\b/g, "pre approval")
    .replace(/\bpre[\s-]?qualified\b/g, "pre qualification")
    .replace(/\bpre[\s-]?qualify\b/g, "pre qualification")
    .replace(/\bpre[\s-]?qualification\b/g, "pre qualification")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function intentTokens(value: string): string[] {
  const normalized = normalizeIntentText(value);

  if (!normalized) return [];

  return normalized
    .split(" ")
    .map((token) => INTENT_SYNONYMS[token] ?? token)
    .filter((token) => token.length > 1 && !INTENT_STOP_WORDS.has(token));
}

function normalizePrimaryIntent(value: string): string {
  return Array.from(new Set(intentTokens(value)))
    .sort()
    .join(" ");
}

function derivePrimaryIntent(post: { title: string; meta_keywords?: string | null; tags?: string | null }): string {
  const keywords = String(post.meta_keywords ?? "").trim();

  if (keywords) {
    const firstKeyword =
      keywords
        .split(",")
        .map((item) => item.trim())
        .find(Boolean) ?? keywords;

    const normalizedKeyword = normalizePrimaryIntent(firstKeyword);

    if (normalizedKeyword) return normalizedKeyword;
  }

  const normalizedTitle = normalizePrimaryIntent(post.title);

  if (normalizedTitle) return normalizedTitle;

  return normalizePrimaryIntent(post.tags ?? "");
}

function intentSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const setA = new Set(a.split(" ").filter(Boolean));
  const setB = new Set(b.split(" ").filter(Boolean));

  if (!setA.size || !setB.size) return 0;

  let intersection = 0;

  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }

  const union = new Set([...setA, ...setB]).size;

  return union ? intersection / union : 0;
}

function intentsOverlap(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;

  /**
   * High threshold on purpose.
   *
   * We only want to consolidate articles that are very likely targeting
   * essentially the same query.
   */
  return intentSimilarity(a, b) >= 0.82;
}

function articleTimestamp(article: AutoseoPost): number {
  const value = article.published_at ?? article.created_at ?? "";

  const time = value ? new Date(value).getTime() : 0;

  return Number.isFinite(time) ? time : 0;
}

/**
 * Determine which AutoSEO article owns a search intent.
 *
 * The oldest established URL wins.
 */
function getIntentOwner(article: AutoseoPost, all: AutoseoPost[]): AutoseoPost {
  const intent = derivePrimaryIntent(article);

  if (!intent) return article;

  const matches = all.filter((candidate) => {
    const candidateIntent = derivePrimaryIntent(candidate);

    return candidateIntent && intentsOverlap(intent, candidateIntent);
  });

  if (matches.length <= 1) return article;

  return [...matches].sort((a, b) => {
    const aTime = articleTimestamp(a);
    const bTime = articleTimestamp(b);

    if (aTime !== bTime) {
      return aTime - bTime;
    }

    return a.id - b.id;
  })[0]!;
}

/**
 * Public AutoSEO collection with one URL per primary intent.
 *
 * The original ordering is preserved.
 */
function dedupeByIntent(posts: AutoseoPost[]): AutoseoPost[] {
  const owners = new Set<number>();

  for (const post of posts) {
    const owner = getIntentOwner(post, posts);
    owners.add(owner.id);
  }

  return posts.filter((post) => owners.has(post.id));
}

/**
 * Related articles should be relevant without repeating the same primary
 * search intent as the current article.
 */
function getRelatedArticles(article: AutoseoPost, all: AutoseoPost[], limit = 3): AutoseoPost[] {
  const currentIntent = derivePrimaryIntent(article);

  const clean = dedupeByIntent(all).filter((candidate) => {
    if (candidate.slug === article.slug) return false;

    const candidateIntent = derivePrimaryIntent(candidate);

    if (currentIntent && candidateIntent && intentsOverlap(currentIntent, candidateIntent)) {
      return false;
    }

    return true;
  });

  const currentTokens = new Set(currentIntent.split(" ").filter(Boolean));

  /**
   * Rank related posts by shared intent vocabulary.
   *
   * This means a financing article is more likely to link to another useful
   * financing topic, but not another article targeting the exact same query.
   */
  const scored = clean.map((candidate, index) => {
    const candidateIntent = derivePrimaryIntent(candidate);

    const candidateTokens = new Set(candidateIntent.split(" ").filter(Boolean));

    let shared = 0;

    for (const token of currentTokens) {
      if (candidateTokens.has(token)) shared += 1;
    }

    return {
      candidate,
      shared,
      index,
    };
  });

  return scored
    .sort((a, b) => {
      if (b.shared !== a.shared) return b.shared - a.shared;
      return a.index - b.index;
    })
    .slice(0, limit)
    .map((item) => item.candidate);
}

/* -------------------------------------------------------------------------- */
/* ROUTE                                                                      */
/* -------------------------------------------------------------------------- */

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    /**
     * Hand-written/legacy articles remain unchanged.
     */
    const post = await publicBlogPost({
      data: {
        slug: params.slug,
      },
    });

    if (post) {
      return {
        kind: "legacy" as const,
        post,
        related: [] as AutoseoPost[],
      };
    }

    /**
     * AutoSEO article.
     */
    const article = await publicAutoseoPost({
      data: {
        slug: params.slug,
      },
    });

    if (!article) throw notFound();

    const all = await publicAutoseoSummaryList();

    /**
     * Find the established URL that owns this article's primary intent.
     */
    const owner = getIntentOwner(article, all);

    /**
     * If this URL is a newer overlapping AutoSEO article, permanently redirect
     * visitors and search engines to the established primary URL.
     *
     * This is the actual consolidation layer that prevents multiple URLs from
     * continuing to compete for essentially the same search intent.
     */
    if (owner.slug !== article.slug) {
      throw redirect({
        to: "/blog/$slug",
        params: {
          slug: owner.slug,
        },
        statusCode: 301,
      });
    }

    const related = getRelatedArticles(article, all, 3);

    return {
      kind: "autoseo" as const,
      article,
      related,
    };
  },

  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center text-sm text-muted-foreground">
      This article is unavailable right now.
    </div>
  ),

  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-bold">Article not found</h1>

      <p className="mt-3 text-sm text-muted-foreground">
        The article you&apos;re looking for may have moved or been removed.
      </p>

      <Link to="/blog" className="mt-5 inline-block cursor-pointer text-sm font-semibold text-primary">
        ← Back to all articles
      </Link>
    </div>
  ),

  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          {
            title: "Article unavailable — MyCar",
          },
          {
            name: "robots",
            content: "noindex",
          },
        ],
      };
    }

    const url = `${ORIGIN}/blog/${params.slug}`;

    /* ---------------------------------------------------------------------- */
    /* AutoSEO metadata                                                       */
    /* ---------------------------------------------------------------------- */

    if (loaderData.kind === "autoseo") {
      const a = loaderData.article;

      const canonicalUrl = `${ORIGIN}/blog/${a.slug}`;

      const title = `${a.title} | MyCar`;

      const description =
        a.meta_description ??
        (a.content_html ?? "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 160);

      const meta: Array<Record<string, string>> = [
        {
          title,
        },
        {
          name: "description",
          content: description,
        },
        {
          property: "og:title",
          content: title,
        },
        {
          property: "og:description",
          content: description,
        },
        {
          property: "og:type",
          content: "article",
        },
        {
          property: "og:url",
          content: canonicalUrl,
        },
        {
          name: "twitter:card",
          content: "summary_large_image",
        },
        {
          name: "twitter:title",
          content: title,
        },
        {
          name: "twitter:description",
          content: description,
        },
      ];

      if (a.meta_keywords) {
        meta.push({
          name: "keywords",
          content: a.meta_keywords,
        });
      }

      if (a.hero_image_url?.startsWith("https://")) {
        meta.push(
          {
            property: "og:image",
            content: a.hero_image_url,
          },
          {
            name: "twitter:image",
            content: a.hero_image_url,
          },
        );
      }

      const scripts: Array<Record<string, string>> = [
        jsonLdScript(
          buildBlogPostingJsonLd(
            {
              url: canonicalUrl,
              headline: a.title,
              description,
              image: a.hero_image_url,
              datePublished: a.published_at,
              dateModified: a.updated_at,
            },
            logoUrl,
          ),
        ),
        jsonLdScript(
          buildBreadcrumbJsonLd([
            { name: "Blog", path: "/blog" },
            { name: a.title, path: `/blog/${a.slug}` },
          ]),
        ),
      ];

      const faqs = faqList(a);

      if (faqs.length > 0) {
        scripts.push({
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: f.answer,
              },
            })),
          }),
        });
      }

      return {
        meta,
        links: [
          {
            rel: "canonical",
            href: canonicalUrl,
          },
        ],
        scripts,
      };
    }

    /* ---------------------------------------------------------------------- */
    /* Legacy article metadata                                                */
    /* ---------------------------------------------------------------------- */

    const p = loaderData.post;

    const title = (p.meta_title as string) || `${p.title} | MyCar`;

    const description =
      (p.meta_description as string) || p.excerpt || `${p.title} — from the MyCar team in Fredericksburg, VA.`;

    const meta: Array<Record<string, string>> = [
      {
        title,
      },
      {
        name: "description",
        content: description,
      },
      {
        property: "og:title",
        content: title,
      },
      {
        property: "og:description",
        content: description,
      },
      {
        property: "og:type",
        content: "article",
      },
      {
        property: "og:url",
        content: url,
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
    ];

    if (p.image_url?.startsWith("https://")) {
      meta.push(
        {
          property: "og:image",
          content: p.image_url,
        },
        {
          name: "twitter:image",
          content: p.image_url,
        },
      );
    }

    return {
      meta,
      links: [
        {
          rel: "canonical",
          href: url,
        },
      ],
      scripts: [
        jsonLdScript(
          buildBlogPostingJsonLd(
            {
              url,
              headline: p.title,
              description,
              image: p.image_url,
              datePublished: p.published_at,
              dateModified: p.updated_at,
              authorName: p.author_name,
            },
            logoUrl,
          ),
        ),
        jsonLdScript(
          buildBreadcrumbJsonLd([
            { name: "Blog", path: "/blog" },
            { name: p.title, path: `/blog/${params.slug}` },
          ]),
        ),
      ],
    };
  },

  component: BlogPostRoute,
});

/* -------------------------------------------------------------------------- */
/* ROUTE COMPONENT                                                            */
/* -------------------------------------------------------------------------- */

function BlogPostRoute() {
  const data = Route.useLoaderData();

  return data.kind === "autoseo" ? <AutoseoArticle article={data.article} related={data.related} /> : <LegacyPost />;
}

/* -------------------------------------------------------------------------- */
/* AutoSEO article                                                            */
/* -------------------------------------------------------------------------- */

const PROSE_CSS = [
  ".prose-article{max-width:720px;}",
  ".prose-article h2{font-size:1.5rem;font-weight:700;margin-top:1.75rem;margin-bottom:.6rem;}",
  ".prose-article h3{font-size:1.25rem;font-weight:700;margin-top:1.5rem;margin-bottom:.5rem;}",
  ".prose-article p{font-size:1rem;line-height:1.75;margin-bottom:1rem;color:hsl(var(--muted-foreground));}",
  ".prose-article ul{list-style:disc;padding-left:1.5rem;margin-bottom:1rem;}",
  ".prose-article ol{list-style:decimal;padding-left:1.5rem;margin-bottom:1rem;}",
  ".prose-article li{margin-bottom:.5rem;}",
  ".prose-article blockquote{border-left:4px solid hsl(var(--primary));padding-left:1rem;font-style:italic;color:hsl(var(--muted-foreground));margin:1.25rem 0;}",
  ".prose-article code{background:rgba(148,163,184,.18);padding:2px 6px;border-radius:4px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;}",
  ".prose-article pre{background:#0f172a;color:#f1f5f9;padding:1rem;border-radius:.5rem;overflow-x:auto;margin:1.25rem 0;}",
  ".prose-article pre code{background:transparent;padding:0;color:inherit;}",
  ".prose-article table{width:100%;border-collapse:collapse;margin:1.5rem 0;}",
  ".prose-article th,.prose-article td{border:1px solid hsl(var(--border));padding:.65rem;text-align:left;}",
  ".prose-article tbody tr:nth-child(even){background:rgba(148,163,184,.06);}",
  ".prose-article .table-scroll{overflow-x:auto;}",
  ".prose-article img{max-width:100%;height:auto;border-radius:.5rem;display:block;margin:1.5rem auto;}",
  ".prose-article a{color:hsl(var(--primary));text-decoration:none;}",
  ".prose-article a:hover{text-decoration:underline;}",
].join("");

function AutoseoArticle({ article, related }: { article: AutoseoPost; related: AutoseoPost[] }) {
  const faqs = faqList(article);

  const html = normalizeArticleLists(article.content_html ?? "")
    .replace(/<table\b/gi, '<div class="table-scroll"><table')
    .replace(/<\/table>/gi, "</table></div>")
    .replace(/<img\b(?![^>]*onerror)/gi, "<img onerror=\"this.style.display='none'\" ");

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <style
        dangerouslySetInnerHTML={{
          __html: PROSE_CSS,
        }}
      />

      <Link to="/blog" className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-primary">
        ← Back to all articles
      </Link>

      {article.hero_image_url && (
        <img
          src={article.hero_image_url}
          alt={article.hero_image_alt ?? article.title}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          className="mt-6 max-h-[400px] w-full rounded-xl object-cover"
        />
      )}

      <h1 className="mt-7 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{article.title}</h1>

      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {formatDate(article.published_at)}
        {article.reading_time ? ` · ${article.reading_time} min read` : ""}
      </p>

      <div
        className="prose-article mt-8 text-foreground/90"
        dangerouslySetInnerHTML={{
          __html: html,
        }}
      />

      {article.infographic_url && (
        <img
          src={article.infographic_url}
          alt={`${article.title} infographic`}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          className="mt-10 w-full rounded-xl border border-border"
        />
      )}

      {faqs.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">Frequently Asked Questions</h2>

          <Accordion type="single" collapsible defaultValue="faq-0" className="mt-4">
            {faqs.map((f, i) => (
              <AccordionItem key={`${i}-${f.question}`} value={`faq-${i}`}>
                <AccordionTrigger className="cursor-pointer text-left font-semibold">{f.question}</AccordionTrigger>

                <AccordionContent className="text-sm leading-6 text-muted-foreground">{f.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-2xl font-bold">Related articles</h2>

          <div className="mt-4 space-y-3">
            {related.map((r) => (
              <Link
                key={r.id}
                to="/blog/$slug"
                params={{
                  slug: r.slug,
                }}
                className="flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                {r.hero_image_url ? (
                  <img
                    src={r.hero_image_url}
                    alt={r.hero_image_alt ?? r.title}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                    className="h-16 w-24 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-16 w-24 shrink-0 rounded-lg bg-muted" />
                )}

                <div>
                  <p className="font-semibold leading-snug">{r.title}</p>

                  <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                    {formatDate(r.published_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <nav aria-label="Next steps" className="mt-14 rounded-xl border border-border bg-card p-5 text-sm">
        <h2 className="font-display text-lg font-bold">Ready for your next vehicle?</h2>
        <p className="mt-2 text-muted-foreground">
          <Link to="/search" className="font-semibold text-primary hover:underline">
            Browse used cars in Fredericksburg, VA
          </Link>
          , <Link to="/sell" className="font-semibold text-primary hover:underline">sell or trade your car</Link>, or{" "}
          <Link to="/schedule" className="font-semibold text-primary hover:underline">schedule a test drive</Link>.
        </p>
      </nav>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Existing hand-written post                                                 */
/* -------------------------------------------------------------------------- */

const rule = (selector: string, s: HeadingStyle) =>
  `${selector}{font-size:${s.fontSize};font-weight:${s.fontWeight};line-height:${s.lineHeight};text-align:${s.textAlign};color:${s.color};background-color:${s.backgroundColor ?? "transparent"};${s.marginTop ? `margin-top:${s.marginTop};` : ""}${s.marginBottom ? `margin-bottom:${s.marginBottom};` : ""}${s.paddingLeft ? `padding-left:${s.paddingLeft};` : ""}}`;

function LegacyPost() {
  const data = Route.useLoaderData();

  if (data.kind !== "legacy") return null;

  const post = data.post;

  const styles = normalizeHeadingStyles(post.heading_styles);

  const cta = normalizeCta(post.primary_cta);

  const bodyHtml = /<(h1|h2|h3|h4|p|ul|ol|blockquote|table)[\s>]/i.test(post.body ?? "")
    ? normalizeArticleLists(sanitizeHtml(post.body ?? ""))
    : String(post.body ?? "")
        .split(/\n\s*\n/)
        .filter((p) => p.trim())
        .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
        .join("");

  const responsiveBodyHtml = bodyHtml
    .replace(/<table\b/gi, '<div class="blog-table-wrap"><table')
    .replace(/<\/table>/gi, "</table></div>");

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
      <style
        dangerouslySetInnerHTML={{
          __html: css,
        }}
      />

      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-8 lg:px-12">
        <Link to="/blog" className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-primary">
          ← All articles
        </Link>

        <div className="relative mt-6 aspect-[16/7] min-h-[280px] overflow-hidden rounded-2xl bg-muted">
          {post.image_url && (
            <img
              src={post.image_url}
              alt={post.title}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />

          <div className="relative flex h-full items-end p-6 sm:p-10 lg:p-14">
            <div className="max-w-4xl text-left text-white">
              {post.category && (
                <span className="inline-flex rounded-full border border-white/40 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/90 backdrop-blur-sm">
                  {post.category}
                </span>
              )}

              <h1 className="mt-4 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl lg:text-7xl">
                {post.title}
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-8 lg:grid-cols-[minmax(0,720px)_280px] lg:px-12">
        <div
          className="blog-body text-base text-foreground/90"
          dangerouslySetInnerHTML={{
            __html: responsiveBodyHtml,
          }}
        />

        <aside className="space-y-8">
          {cta.enabled && (cta.headline || cta.button_text) && (
            <div className="rounded-xl border border-border bg-card p-6">
              {cta.headline && <h2 className="font-display text-2xl font-bold">{cta.headline}</h2>}

              {cta.button_text && cta.url && (
                <a
                  href={cta.url}
                  {...(/^https?:/i.test(cta.url)
                    ? {
                        target: "_blank",
                        rel: "noopener noreferrer",
                      }
                    : {})}
                  className="mt-5 inline-flex cursor-pointer items-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
                >
                  {cta.button_text}
                </a>
              )}
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              About this article
            </p>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Practical guidance from the MyCar team in Fredericksburg, Virginia.
            </p>
          </div>
        </aside>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-8 lg:px-12">
        <div className="max-w-[720px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {formatDate(post.published_at)}

          {post.author_name ? ` · ${post.author_name}` : ""}

          {post.read_time ? ` · ${post.read_time} min read` : ""}
        </div>
      </div>
    </article>
  );
}
