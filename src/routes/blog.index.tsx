import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ctaButtonClass } from "@/lib/ui";
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

const trim = (s: string | null, n = 160) => (s ? (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s) : null);

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
      {
        title: "Used Car Buying Tips in Fredericksburg, VA | My Car",
      },
      {
        name: "description",
        content:
          "Read used car buying tips from My Car in Fredericksburg, VA. Get practical advice on financing, trade-ins, vehicle research, ownership and shopping for a used car.",
      },
      {
        property: "og:title",
        content: "Used Car Buying Tips in Fredericksburg, VA | My Car",
      },
      {
        property: "og:description",
        content:
          "Get practical advice on buying, financing, trading and owning a used vehicle from My Car in Fredericksburg, Virginia.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:url",
        content: "https://mycarcorp.com/blog",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
    ],

    links: [
      {
        rel: "canonical",
        href: "https://mycarcorp.com/blog",
      },
    ],
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
    <div>
      {/* SEO INTRO */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8 lg:px-12 lg:py-16">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">My Car Resource Center</p>

            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Used Car Buying Tips in Fredericksburg, VA
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              Get practical advice for shopping, financing, trading and owning a used vehicle in Fredericksburg,
              Virginia. Explore guides from My Car designed to help you research vehicles, understand your options and
              make informed decisions before your next purchase.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/search" className={ctaButtonClass}>
                Browse used vehicles
              </Link>

              <Link
                to="/finance"
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                Explore financing
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8 lg:px-12">
        {/* TOPICS */}
        {topics.length > 0 && (
          <nav
            aria-label="Blog topics"
            className="flex gap-5 overflow-x-auto border-b border-border py-4 text-sm font-semibold text-muted-foreground"
          >
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
            {/* FEATURED ARTICLE */}
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
                    Featured
                    {featured.category ? ` · ${featured.category}` : ""}
                  </p>

                  <h2 className="mt-4 font-display text-3xl font-bold leading-tight">{featured.title}</h2>

                  {featured.excerpt && (
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">{featured.excerpt}</p>
                  )}

                  <p className="mt-auto pt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {formatDate(featured.date)}
                    {featured.readTime ? ` · ${featured.readTime} min read` : ""}
                  </p>
                </div>
              </Link>
            )}

            {/* LATEST POSTS */}
            {shown.length > 0 && (
              <h2 className="mt-12 font-display text-2xl font-bold">Latest used car tips and guides</h2>
            )}

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
                      {p.category ?? "My Car"}
                    </p>

                    <h3 className="mt-2 font-display text-xl font-semibold">{p.title}</h3>

                    {p.excerpt && (
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{p.excerpt}</p>
                    )}

                    <p className="mt-auto pt-5 text-xs uppercase tracking-wide text-muted-foreground">
                      {formatDate(p.date)}
                      {p.readTime ? ` · ${p.readTime} min read` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            {/* LOAD MORE */}
            {rest.length > visible && (
              <div className="mt-10 text-center">
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + PAGE)}
                  className={`${ctaButtonClass} cursor-pointer`}
                >
                  Load more articles
                </button>
              </div>
            )}
          </div>
        )}

        {/* INTERNAL SEO LINKS */}
        <section className="mt-16 rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold">Ready to find your next vehicle?</h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Browse My Car&apos;s current used vehicle inventory in Fredericksburg, explore financing options or get an
            offer for your current vehicle.
          </p>

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold">
            <Link to="/search" className="text-primary hover:underline">
              Shop used cars
            </Link>

            <Link to="/finance" className="text-primary hover:underline">
              Used car financing
            </Link>

            <Link to="/sell" className="text-primary hover:underline">
              Sell or trade your car
            </Link>

            <Link to="/schedule" className="text-primary hover:underline">
              Schedule a test drive
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
