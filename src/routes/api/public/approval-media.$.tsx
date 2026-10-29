import { createFileRoute } from "@tanstack/react-router";
import { MEDIA_TYPES, TOKEN_RE } from "@/lib/approvals";

// Serves approval photos and videos from the private bucket. The unguessable
// approval token in the path is the access check; cancelled approvals stop serving.
const PATH_RE = /^([a-f0-9]{48})\/(\d{1,2})\.(jpg|png|webp|mp4|webm|mov)$/;
const TYPE_BY_EXT = Object.fromEntries(Object.entries(MEDIA_TYPES).map(([t, e]) => [e, t]));

export const Route = createFileRoute("/api/public/approval-media/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = String((params as { _splat?: string })._splat ?? "");
        const m = path.match(PATH_RE);
        if (!m || !TOKEN_RE.test(m[1]!)) return new Response("Not found", { status: 404 });
        const { appAdmin } = await import("@/lib/app-admin.server");
        const supabase = appAdmin();
        const { data: row } = await supabase.from("service_approvals").select("status, expires_at").eq("token", m[1]!).maybeSingle();
        if (!row || row.status === "cancelled") return new Response("Not found", { status: 404 });
        const file = await supabase.storage.from("approval-media").download(path);
        if (file.error || !file.data) return new Response("Not found", { status: 404 });
        return new Response(file.data, {
          headers: {
            "content-type": TYPE_BY_EXT[m[3]!] ?? "application/octet-stream",
            "cache-control": "private, max-age=3600",
            "x-robots-tag": "noindex",
          },
        });
      },
    },
  },
});
