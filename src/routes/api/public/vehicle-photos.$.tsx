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

        // Vehicle records are read from the app project with the publishable key
        // (public rows only), while the photo binaries live in the storage
        // account reachable with the server credentials below.
        const vin = path.split("/")[0]?.toUpperCase();
        const vehicleResponse = await fetch(
          `${APP_SUPABASE_URL}/rest/v1/vehicles?select=status&vin=eq.${encodeURIComponent(vin ?? "")}&limit=1`,
          {
            headers: {
              apikey: APP_SUPABASE_PUBLISHABLE_KEY,
              Accept: "application/json",
            },
          },
        );
        const vehicles = (await vehicleResponse.json().catch(() => [])) as Array<{ status?: string }>;
        if (!vehicleResponse.ok || !vehicles[0]) {
          return new Response("Not found", { status: 404 });
        }

        const storageTargets = [
          {
            url: process.env["SUPABASE_URL"],
            key: process.env["SUPABASE_SERVICE_ROLE_KEY"],
          },
          {
            url: process.env["LEGACY_SUPABASE_URL"],
            key: process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"],
          },
        ].filter((t): t is { url: string; key: string } => Boolean(t.url && t.key));

        if (storageTargets.length === 0) {
          return new Response("Not configured", { status: 500 });
        }

        for (const target of storageTargets) {
          const upstream = await fetch(
            `${target.url}/storage/v1/object/vehicle-photos/${path}`,
            { headers: { apikey: target.key, Authorization: `Bearer ${target.key}` } },
          ).catch(() => null);

          if (upstream?.ok && upstream.body) {
            return new Response(upstream.body, {
              status: 200,
              headers: {
                "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
                "cache-control": "public, max-age=31536000, immutable",
              },
            });
          }
        }

        return new Response("Not found", { status: 404 });
      },
    },
  },
});
