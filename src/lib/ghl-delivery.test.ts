import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyGhlStatus,
  getGhlWebhookUrl,
  GHL_REQUEST_TIMEOUT_MS,
  postToGhl,
  postToGhlTimed,
  resetGhlWebhookUrlWarningForTests,
} from "./ghl-webhook.server";
import { MAX_ATTEMPTS, MAX_LEAD_AGE_MS, STALE_CLAIM_MS, deliverStoredLeadToGhl } from "./ghl-delivery.server";
import { resetGhlForwardingStateForTests } from "./ghl-webhook.functions";
import { newLeadId } from "./lead-id";

// Synthetic fixtures only.
const NAME = "Synthetic Person";
const EMAIL = "synthetic.person@example.test";
const PHONE = "5555550100";
const SUPABASE = "https://synthetic-project.supabase.test";
const TEST_WEBHOOK = "https://services.leadconnectorhq.com/hooks/synthetic-test-only";
const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-11-01T12:05:00.000Z");
const CREATED = "2026-11-01T12:00:00.000Z";

type Row = {
  id: string;
  lead_type: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  vehicle_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function makeRow(overrides: Partial<Row> = {}): Row {
  return {
    id: LEAD_ID,
    lead_type: "contact",
    full_name: NAME,
    email: EMAIL,
    phone: PHONE,
    message: "Hello",
    vehicle_id: null,
    details: { lead_source: "Google Organic", channel: "organic_search", conversion_page: "https://mycarcorp.com/contact", staff_note: "keep me" },
    created_at: CREATED,
    updated_at: "2026-11-01T12:00:00.000001+00:00",
    ...overrides,
  };
}

/** An in-memory stand-in for the lead table's REST API and the GHL webhook. */
function fakeBackend(initial: Row | null = makeRow(), noTrigger = false) {
  let row: Row | null = initial;
  let tick = 1;
  const webhook = { calls: [] as Array<Record<string, unknown>>, reply: (() => new Response("{}", { status: 200 })) as () => Response | Promise<Response> };
  const hooks = { beforePatch: null as null | (() => void) };
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === "services.leadconnectorhq.com") {
      webhook.calls.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      const signal = init?.signal;
      const pending = webhook.reply();
      if (signal) {
        return await new Promise<Response>((resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          Promise.resolve(pending).then(resolve, reject);
        });
      }
      return pending;
    }
    // Lead table
    const idFilter = url.searchParams.get("id")?.replace(/^eq\./, "");
    const updatedFilter = url.searchParams.get("updated_at")?.replace(/^eq\./, "");
    const method = init?.method ?? "GET";
    if (!row || row.id !== idFilter) return new Response("[]", { status: 200 });
    if (method === "GET") return new Response(JSON.stringify([row]), { status: 200 });
    if (hooks.beforePatch) {
      const run = hooks.beforePatch;
      hooks.beforePatch = null;
      run();
    }
    if (updatedFilter !== undefined && row.updated_at !== updatedFilter) return new Response("[]", { status: 200 });
    // PostgREST JSON-path filter on the stored delivery state, evaluated against the committed row.
    const stateFilter = url.searchParams.get("details->>ghl_delivery_state");
    if (stateFilter !== null) {
      const stored = row.details["ghl_delivery_state"];
      const matches = stateFilter === "is.null" ? stored === undefined || stored === null : stateFilter === `eq.${String(stored)}`;
      if (!matches) return new Response("[]", { status: 200 });
    }
    tick += 1;
    row = {
      ...row,
      details: (JSON.parse(String(init?.body)) as { details: Record<string, unknown> }).details,
      // With no update-time trigger on the live table, updated_at would stay as it was.
      updated_at: noTrigger ? row.updated_at : `2026-11-01T12:00:00.${String(tick).padStart(6, "0")}+00:00`,
    };
    return new Response(JSON.stringify([row]), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    webhook,
    hooks,
    fetchMock,
    row: () => row,
    set: (next: Row | null) => { row = next; },
    touch: () => { if (row) { tick += 1; row = { ...row, updated_at: `2026-11-01T12:00:00.${String(tick).padStart(6, "0")}+00:00` }; } },
    state: () => String(row?.details["ghl_delivery_state"] ?? ""),
  };
}

