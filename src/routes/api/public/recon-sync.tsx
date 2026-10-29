import { createFileRoute } from "@tanstack/react-router";
import { PHOTO_BUCKET, photoPublicUrl, photoStoragePath } from "@/lib/admin-inventory";
import { VIN_RE } from "@/lib/inventory-csv";
import { mapReconVehicle, type ReconVehicle } from "@/lib/recon-sync";

// Receives vehicles from the MyCar Recon operations app (bearer RECON_SYNC_TOKEN).
// Events: publish (upsert car, status available), photo (one image, base64), sold, unpublish.

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

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const methodNotAllowed = () => json({ error: "Method not allowed" }, 405);

async function db() {
  // Live project client; loaded inside handlers so it never reaches the browser bundle.
  const { appAdmin } = await import("@/lib/app-admin.server");
  return appAdmin();
}

async function setStatus(vin: string, status: "sold" | "draft") {
  const supabaseAdmin = await db();
  const { data, error } = await supabaseAdmin.from("vehicles").update({ status, last_synced_at: new Date().toISOString() }).eq("vin", vin).select("id");
  if (error) return json({ error: "Could not update the vehicle" }, 500);
  if (!data?.length) return json({ error: "Vehicle not found on the website" }, 404);
  return json({ ok: true, vin, status });
}

export const Route = createFileRoute("/api/public/recon-sync")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: methodNotAllowed,
      PUT: methodNotAllowed,
      PATCH: methodNotAllowed,
      DELETE: methodNotAllowed,
      POST: async ({ request }) => {
        const secret = process.env["RECON_SYNC_TOKEN"];
        const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
        if (!secret || secret.length < 32 || !provided || !safeEqual(provided, secret)) {
          return json({ error: "Unauthorized" }, 401);
        }
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(raw) as Record<string, unknown>;
          if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("bad body");
        } catch {
          return json({ error: "Invalid JSON payload" }, 400);
        }

        const supabaseAdmin = await db();
        const event = String(body["event"] ?? "");
        const vin = String(body["vin"] ?? (body["vehicle"] as ReconVehicle | undefined)?.vin ?? "").trim().toUpperCase();
        if (!VIN_RE.test(vin)) return json({ error: "A valid 17-character VIN is required" }, 400);

        if (event === "publish") {
          const mapped = mapReconVehicle({ ...(body["vehicle"] as ReconVehicle), vin });
          if (!mapped.ok) return json({ error: "Vehicle is not ready to publish", details: mapped.errors }, 422);
          const { data, error } = await supabaseAdmin.from("vehicles").upsert(mapped.row, { onConflict: "vin" }).select("id, slug").single();
          if (error || !data) return json({ error: "Could not save the vehicle" }, 500);
          return json({ ok: true, vin, id: data.id, url: `https://mycarcorp.com/inventory/${data.slug}` });
        }

        if (event === "photo") {
          const index = Number(body["index"]);
          const type = String(body["contentType"] ?? "image/jpeg");
          const data = String(body["data"] ?? "");
          if (!Number.isInteger(index) || index < 1 || index > 30) return json({ error: "Photo index must be 1-30" }, 400);
          if (!PHOTO_TYPES.has(type)) return json({ error: "Photos must be JPG, PNG or WebP" }, 400);
          const { data: car } = await supabaseAdmin.from("vehicles").select("id").eq("vin", vin).maybeSingle();
          if (!car) return json({ error: "Publish the vehicle before sending photos" }, 404);
          let bytes: Uint8Array;
          try {
            bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
          } catch {
            return json({ error: "Photo data must be base64" }, 400);
          }
          const up = await supabaseAdmin.storage.from(PHOTO_BUCKET).upload(photoStoragePath(vin, index), bytes, { upsert: true, contentType: type });
          if (up.error) return json({ error: "Could not store the photo" }, 500);
          const url = photoPublicUrl(vin, index);
          await supabaseAdmin.from("vehicle_photos").delete().eq("vehicle_id", car.id).eq("position", index - 1);
          const ins = await supabaseAdmin.from("vehicle_photos").insert({ vehicle_id: car.id, url, position: index - 1, alt: String(body["alt"] ?? "").slice(0, 200) || null });
          if (ins.error) return json({ error: "Could not save the photo record" }, 500);
          return json({ ok: true, vin, index, url });
        }

        if (event === "sold") return setStatus(vin, "sold");
        if (event === "unpublish") return setStatus(vin, "draft");
        return json({ error: `Unknown event "${event}"` }, 400);
      },
    },
  },
});
