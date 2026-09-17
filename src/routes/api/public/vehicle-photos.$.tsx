import { createFileRoute } from "@tanstack/react-router";
import {
  APP_SUPABASE_PUBLISHABLE_KEY,
  APP_SUPABASE_URL,
} from "@/integrations/supabase/runtime-config";

const ALLOWED = /^[a-z0-9-]+\/(photo-\d+\.jpg|video-\d+\.(?:mp4|webm|mov|m4v))$/i;

function fallbackContentType(path: string): string {
  const ext = (path.split(".").pop() ?? "").toLowerCase();
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  if (ext === "mov" || ext === "m4v") return "video/quicktime";
  return "image/jpeg";
}


export const Route = createFileRoute("/api/public/vehicle-photos/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const path = ((params as { _splat?: string })._splat ?? "").split("?")[0] ?? "";
        // Versioned URLs (?v=...) are safe to cache forever; bare slot URLs are
        // reused when photos are replaced, so they must always be revalidated.
        const versioned = new URL(request.url).searchParams.has("v");
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
        let known = vehicleResponse.ok && Boolean(vehicles[0]);

        // Vehicles added through the admin area may only exist in the legacy
        // inventory table yet, so fall back to that before refusing the photo.
        if (!known) {
          const legacyUrl = process.env["LEGACY_SUPABASE_URL"];
          const legacyKey = process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"];
          if (legacyUrl && legacyKey) {
            const legacyResponse = await fetch(
              `${legacyUrl}/rest/v1/mc_cars?select=id&source_id=eq.${encodeURIComponent((vin ?? "").toLowerCase())}&limit=1`,
              {
                headers: {
                  apikey: legacyKey,
                  Authorization: `Bearer ${legacyKey}`,
                  "Accept-Profile": "mycarco_db",
                },
              },
            ).catch(() => null);
            const legacyRows = (await legacyResponse?.json().catch(() => [])) as
              | Array<{ id: number }>
              | undefined;
            known = Boolean(legacyRows?.[0]);
          }
        }

        if (!known) {
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

        // Videos are seekable, so the browser's Range request is forwarded and
        // the partial response (206 + content-range) is passed straight back.
        const range = request.headers.get("range");

        for (const target of storageTargets) {
          const upstreamHeaders: Record<string, string> = {
            apikey: target.key,
            Authorization: `Bearer ${target.key}`,
          };
          if (range) upstreamHeaders["Range"] = range;
          const upstream = await fetch(
            `${target.url}/storage/v1/object/vehicle-photos/${path}`,
            { headers: upstreamHeaders, cache: "no-store" },
          ).catch(() => null);

          if (upstream && (upstream.ok || upstream.status === 206) && upstream.body) {
            const headers = new Headers({
              "content-type": upstream.headers.get("content-type") ?? fallbackContentType(path),
              "cache-control": versioned
                ? "public, max-age=31536000, immutable"
                : "no-cache, must-revalidate",
              "accept-ranges": "bytes",
            });
            const contentRange = upstream.headers.get("content-range");
            const contentLength = upstream.headers.get("content-length");
            if (contentRange) headers.set("content-range", contentRange);
            if (contentLength) headers.set("content-length", contentLength);
            return new Response(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
          }
        }


        return new Response("Not found", { status: 404 });
      },
    },
  },
});
