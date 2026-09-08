import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { blogPostQuery } from "@/lib/queries";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ context, params }) => {
    const post = await context.queryClient.ensureQueryData(blogPostQuery(params.slug));
    if (!post || !post.published) throw notFound();
    return { post };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Article unavailable — MyCar" }, { name: "robots", content: "noindex" }] };
    }
    const p = loaderData.post;
    const description = p.excerpt ?? `${p.title} — from the MyCar team in Fredericksburg, VA.`;
    const meta: Array<Record<string, string>> = [
      { title: `${p.title} — MyCar` },
      { name: "description", content: description },
      { property: "og:title", content: p.title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
    ];
    if (p.cover_image_url?.startsWith("https://")) {
      meta.push(
        { property: "og:image", content: p.cover_image_url },
        { name: "twitter:image", content: p.cover_image_url },
      );
    }
    return { meta };
  },
  component: BlogPost,
});

function BlogPost() {
  const { post } = Route.useLoaderData();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <Link to="/blog" className="text-sm text-muted-foreground hover:text-primary">
        ← All articles
      </Link>
      <h1 className="mt-4 font-display text-4xl font-bold">{post.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {formatDate(post.published_at)}
        {post.author_name ? ` · ${post.author_name}` : ""}
      </p>
      {post.cover_image_url && (
        <img
          src={post.cover_image_url}
          alt={post.title}
          className="mt-8 aspect-[16/9] w-full rounded-xl object-cover"
        />
      )}
      <div className="mt-8 whitespace-pre-line text-base leading-relaxed text-foreground/90">
        {post.body}
      </div>
    </article>
  );
}
