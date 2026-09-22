import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { getSitemapXml } = await import("@/lib/sitemap-cache.server");
        const { xml } = await getSitemapXml();
        return new Response(xml, {
          status: 200,
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=600, s-maxage=600, stale-while-revalidate=86400",
            "x-robots-tag": "noindex",
          },
        });
      },
      HEAD: async () => {
        const { getSitemapXml } = await import("@/lib/sitemap-cache.server");
        const { xml } = await getSitemapXml();
        return new Response(null, {
          status: 200,
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "content-length": String(new TextEncoder().encode(xml).byteLength),
            "cache-control": "public, max-age=600",
          },
        });
      },
    },
  },
});
