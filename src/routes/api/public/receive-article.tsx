import { createFileRoute } from "@tanstack/react-router";

const SITE_ORIGIN = "https://mycarcorp.com";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...cors },
  });

export const Route = createFileRoute("/api/public/receive-article")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const expected = process.env["AUTOSEO_WEBHOOK_TOKEN"];
        const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
        if (!expected || !provided || provided !== expected) {
          return json({ error: "Unauthorized" }, 401);
        }

        try {
          const body = (await request.json()) as Record<string, unknown>;

          if (body["event"] === "test") {
            return json({ url: `${SITE_ORIGIN}/blog/test`, status: "ok" });
          }

          const m = await import("@/lib/autoseo-blog.server");
          const { slug } = await m.upsertAutoseoArticle(body);
          return json({ url: `${SITE_ORIGIN}/blog/${slug}` });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unexpected error";
          console.error("[autoseo] webhook failed", message);
          return json({ error: message }, 500);
        }
      },
    },
  },
});
