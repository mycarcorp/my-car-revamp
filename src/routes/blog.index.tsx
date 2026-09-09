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

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-4xl font-bold">From the lot</h1>
      <p className="mt-3 text-muted-foreground">
        Straight answers about buying, financing and trading a used vehicle in Virginia.
      </p>

      {posts.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No articles published yet. Check back soon.
        </p>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {posts.map((p) => (
            <Link
              key={p.id}
              to="/blog/$slug"
              params={{ slug: p.slug }}
              className="card-lift overflow-hidden rounded-xl border border-border bg-card"
            >
              {p.image_url && (
                <img
                  src={p.image_url}
                  alt={p.title}
                  loading="lazy"
                  className="aspect-[16/9] w-full object-cover"
                />
              )}
              <div className="p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {formatDate(p.published_at)}
                  {p.category ? ` · ${p.category}` : ""}
                  {p.read_time ? ` · ${p.read_time} min read` : ""}
                </p>
                <h2 className="mt-2 font-display text-lg font-semibold">{p.title}</h2>
                {p.excerpt && (
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
