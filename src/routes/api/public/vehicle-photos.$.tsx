import { createFileRoute } from "@tanstack/react-router";
import {
  APP_SUPABASE_PUBLISHABLE_KEY,
  APP_SUPABASE_URL,
} from "@/integrations/supabase/runtime-config";

const ALLOWED = /^[a-z0-9-]+\/photo-\d+\.jpg$/i;

export const Route = createFileRoute("/api/public/vehicle-photos/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = (params as { _splat?: string })._splat ?? "";
        if (!ALLOWED.test(path)) {
          return new Response("Not found", { status: 404 });
        }

        const url = APP_SUPABASE_URL;
        // The photo bucket lives in the app's own project, so the LEGACY_* pair
        // (which points at that project) must win over the platform variables.
        const key =
          process.env["MYCAR_SUPABASE_SECRET_KEY"] ??
          process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"] ??
          process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
          APP_SUPABASE_PUBLISHABLE_KEY;
        if (!url || !key) return new Response("Not configured", { status: 500 });

        const vin = path.split("/")[0]?.toUpperCase();
        const vehicleResponse = await fetch(
          `${url}/rest/v1/vehicles?select=status&vin=eq.${encodeURIComponent(vin ?? "")}&limit=1`,
          { headers: { apikey: key, Authorization: `Bearer ${key}` } },
        );
        const vehicles = (await vehicleResponse.json().catch(() => [])) as Array<{ status?: string }>;
        if (!vehicleResponse.ok || !vehicles[0] || vehicles[0].status === "draft") {
          return new Response("Not found", { status: 404 });
        }

        const upstream = await fetch(
          `${url}/storage/v1/object/vehicle-photos/${path}`,
          { headers: { apikey: key, Authorization: `Bearer ${key}` } },
        );
        if (!upstream.ok || !upstream.body) {
          return new Response("Not found", { status: 404 });
        }

        return new Response(upstream.body, {
          status: 200,
          headers: {
            "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
