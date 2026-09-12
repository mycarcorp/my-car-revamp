import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDate } from "@/lib/format";
import { publicBlogList } from "@/lib/legacy-blog.functions";

export const Route = createFileRoute("/blog/")({
  loader: async () => ({ posts: await publicBlogList() }),
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center text-sm text-muted-foreground">
      Articles are unavailable right now. Please try again shortly.
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center text-sm text-muted-foreground">
      Nothing here yet.
    </div>
  ),
  head: () => ({
    meta: [
      { title: "Car Buying Advice & Dealership News — MyCar Blog" },
      {
        name: "description",
        content:
          "Practical used-car buying, financing and trade-in advice from the MyCar team in Fredericksburg, Virginia.",
      },
      { property: "og:title", content: "MyCar Blog — Car Buying Advice" },
      {
        property: "og:description",
        content: "Used-car buying, financing and trade-in advice from our Fredericksburg team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const { posts } = Route.useLoaderData();
  const featured = posts.find((post) => post.is_featured) ?? posts[0];
  const latest = featured ? posts.filter((post) => post.id !== featured.id) : [];
  const topics = Array.from(new Set(posts.map((post) => post.category).filter(Boolean))) as string[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8 lg:px-12">
      <div className="flex flex-wrap items-end justify-between gap-5 pb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">The MyCar journal</p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Straight answers for the road ahead.</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Practical buying, financing and trade-in advice from the MyCar team in Fredericksburg, Virginia.
          </p>
        </div>
        <Link to="/search" className="text-sm font-semibold text-primary hover:underline">Shop inventory →</Link>
      </div>

      {topics.length > 0 && (
        <nav className="flex gap-5 overflow-x-auto py-4 text-sm font-semibold text-muted-foreground">
          <span className="shrink-0 text-foreground">All posts</span>
          {topics.map((topic) => <span key={topic} className="shrink-0">{topic}</span>)}
        </nav>
      )}

      {posts.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No articles published yet. Check back soon.
        </p>
      ) : (
        <div className="mt-10">
          {featured && (
            <Link to="/blog/$slug" params={{ slug: featured.slug }} className="group grid overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[1.35fr_1fr]">
              {featured.image_url ? <img src={featured.image_url} alt={featured.title} className="aspect-[16/9] h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" /> : <div className="aspect-[16/9] bg-muted" />}
              <div className="flex flex-col justify-center p-6 sm:p-9">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Featured {featured.category ? `· ${featured.category}` : ""}</p>
                <h2 className="mt-4 font-display text-3xl font-bold leading-tight">{featured.title}</h2>
                {featured.excerpt && <p className="mt-4 text-sm leading-6 text-muted-foreground">{featured.excerpt}</p>}
                <p className="mt-auto pt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{formatDate(featured.published_at)} {featured.read_time ? `· ${featured.read_time} min read` : ""}</p>
              </div>
            </Link>
          )}
          {latest.length > 0 && <h2 className="mt-12 font-display text-2xl font-bold">Latest posts</h2>}
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((p) => (
              <Link key={p.id} to="/blog/$slug" params={{ slug: p.slug }} className="card-lift flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
                {p.image_url ? <img src={p.image_url} alt={p.title} loading="lazy" className="aspect-[16/9] w-full object-cover" /> : <div className="aspect-[16/9] bg-muted" />}
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">{p.category ?? "MyCar"}</p>
                  <h3 className="mt-2 font-display text-xl font-semibold">{p.title}</h3>
                  {p.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{p.excerpt}</p>}
                  <p className="mt-auto pt-5 text-xs uppercase tracking-wide text-muted-foreground">{formatDate(p.published_at)} {p.read_time ? `· ${p.read_time} min read` : ""}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