describe("GHL webhook URL setting", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    delete process.env["GHL_WEBHOOK_URL"];
    resetGhlWebhookUrlWarningForTests();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    delete process.env["GHL_WEBHOOK_URL"];
    vi.restoreAllMocks();
  });

  it("uses the server setting when it is a valid GoHighLevel https URL", () => {
    process.env["GHL_WEBHOOK_URL"] = TEST_WEBHOOK;
    expect(getGhlWebhookUrl()).toBe(TEST_WEBHOOK);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("keeps working without the setting, by falling back to the built-in URL, and says so once without printing it", () => {
    const first = getGhlWebhookUrl();
    expect(new URL(first).protocol).toBe("https:");
    expect(new URL(first).hostname).toBe("services.leadconnectorhq.com");
    getGhlWebhookUrl();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify([...warnSpy.mock.calls, ...errorSpy.mock.calls])).not.toContain(first);
    expect(JSON.stringify(warnSpy.mock.calls)).not.toMatch(/https?:\/\//);
  });

  it("rejects an invalid or off-host setting and falls back without logging it", () => {
    for (const value of ["not a url", "http://services.leadconnectorhq.com/hooks/x", "https://evil.example/hooks/x", "javascript:alert(1)", "   "]) {
      process.env["GHL_WEBHOOK_URL"] = value;
      const url = getGhlWebhookUrl();
      expect(new URL(url).hostname, value).toBe("services.leadconnectorhq.com");
      expect(url, value).not.toBe(value);
    }
    expect(JSON.stringify(errorSpy.mock.calls)).not.toMatch(/evil\.example|not a url/);
  });

  it("is never read by browser code", () => {
    for (const file of ["src/components/LeadForm.tsx", "src/lib/lead-id.ts", "src/routes/__root.tsx"]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/GHL_WEBHOOK_URL|webhook-trigger/);
    }
    expect(readFileSync(".env.example", "utf8")).not.toMatch(/https:\/\/services\.leadconnectorhq/);
  });
});

describe("request timeout and status classification", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses an 8 second default timeout", () => {
    expect(GHL_REQUEST_TIMEOUT_MS).toBe(8000);
  });

  it("aborts a hung request after the timeout and reports it as unconfirmed", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    }));
    const pending = postToGhlTimed({ event_type: "website_contact" });
    await vi.advanceTimersByTimeAsync(GHL_REQUEST_TIMEOUT_MS - 1);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal?.aborted).toBe(true);
    await expect(pending).resolves.toEqual({ status: null, outcome: "unconfirmed", failure: "timeout" });
  });

  it("does not time out a fast response, and clears its timer", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    await expect(postToGhlTimed({ event_type: "website_contact" })).resolves.toEqual({ status: 200, outcome: "delivered" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("classifies statuses: 2xx delivered, 4xx rejected, everything else unconfirmed", () => {
    for (const status of [200, 201, 204]) expect(classifyGhlStatus(status)).toBe("delivered");
    for (const status of [400, 401, 403, 404, 410, 422, 429]) expect(classifyGhlStatus(status)).toBe("rejected");
    for (const status of [100, 301, 302, 500, 502, 503, 504]) expect(classifyGhlStatus(status)).toBe("unconfirmed");
  });

  it("reports network failures as unconfirmed without printing the error text", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError(`connect failed for ${EMAIL}`); }));
    await expect(postToGhlTimed({ event_type: "website_contact" })).resolves.toEqual({ status: null, outcome: "unconfirmed", failure: "network" });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(EMAIL);
  });

  it("leaves postToGhl, used by the purchase and Lease to Own senders, exactly as it was: no timeout, bare status", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(postToGhl({ event_type: "lease_to_own_application" })).resolves.toBe(200);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.signal).toBeUndefined();
    expect(init.method).toBe("POST");
  });
});

