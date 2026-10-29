import { createFileRoute } from "@tanstack/react-router";
import { MAX_MEDIA, MEDIA_TYPES, TOKEN_RE, cleanItems, newToken, type ApprovalMedia } from "@/lib/approvals";

// Customer repair approvals sent from the MyCar Recon operations app (bearer RECON_SYNC_TOKEN).
// Events: create (returns the customer link), media (one photo/video, base64), status.

const SITE = "https://mycarcorp.com";
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

async function db() {
  const { appAdmin } = await import("@/lib/app-admin.server");
  return appAdmin();
}

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max) || null;
const MAX_BODY_BYTES = 9 * 1024 * 1024;
const methodNotAllowed = () => json({ error: "Method not allowed" }, 405);

export const Route = createFileRoute("/api/public/recon-approvals")({
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
        if (raw.length > MAX_BODY_BYTES) return json({ error: "File too large. Keep videos under 6 MB." }, 413);
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(raw) as Record<string, unknown>;
          if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("bad body");
        } catch {
          return json({ error: "Invalid JSON payload" }, 400);
        }
        const supabase = await db();
        const event = String(body["event"] ?? "");

        if (event === "create") {
          const a = (body["approval"] ?? {}) as Record<string, unknown>;
          const { items, errors } = cleanItems(a["items"]);
          if (errors.length) return json({ error: "Approval is not ready to send", details: errors }, 422);
          const roNo = clip(a["roNo"], 40);
          const vehicle = clip(a["vehicle"], 140);
          if (!roNo || !vehicle) return json({ error: "RO number and vehicle are required" }, 422);
          const token = newToken();
          const miles = Number(String(a["miles"] ?? "").replace(/[,\s]/g, ""));
          const { error } = await supabase.from("service_approvals").insert({
            token,
            ro_no: roNo,
            ro_ref: clip(a["roRef"], 80),
            customer_name: clip(a["customer"], 120),
            customer_phone: clip(a["phone"], 40),
            vehicle,
            vin: clip(a["vin"], 17),
            miles: Number.isFinite(miles) && miles > 0 ? Math.round(miles) : null,
            advisor: clip(a["advisor"], 80),
            shop_phone: clip(a["shopPhone"], 40),
            notes: clip(a["notes"], 2000),
            items,
          });
          if (error) return json({ error: "Could not create the approval" }, 500);
          return json({ ok: true, token, url: `${SITE}/approve/${token}` });
        }

        const token = String(body["token"] ?? "");
        if (!TOKEN_RE.test(token)) return json({ error: "A valid approval token is required" }, 400);
        const { data: row } = await supabase
          .from("service_approvals")
          .select("id, media, items, decisions, status, signed_name, viewed_at, responded_at")
          .eq("token", token)
          .maybeSingle();
        if (!row) return json({ error: "Approval not found" }, 404);

        if (event === "media") {
          const type = String(body["contentType"] ?? "");
          const ext = MEDIA_TYPES[type];
          if (!ext) return json({ error: "Photos must be JPG, PNG or WebP; videos MP4, WebM or MOV" }, 400);
          const media = (Array.isArray(row.media) ? row.media : []) as ApprovalMedia[];
          if (media.length >= MAX_MEDIA) return json({ error: `Up to ${MAX_MEDIA} photos and videos per approval` }, 400);
          let bytes: Uint8Array;
          try {
            bytes = Uint8Array.from(atob(String(body["data"] ?? "")), (c) => c.charCodeAt(0));
          } catch {
            return json({ error: "File data must be base64" }, 400);
          }
          const n = media.length + 1;
          const up = await supabase.storage.from("approval-media").upload(`${token}/${n}.${ext}`, bytes, { upsert: true, contentType: type });
          if (up.error) return json({ error: "Could not store the file" }, 500);
          const item = clip(body["item"], 40);
          const next = [...media, { n, type, item: item && (row.items as { id: string }[]).some((i) => i.id === item) ? item : null }];
          const { error } = await supabase.from("service_approvals").update({ media: next }).eq("id", row.id);
          if (error) return json({ error: "Could not save the file record" }, 500);
          return json({ ok: true, n });
        }

        if (event === "status") {
          return json({
            ok: true,
            status: row.status,
            decisions: row.decisions,
            signedName: row.signed_name,
            viewedAt: row.viewed_at,
            respondedAt: row.responded_at,
          });
        }

        if (event === "cancel") {
          await supabase.from("service_approvals").update({ status: "cancelled" }).eq("id", row.id);
          return json({ ok: true, status: "cancelled" });
        }

        return json({ error: `Unknown event "${event}"` }, 400);
      },
    },
  },
});
