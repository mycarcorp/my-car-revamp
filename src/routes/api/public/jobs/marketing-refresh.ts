import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/marketing-refresh")({ server: { handlers: {
  POST: async ({ request }) => {
    const authFailure = await authenticateCronRequest(request);
    if (authFailure) return authFailure;
    const body = await request.json().catch(() => null) as { kind?: string } | null;
    if (body?.kind !== "daily") return Response.json({ error: "Invalid job body" }, { status: 400 });
    const m = await import("@/lib/marketing.server");
    const results = await Promise.all(["search", "website", "lighthouse"].map(async (service) => {
      const key = service as "search" | "website" | "lighthouse";
      const result = await m.refreshMarketing(key); return { service, state: result.state };
    }));
    return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
  },
} } });