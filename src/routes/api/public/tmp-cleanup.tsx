import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/tmp-cleanup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["AUTOSEO_WEBHOOK_TOKEN"];
        const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!token || given !== token) return new Response("no", { status: 401 });

        const url = process.env["LEGACY_SUPABASE_URL"]!;
        const key = process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"]!;
        const res = await fetch(`${url}/rest/v1/blog_posts?id=in.(999002,999003)`, {
          method: "DELETE",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Profile": "mycarco_db",
          },
        });
        return new Response(`${res.status}`, { status: 200 });
      },
    },
  },
});