describe("stored lead delivery", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env["LEGACY_SUPABASE_URL"] = SUPABASE;
    process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"] = "synthetic-secret-key";
    process.env["GHL_WEBHOOK_URL"] = TEST_WEBHOOK;
    resetGhlForwardingStateForTests();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    delete process.env["LEGACY_SUPABASE_URL"];
    delete process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"];
    delete process.env["GHL_WEBHOOK_URL"];
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  const deliver = (id = LEAD_ID) => deliverStoredLeadToGhl(id, () => NOW);

  it("sends the stored lead once and records the delivery on the lead, keeping its other details", async () => {
    const backend = fakeBackend();
    await expect(deliver()).resolves.toEqual({ delivered: true, state: "delivered", status: 200 });
    expect(backend.webhook.calls).toHaveLength(1);
    expect(backend.webhook.calls[0]).toMatchObject({
      event_type: "website_contact",
      full_name: NAME,
      email: EMAIL,
      phone: PHONE,
      message: "Hello",
      lead_source: "Google Organic",
      channel: "organic_search",
      website_lead_id: LEAD_ID,
      delivery_attempt: "1",
    });
    expect(backend.row()?.details).toMatchObject({
      staff_note: "keep me",
      ghl_delivery_state: "delivered",
      ghl_delivery_attempts: "1",
      ghl_delivery_http: "200",
      ghl_delivery_at: NOW.toISOString(),
    });
  });

  it("never sends the same lead twice, however many times it is asked", async () => {
    const backend = fakeBackend();
    await deliver();
    for (let index = 0; index < 4; index += 1) {
      const again = await deliver();
      expect(again).toMatchObject({ delivered: true, state: "skipped" });
    }
    expect(backend.webhook.calls).toHaveLength(1);
  });

  it("sends once when several callers race, even across separate server instances", async () => {
    const backend = fakeBackend();
    const results = await Promise.all(Array.from({ length: 6 }, () => deliver()));
    expect(backend.webhook.calls).toHaveLength(1);
    expect(results.filter((result) => result.state === "delivered")).toHaveLength(1);
    expect(backend.state()).toBe("delivered");
  });

  it("still sends once if the table has no update-time trigger, because the claim also conditions on the stored state", async () => {
    const backend = fakeBackend(makeRow(), true);
    const results = await Promise.all(Array.from({ length: 6 }, () => deliver()));
    expect(backend.webhook.calls).toHaveLength(1);
    expect(results.filter((result) => result.state === "delivered")).toHaveLength(1);
    expect(backend.row()?.updated_at).toBe("2026-11-01T12:00:00.000001+00:00");
  });

  it("claims with both an update-time and a delivery-state condition in a single UPDATE", async () => {
    const backend = fakeBackend();
    await deliver();
    const patches = backend.fetchMock.mock.calls
      .filter(([, init]) => (init as RequestInit | undefined)?.method === "PATCH")
      .map(([input]) => decodeURIComponent(String(input)));
    expect(patches.length).toBeGreaterThanOrEqual(2);
    for (const query of patches) {
      expect(query).toContain("updated_at=eq.");
      expect(query).toContain("details->>ghl_delivery_state=");
    }
    expect(patches[0]).toContain("details->>ghl_delivery_state=is.null");
    expect(patches[1]).toContain("details->>ghl_delivery_state=eq.sending");
  });

  it("does not forward when the claim cannot be written, and records nothing", async () => {
    const backend = fakeBackend();
    backend.fetchMock.mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.hostname === "services.leadconnectorhq.com") {
        backend.webhook.calls.push({});
        return new Response("{}", { status: 200 });
      }
      if ((init?.method ?? "GET") === "PATCH") return new Response("{}", { status: 400 });
      return new Response(JSON.stringify([backend.row()]), { status: 200 });
    });
    const result = await deliver();
    expect(result.delivered).toBe(false);
    expect(backend.webhook.calls).toHaveLength(0);
  });

  it("survives a concurrent edit of the lead between reading and claiming, and still sends once", async () => {
    const backend = fakeBackend();
    backend.hooks.beforePatch = () => backend.touch();
    await expect(deliver()).resolves.toMatchObject({ delivered: true, state: "delivered" });
    expect(backend.webhook.calls).toHaveLength(1);
  });

  describe("failures", () => {
    it("records a timeout as unconfirmed and never retries it automatically", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        const backend = fakeBackend();
        backend.webhook.reply = () => new Promise<Response>(() => undefined); // never answers
        const pending = deliver();
        await vi.advanceTimersByTimeAsync(GHL_REQUEST_TIMEOUT_MS);
        await expect(pending).resolves.toEqual({ delivered: false, state: "unconfirmed", status: null });
        expect(backend.row()?.details).toMatchObject({ ghl_delivery_state: "unconfirmed", ghl_delivery_attempts: "1", ghl_delivery_http: "" });
        backend.webhook.reply = () => new Response("{}", { status: 200 });
        await expect(deliver()).resolves.toMatchObject({ delivered: false, state: "skipped" });
        expect(backend.webhook.calls).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it.each([500, 502, 503, 504])("records a %s as unconfirmed, because GHL may have processed it, and does not retry", async (status) => {
      const backend = fakeBackend();
      backend.webhook.reply = () => new Response("{}", { status });
      await expect(deliver()).resolves.toEqual({ delivered: false, state: "unconfirmed", status });
      await deliver();
      expect(backend.webhook.calls).toHaveLength(1);
      expect(backend.row()?.details["ghl_delivery_http"]).toBe(String(status));
    });

    it("records a network failure as unconfirmed and does not retry", async () => {
      const backend = fakeBackend();
      backend.webhook.reply = () => { throw new TypeError(`connect failed for ${EMAIL}`); };
      await expect(deliver()).resolves.toEqual({ delivered: false, state: "unconfirmed", status: null });
      await deliver();
      expect(backend.webhook.calls).toHaveLength(1);
    });

    it("records a refusal (4xx) as failed and allows another attempt, up to the limit", async () => {
      const backend = fakeBackend();
      backend.webhook.reply = () => new Response("{}", { status: 422 });
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        await expect(deliver()).resolves.toEqual({ delivered: false, state: "failed", status: 422 });
        expect(backend.row()?.details["ghl_delivery_attempts"]).toBe(String(attempt));
      }
      expect(backend.webhook.calls).toHaveLength(MAX_ATTEMPTS);
      expect(backend.webhook.calls.map((call) => call["delivery_attempt"])).toEqual(["1", "2", "3"]);
      await expect(deliver()).resolves.toMatchObject({ delivered: false, state: "skipped" });
      expect(backend.webhook.calls).toHaveLength(MAX_ATTEMPTS);
    });

    it("delivers on a later attempt after a refusal and then never again", async () => {
      const backend = fakeBackend();
      backend.webhook.reply = () => new Response("{}", { status: 404 });
      await deliver();
      backend.webhook.reply = () => new Response("{}", { status: 200 });
      await expect(deliver()).resolves.toEqual({ delivered: true, state: "delivered", status: 200 });
      await deliver();
      expect(backend.webhook.calls).toHaveLength(2);
      expect(backend.row()?.details["ghl_delivery_attempts"]).toBe("2");
    });

    it("does not resend a lead that another process is sending, and marks an abandoned claim unconfirmed", async () => {
      const recent = fakeBackend(makeRow({ details: { ghl_delivery_state: "sending", ghl_delivery_attempts: "1", ghl_delivery_at: new Date(NOW.getTime() - 1000).toISOString() } }));
      await expect(deliver()).resolves.toMatchObject({ state: "skipped" });
      expect(recent.state()).toBe("sending");
      expect(recent.webhook.calls).toHaveLength(0);
      vi.unstubAllGlobals();

      const stale = fakeBackend(makeRow({ details: { ghl_delivery_state: "sending", ghl_delivery_attempts: "1", ghl_delivery_at: new Date(NOW.getTime() - STALE_CLAIM_MS - 1000).toISOString() } }));
      await expect(deliver()).resolves.toMatchObject({ state: "skipped" });
      expect(stale.state()).toBe("unconfirmed");
      expect(stale.webhook.calls).toHaveLength(0);
    });

    it("still returns normally when the delivery state cannot be recorded", async () => {
      const backend = fakeBackend();
      const original = backend.fetchMock.getMockImplementation()!;
      let patches = 0;
      backend.fetchMock.mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
        if ((init?.method ?? "GET") === "PATCH") {
          patches += 1;
          if (patches > 1) return new Response("down", { status: 503 });
        }
        return original(input, init);
      });
      await expect(deliver()).resolves.toMatchObject({ delivered: false, state: "unconfirmed" });
      expect(backend.webhook.calls).toHaveLength(1);
    });
  });

  describe("only stored, recent, forwardable leads are sent", () => {
    it("ignores an unknown lead", async () => {
      const backend = fakeBackend(null);
      await expect(deliver("22222222-2222-4222-8222-222222222222")).resolves.toEqual({ delivered: false, state: "ineligible", status: null });
      expect(backend.webhook.calls).toHaveLength(0);
    });

    it("ignores lead types that are not forwarded (purchase, lease, unknown)", async () => {
      for (const leadType of ["purchase", "lease_to_own", "unknown"]) {
        const backend = fakeBackend(makeRow({ lead_type: leadType }));
        await expect(deliver(), leadType).resolves.toMatchObject({ state: "ineligible" });
        expect(backend.webhook.calls).toHaveLength(0);
        vi.unstubAllGlobals();
      }
    });

    it("ignores leads that are too old or dated in the future, so old records cannot be replayed", async () => {
      for (const created of [new Date(NOW.getTime() - MAX_LEAD_AGE_MS - 1000).toISOString(), "2026-10-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z", "not a date"]) {
        const backend = fakeBackend(makeRow({ created_at: created }));
        await expect(deliver(), created).resolves.toMatchObject({ state: "ineligible" });
        expect(backend.webhook.calls).toHaveLength(0);
        vi.unstubAllGlobals();
      }
    });

    it("builds the payload from the stored record, including vehicle details and a page URL fallback", async () => {
      const backend = fakeBackend(makeRow({
        lead_type: "appointment",
        vehicle_id: "33333333-3333-4333-8333-333333333333",
        details: {
          preferred_date: "2026-11-02",
          preferred_time: "10:00",
          appointment_type: "test_drive",
          vehicle_vin: "SYNTHETICVIN000001",
          vehicle_year: "2019",
          vehicle_make: "Honda",
          vehicle_model: "Civic",
          conversion_page: "https://mycarcorp.com/schedule",
          lead_source: "Bing Organic",
        },
      }));
      await deliver();
      expect(backend.webhook.calls[0]).toMatchObject({
        event_type: "book_a_visit",
        preferred_date: "2026-11-02",
        appointment_type: "test_drive",
        vehicle_id: "33333333-3333-4333-8333-333333333333",
        vin: "SYNTHETICVIN000001",
        make: "Honda",
        model: "Civic",
        vehicle_url: "https://mycarcorp.com/schedule",
        lead_source: "Bing Organic",
      });
    });

    it("keeps the Car Finder and finance routing", async () => {
      const carFinder = fakeBackend(makeRow({ details: { request_type: "car_finder", preferred_make: "Honda", maximum_budget: "15000" } }));
      await deliver();
      expect(carFinder.webhook.calls[0]).toMatchObject({ event_type: "car_finder_request", preferred_make: "Honda", maximum_budget: "15000" });
      vi.unstubAllGlobals();
      resetGhlForwardingStateForTests();
      const finance = fakeBackend(makeRow({ lead_type: "finance", details: { employment: "employed", ssn: "900-12-3456" } }));
      await deliver();
      expect(finance.webhook.calls[0]).toMatchObject({ event_type: "financing", employment: "employed" });
      expect(JSON.stringify(finance.webhook.calls[0])).not.toContain("900-12-3456");
    });
  });

  describe("configuration and logging", () => {
    it("does nothing, and says so safely, when the backend credentials are missing", async () => {
      delete process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"];
      delete process.env["SUPABASE_SERVICE_ROLE_KEY"];
      const backend = fakeBackend();
      await expect(deliver()).resolves.toEqual({ delivered: false, state: "not_configured", status: null });
      expect(backend.fetchMock).not.toHaveBeenCalled();
    });

    it("never logs contact details, the lead ID, the secret key or any webhook URL", async () => {
      const backend = fakeBackend();
      backend.webhook.reply = () => new Response(`echo ${EMAIL} ${NAME}`, { status: 503 });
      await deliver();
      backend.webhook.reply = () => { throw new TypeError(`failed ${EMAIL} ${PHONE}`); };
      backend.set(makeRow());
      resetGhlForwardingStateForTests();
      await deliver();
      const logged = JSON.stringify([...logSpy.mock.calls, ...errorSpy.mock.calls, ...warnSpy.mock.calls]);
      for (const secret of [EMAIL, NAME, PHONE, LEAD_ID, "synthetic-secret-key", TEST_WEBHOOK, "supabase.test"]) {
        expect(logged, secret).not.toContain(secret);
      }
      expect(logged).not.toMatch(/https?:\/\//);
    });
  });
});

