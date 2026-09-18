import { createFileRoute } from "@tanstack/react-router";

const SITE_ORIGIN = "https://mycarcorp.com";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-autoseo-signature",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...cors },
  });

/** Constant-time-ish comparison of two hex digests. */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const methodNotAllowed = () => json({ error: "Method not allowed" }, 405);

export const Route = createFileRoute("/api/public/receive-article")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: methodNotAllowed,
      PUT: methodNotAllowed,
      PATCH: methodNotAllowed,
      DELETE: methodNotAllowed,
      POST: async ({ request }) => {
        const secret = process.env["AUTOSEO_WEBHOOK_TOKEN"];
        const provided = (request.headers.get("authorization") ?? "")
          .replace(/^Bearer\s+/i, "")
          .trim();
        if (!secret || !provided || !safeEqualHex(provided, secret)) {
          return json({ error: "Unauthorized" }, 401);
        }

        // Raw body first: the optional signature is computed over these exact bytes.
        const raw = await request.text();

        const signature = (request.headers.get("x-autoseo-signature") ?? "")
          .replace(/^sha256=/i, "")
          .trim()
          .toLowerCase();
        if (signature) {
          const expected = await hmacHex(secret, raw);
          if (!safeEqualHex(signature, expected)) {
            return json({ error: "Invalid signature" }, 401);
          }
        }

        let body: Record<string, unknown>;
        try {
          body = JSON.parse(raw) as Record<string, unknown>;
          if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("bad body");
        } catch {
          return json({ error: "Invalid JSON payload" }, 400);
        }

        const event = String(body["event"] ?? "").trim();

        if (event === "test") {
          return json({ url: `${SITE_ORIGIN}/blog/test`, status: "ok" });
        }

        if (event && event !== "article.published" && event !== "article.updated") {
          return json({ error: `Unsupported event: ${event}` }, 400);
        }

        try {
          const m = await import("@/lib/autoseo-blog.server");
          const { slug } = await m.upsertAutoseoArticle(body);
          return json({ url: `${SITE_ORIGIN}/blog/${slug}`, status: "ok" });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unexpected error";
          if (/Missing id, title or slug/i.test(message)) {
            return json({ error: message }, 400);
          }
          console.error("[autoseo] webhook failed", message);
          return json({ error: message }, 500);
        }
      },
    },
  },
});
