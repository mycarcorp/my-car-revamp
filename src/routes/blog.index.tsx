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

const slugifyTopic = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

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
  const heroImage =
    featured?.image ?? "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1800&q=85";

  const scrollToTopic = (topic?: string) => {
    if (!topic) {
      document.getElementById("latest-posts")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    const target = cards.find((card) => card.category === topic);
    if (!target) return;

    setVisible(Math.max(PAGE, rest.length));

    window.setTimeout(() => {
      document.getElementById(`post-${target.key}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
  };

  return (
    <div>
      {/* SEO HERO */}
      <section
        className="relative isolate overflow-hidden border-b border-border bg-slate-950 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(3,12,22,0.95) 0%, rgba(3,12,22,0.84) 48%, rgba(3,12,22,0.48) 100%), url("${heroImage}")`,
        }}
      >
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_82%_42%,rgba(255,255,255,0.14),transparent_32%)]" />

        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-12 lg:py-28">
          <div className="max-w-3xl">
            <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
              My Car Resource Center
            </p>

            <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Used Car Buying Tips in Fredericksburg, VA
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
              Get practical advice for shopping, financing, trading and owning a used vehicle in Fredericksburg,
              Virginia. Explore guides from My Car designed to help you research vehicles, understand your options and
              make informed decisions before your next purchase.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/search"
                className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-lg bg-[#F7941D] px-6 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_30px_rgba(247,148,29,0.28)] transition hover:bg-[#ea8718] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Browse Used Vehicles
              </Link>

              <Link
                to="/finance"
                className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-lg border border-white/30 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Explore Financing Options
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8 lg:px-12">
        {/* AUTO-SCROLLING TOPIC CAROUSEL */}
        {topics.length > 0 && (
          <>
            <style>{`
              @keyframes blog-topic-marquee {
                from { transform: translate3d(0, 0, 0); }
                to { transform: translate3d(calc(-50% - 0.375rem), 0, 0); }
              }

              .blog-topic-marquee {
                display: flex;
                width: max-content;
                min-width: max-content;
                animation: blog-topic-marquee 34s linear infinite;
                will-change: transform;
              }

              .blog-topic-carousel:hover .blog-topic-marquee,
              .blog-topic-carousel:focus-within .blog-topic-marquee {
                animation-play-state: paused;
              }

              @media (prefers-reduced-motion: reduce) {
                .blog-topic-marquee {
                  animation: none !important;
                  transform: none !important;
                }
              }
            `}</style>

            <nav
              aria-label="Blog topics"
              className="blog-topic-carousel relative overflow-hidden border-y border-border bg-background py-4"
            >
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent sm:w-20" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent sm:w-20" />

              <div className="blog-topic-marquee gap-3 px-3">
                {[0, 1].map((copy) => (
                  <div
                    key={copy}
                    className="flex shrink-0 items-center gap-3"
                    aria-hidden={copy === 1 ? true : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => scrollToTopic()}
                      tabIndex={copy === 1 ? -1 : 0}
                      className="shrink-0 cursor-pointer whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      All posts
                    </button>

                    {topics.map((topic) => (
                      <button
                        key={`${copy}-${topic}`}
                        type="button"
                        onClick={() => scrollToTopic(topic)}
                        tabIndex={copy === 1 ? -1 : 0}
                        className="shrink-0 cursor-pointer whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm transition hover:border-primary hover:bg-primary hover:text-primary-foreground"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </nav>
          </>
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
                id={`post-${featured.key}`}
                to="/blog/$slug"
                params={{ slug: featured.slug }}
                className="group grid scroll-mt-28 cursor-pointer overflow-hidden rounded-2xl border border-border bg-card transition duration-300 hover:shadow-lg md:grid-cols-[1.35fr_1fr]"
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
              <h2 id="latest-posts" className="mt-12 scroll-mt-28 font-display text-2xl font-bold">
                Latest used car tips and guides
              </h2>
            )}

            <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((p) => (
                <Link
                  id={`post-${p.key}`}
                  key={p.key}
                  to="/blog/$slug"
                  params={{ slug: p.slug }}
                  className="flex h-full scroll-mt-28 cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card transition duration-300 hover:-translate-y-1 hover:shadow-lg"
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
