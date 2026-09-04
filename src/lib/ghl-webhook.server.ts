// Server-only delivery of lead payloads to the GoHighLevel incoming webhook.
// The URL never reaches the browser.
const GHL_WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/AGdF5IyEdBUJZfOjU8FD/webhook-trigger/1ac00111-5d54-4cc7-b89a-e92a1bd55586";

export async function postToGhl(payload: Record<string, unknown>): Promise<number> {
  const res = await fetch(GHL_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  console.log("[ghl-webhook] delivered", payload["event_type"], res.status);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[ghl-webhook] delivery failed", res.status, text.slice(0, 500));
  }
  return res.status;
}
