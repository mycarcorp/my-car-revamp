// Server-only delivery of lead payloads to the GoHighLevel incoming webhook.
// The URL never reaches the browser.
const FALLBACK_GHL_WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/cTYO2qHyPwNbxuJonVvr/webhook-trigger/27e86f52-38b7-413b-bd4a-3bf510369650";

const GHL_WEBHOOK_HOST = "services.leadconnectorhq.com";
let warnedAboutFallback = false;

/**
 * The inbound webhook URL. Read from the server-only GHL_WEBHOOK_URL setting; when it is not set (or not a valid
 * https URL on the GoHighLevel host) the built-in value above is used so existing deployments keep working.
 * The URL is a secret: it is never logged, returned or sent to the browser.
 */
export function getGhlWebhookUrl(): string {
  const configured = process.env["GHL_WEBHOOK_URL"];
  if (typeof configured === "string" && configured.trim()) {
    try {
      const url = new URL(configured.trim());
      if (url.protocol === "https:" && url.hostname === GHL_WEBHOOK_HOST) return url.toString();
    } catch {
      // Falls through to the invalid-setting message.
    }
    console.error("[ghl-webhook] GHL_WEBHOOK_URL is set but not a valid GoHighLevel https URL; using the built-in fallback");
    return FALLBACK_GHL_WEBHOOK_URL;
  }
  if (!warnedAboutFallback) {
    warnedAboutFallback = true;
    console.warn("[ghl-webhook] GHL_WEBHOOK_URL is not set; using the built-in fallback");
  }
  return FALLBACK_GHL_WEBHOOK_URL;
}

export function resetGhlWebhookUrlWarningForTests(): void {
  warnedAboutFallback = false;
}

export const GHL_REQUEST_TIMEOUT_MS = 8000;

/**
 * delivered   - GHL answered 2xx.
 * rejected    - GHL answered 4xx: it refused the request, so it did not process it.
 * unconfirmed - a timeout, network error or 3xx/5xx answer: GHL may or may not have processed it.
 */
export type GhlPostOutcome = "delivered" | "rejected" | "unconfirmed";

export type GhlPostResult = {
  status: number | null;
  outcome: GhlPostOutcome;
  failure?: "timeout" | "network";
};

export function classifyGhlStatus(status: number): GhlPostOutcome {
  if (status >= 200 && status < 300) return "delivered";
  if (status >= 400 && status < 500) return "rejected";
  return "unconfirmed";
}

/**
 * Like postToGhl, but with a request timeout and a classified result instead of a bare status. Never throws and
 * never retries: an unconfirmed delivery must not be repeated unless GHL can ignore a repeat. Used by the website
 * lead path only; postToGhl is unchanged for the other senders.
 */
export async function postToGhlTimed(
  payload: Record<string, unknown>,
  timeoutMs: number = GHL_REQUEST_TIMEOUT_MS,
): Promise<GhlPostResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(getGhlWebhookUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const outcome = classifyGhlStatus(res.status);
    // The response body is deliberately not read or logged: it may echo the submitted lead.
    if (outcome === "delivered") console.log("[ghl-webhook] delivered", payload["event_type"], res.status);
    else console.error("[ghl-webhook] delivery failed", { status: res.status });
    return { status: res.status, outcome };
  } catch {
    const failure = controller.signal.aborted ? "timeout" : "network";
    console.error("[ghl-webhook] delivery failed", { failure });
    return { status: null, outcome: "unconfirmed", failure };
  } finally {
    clearTimeout(timer);
  }
}

export async function postToGhl(payload: Record<string, unknown>): Promise<number> {
  const res = await fetch(getGhlWebhookUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  // The response body is deliberately not logged: it may echo the submitted lead.
  if (res.ok) console.log("[ghl-webhook] delivered", payload["event_type"], res.status);
  else console.error("[ghl-webhook] delivery failed", { status: res.status });
  return res.status;
}
