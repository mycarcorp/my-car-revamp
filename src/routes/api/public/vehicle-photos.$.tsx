import { createFileRoute } from "@tanstack/react-router";
import {
  APP_SUPABASE_PUBLISHABLE_KEY,
  APP_SUPABASE_URL,
} from "@/integrations/supabase/runtime-config";

const ALLOWED = /^[a-z0-9-]+\/(photo-\d+\.jpg|video-\d+\.(?:mp4|webm|mov|m4v))$/i;
// Existence checks are public-only and shared across photos, never across users.
const vehicleChecks = new Map<string, { expires: number; known: Promise<boolean> }>();

async function knownVehicle(vin: string): Promise<boolean> {
  const now = Date.now();
  const cached = vehicleChecks.get(vin);
  if (cached && cached.expires > now) return cached.known;
  for (const [key, value] of vehicleChecks) if (value.expires <= now) vehicleChecks.delete(key);
  if (vehicleChecks.size >= 200) {
    const oldest = vehicleChecks.keys().next().value;
    if (oldest) vehicleChecks.delete(oldest);
  }
  const known = (async () => {
    const response = await fetch(`${APP_SUPABASE_URL}/rest/v1/vehicles?select=status&vin=eq.${encodeURIComponent(vin)}&limit=1`, {
      headers: { apikey: APP_SUPABASE_PUBLISHABLE_KEY, Accept: "application/json" },
    });
    const rows = await response.json().catch(() => []) as Array<{ status?: string }>;
    if (response.ok && rows[0]) return true;
    const url = process.env["LEGACY_SUPABASE_URL"];
    const key = process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) return false;
    const headers: Record<string, string> = { apikey: key, "Accept-Profile": "mycarco_db" };
    if (key.split(".").length === 3) headers.Authorization = `Bearer ${key}`;
    const legacyResponse = await fetch(`${url}/rest/v1/mc_cars?select=id&source_id=eq.${encodeURIComponent(vin.toLowerCase())}&limit=1`, { headers });
    const legacyRows = await legacyResponse.json().catch(() => []) as Array<{ id: number }>;
    return legacyResponse.ok && Boolean(legacyRows[0]);
  })().catch(() => {
    vehicleChecks.delete(vin);
    return false;
  });
  vehicleChecks.set(vin, { expires: now + 30_000, known });
  return known;
}

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
        const vin = path.split("/")[0]?.toUpperCase() ?? "";
        const known = await knownVehicle(vin);

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
          };
          if (target.key.split(".").length === 3) upstreamHeaders.Authorization = `Bearer ${target.key}`;
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