describe("browser side of the lead flow", () => {
  it("creates a valid, unique v4 UUID for each lead", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newLeadId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("still creates a valid UUID where crypto.randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => bytes.map((_, index) => (index * 37 + 11) % 256) });
    expect(newLeadId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    vi.stubGlobal("crypto", undefined);
    expect(newLeadId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    vi.unstubAllGlobals();
  });

  it("saves the lead under that ID and sends only the ID to the server, never contact data", () => {
    const source = readFileSync("src/components/LeadForm.tsx", "utf8");
    expect(source).toContain("id: leadId,");
    expect(source).toContain("sendLeadToGhl({ data: { leadId } })");
    const call = source.slice(source.indexOf("sendLeadToGhl({"), source.indexOf("sendLeadToGhl({") + 120);
    expect(call).not.toMatch(/email|phone|fullName|details/);
  });

  it("keeps the CEO-owned senders on their own transport, outside this lead path", () => {
    for (const file of ["src/lib/lease-to-own.functions.ts", "src/lib/purchases.functions.ts"]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).toContain("ghl-webhook.server");
      expect(source, file).not.toMatch(/ghl-delivery|sendLeadToGhl|postToGhlTimed/);
    }
  });

  it("documents the new setting by name only", () => {
    const example = readFileSync(".env.example", "utf8");
    expect(example).toMatch(/^GHL_WEBHOOK_URL=$/m);
    expect(example).not.toMatch(/sb_secret_|eyJ|webhook-trigger|https:\/\/services/);
  });
});
