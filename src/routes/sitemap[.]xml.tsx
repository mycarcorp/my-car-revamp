import { createFileRoute } from "@tanstack/react-router";

const SITE_ORIGIN = "https://mycarcorp.com";

const STATIC_PAGES: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/blog", priority: "0.8", changefreq: "daily" },
  { path: "/search", priority: "0.9", changefreq: "daily" },
  { path: "/finance", priority: "0.7", changefreq: "monthly" },
  { path: "/sell", priority: "0.7", changefreq: "monthly" },
  { path: "/schedule", priority: "0.6", changefreq: "monthly" },
  { path: "/contact", priority: "0.6", changefreq: "monthly" },
];

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: string[] = STATIC_PAGES.map(
          (p) =>
            `<url><loc>${SITE_ORIGIN}${p.path}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`,
        );

        try {
          const m = await import("@/lib/autoseo-blog.server");
          for (const post of await m.sitemapUrls()) {
            const lastmod = post.lastmod ? `<lastmod>${escape(post.lastmod)}</lastmod>` : "";
            entries.push(
              `<url><loc>${SITE_ORIGIN}/blog/${escape(post.slug)}</loc>${lastmod}<changefreq>weekly</changefreq><priority>0.7</priority></url>`,
            );
          }
        } catch (error) {
          console.error("[sitemap] article list unavailable", error);
        }

        try {
          const b = await import("@/lib/legacy-blog.server");
          for (const post of await b.listPublishedPosts()) {
            const lastmod = post.updated_at ?? post.published_at;
            entries.push(
              `<url><loc>${SITE_ORIGIN}/blog/${escape(post.slug)}</loc>${lastmod ? `<lastmod>${escape(lastmod)}</lastmod>` : ""}<changefreq>weekly</changefreq><priority>0.7</priority></url>`,
            );
          }
        } catch (error) {
          console.error("[sitemap] blog list unavailable", error);
        }

        const ns = "http://www.sitemaps.org/schemas/sitemap/0.9";
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${ns}">${entries.join("")}</urlset>`;
        return new Response(xml, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
