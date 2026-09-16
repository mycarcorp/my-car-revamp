import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDate } from "@/lib/format";
import { publicBlogList } from "@/lib/legacy-blog.functions";
import { publicAutoseoList } from "@/lib/autoseo-blog.functions";

type Card = {
  key: string;
  slug: string;
  title: string;
  excerpt: string | null;
  image: string | null;
  date: string | null;
  readTime: number | null;
  category: string | null;
  featured: boolean;
};

const PAGE = 12;
const trim = (s: string | null, n = 160) =>
  s ? (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s) : null;

export const Route = createFileRoute("/blog/")({
  loader: async () => {
    const [posts, articles] = await Promise.all([publicBlogList(), publicAutoseoList()]);

    const cards: Card[] = [
      ...posts.map((p) => ({
        key: `mc-${p.id}`,
        slug: p.slug,
        title: p.title,
        excerpt: trim(p.excerpt ?? p.meta_description ?? null),
        image: p.image_url ?? null,
        date: p.published_at ?? p.created_at ?? null,
        readTime: p.read_time ?? null,
        category: p.category ?? null,
        featured: Boolean(p.is_featured),
      })),
      ...articles.map((a) => ({
        key: `as-${a.id}`,
        slug: a.slug,
        title: a.title,
        excerpt: trim(a.meta_description),
        image: a.hero_image_url,
        date: a.published_at ?? a.created_at,
        readTime: a.reading_time,
        category: (a.tags ?? "").split(",")[0]?.trim() || null,
        featured: false,
      })),
    ].sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());

    return { cards };
  },
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <p className="text-sm text-muted-foreground">Couldn&apos;t load articles. Please try again.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-5 cursor-pointer rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Retry
      </button>
    </div>
  ),
  pendingComponent: () => (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:grid-cols-2 sm:px-8 lg:grid-cols-3 lg:px-12">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-border bg-card">
          <div className="aspect-[16/9] w-full bg-muted" />
          <div className="space-y-3 p-5">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-5 w-3/4 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  ),
  head: () => ({
    meta: [
      { title: "Blog | MyCar — Car Buying Advice & Dealership News" },
      { name: "description", content: "Read our latest articles and insights on buying, financing and trading in used cars in Fredericksburg, Virginia." },
      { property: "og:title", content: "Blog | MyCar" },
      { property: "og:description", content: "Read our latest articles and insights." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://mycarcorp.com/blog" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://mycarcorp.com/blog" }],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const { cards } = Route.useLoaderData();
  const [visible, setVisible] = useState(PAGE);

  const featured = cards.find((c) => c.featured) ?? cards[0];
  const rest = featured ? cards.filter((c) => c.key !== featured.key) : [];
  const shown = rest.slice(0, visible);
  const topics = Array.from(new Set(cards.map((c) => c.category).filter(Boolean))) as string[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8 lg:px-12">
      <div className="flex flex-wrap items-end justify-between gap-5 pb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">The MyCar journal</p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Straight answers for the road ahead.
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Practical buying, financing and trade-in advice from the MyCar team in Fredericksburg, Virginia.
          </p>
        </div>
        <Link to="/search" className="text-sm font-semibold text-primary hover:underline">
          Shop inventory →
        </Link>
      </div>

      {topics.length > 0 && (
        <nav className="flex gap-5 overflow-x-auto py-4 text-sm font-semibold text-muted-foreground">
          <span className="shrink-0 text-foreground">All posts</span>
          {topics.map((topic) => (
            <span key={topic} className="shrink-0">
              {topic}
            </span>
          ))}
        </nav>
      )}

      {cards.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border p-14 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-3xl">📰</div>
          <p className="mt-5 text-sm text-muted-foreground">Articles are on the way! Check back soon.</p>
        </div>
      ) : (
        <div className="mt-10">
          {featured && (
            <Link
              to="/blog/$slug"
              params={{ slug: featured.slug }}
              className="group grid cursor-pointer overflow-hidden rounded-2xl border border-border bg-card transition duration-300 hover:shadow-lg md:grid-cols-[1.35fr_1fr]"
            >
              {featured.image ? (
                <img
                  src={featured.image}
                  alt={featured.title}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                  className="aspect-[16/9] h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="aspect-[16/9] bg-muted" />
              )}
              <div className="flex flex-col justify-center p-6 sm:p-9">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Featured {featured.category ? `· ${featured.category}` : ""}
                </p>
                <h2 className="mt-4 font-display text-3xl font-bold leading-tight">{featured.title}</h2>
                {featured.excerpt && (
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">{featured.excerpt}</p>
                )}
                <p className="mt-auto pt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {formatDate(featured.date)} {featured.readTime ? `· ${featured.readTime} min read` : ""}
                </p>
              </div>
            </Link>
          )}

          {shown.length > 0 && <h2 className="mt-12 font-display text-2xl font-bold">Latest posts</h2>}
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((p) => (
              <Link
                key={p.key}
                to="/blog/$slug"
                params={{ slug: p.slug }}
                className="flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card transition duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                {p.image ? (
                  <img
                    src={p.image}
                    alt={p.title}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                    className="aspect-[16/9] w-full rounded-t-xl object-cover"
                  />
                ) : (
                  <div className="aspect-[16/9] bg-muted" />
                )}
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {p.category ?? "MyCar"}
                  </p>
                  <h3 className="mt-2 font-display text-xl font-semibold">{p.title}</h3>
                  {p.excerpt && (
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{p.excerpt}</p>
                  )}
                  <p className="mt-auto pt-5 text-xs uppercase tracking-wide text-muted-foreground">
                    {formatDate(p.date)} {p.readTime ? `· ${p.readTime} min read` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {rest.length > visible && (
            <div className="mt-10 text-center">
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE)}
                className="cursor-pointer rounded-md border border-border bg-card px-6 py-3 text-sm font-semibold transition hover:border-primary hover:text-primary"
              >
                Load more articles
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
