import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { describeError, logSafeError, upstreamHttpError, UpstreamRequestError } from "./safe-log";
import { mirrorFinancingRow } from "./legacy-mirror.server";
import { postToGhl } from "./ghl-webhook.server";
import { mirrorLeadSubmission } from "./legacy-mirror.functions";
import { deliverLeadToGhl } from "./ghl-webhook.functions";

// Synthetic fixtures only: none of these belong to a real person.
const SSN = "900-12-3456";
const DOB = "1901-02-03";
const ID_NUMBER = "ZZ9999999";
const EMAIL = "synthetic.person@example.test";
const NAME = "Synthetic Person";
const SENSITIVE = [SSN, SSN.replace(/-/g, ""), DOB, ID_NUMBER, EMAIL, NAME];

const lead = {
  leadType: "finance" as const,
  fullName: NAME,
  email: EMAIL,
  phone: "5555550100",
  details: { ssn: SSN, date_of_birth: DOB, id_number: ID_NUMBER, cash_down: "1000" },
};

function expectClean(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value, (_k, v) => (v instanceof Error ? { name: v.name, message: v.message, stack: v.stack, cause: v.cause } : v));
  for (const secret of SENSITIVE) expect(text ?? "").not.toContain(secret);
}

function loggedText(...spies: Array<ReturnType<typeof vi.spyOn>>): string {
  return spies.flatMap((spy) => spy.mock.calls.map((args: unknown[]) => JSON.stringify(args, (_k, v) => (v instanceof Error ? { name: v.name, message: v.message, stack: v.stack, cause: v.cause } : v)))).join("\n");
}

type Reply = { status: number; body: string };
function mockFetch(reply: (url: string, init?: RequestInit) => Reply) {
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const { status, body } = reply(String(url), init);
    return new Response(body, { status });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("sensitive data never reaches logs or error messages", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env["LEGACY_SUPABASE_URL"] = "https://legacy.example.test";
    process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"] = "synthetic-service-key";
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env["LEGACY_SUPABASE_URL"];
    delete process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"];
  });

  it("drops the response body from a failed legacy insert and keeps status and provider code", async () => {
    mockFetch((url, init) => {
      if (init?.method === "POST") {
        return { status: 409, body: JSON.stringify({ code: "23505", message: `duplicate key value (ssn)=(${SSN}) (dob)=(${DOB})`, details: `Key (email)=(${EMAIL})` }) };
      }
      return { status: 200, body: JSON.stringify([{ id: 7 }]) };
    });
    const error = await mirrorFinancingRow({ ...lead, userId: null }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamRequestError);
    expectClean((error as Error).message);
    expectClean(error);
    expect(describeError(error)).toEqual({ category: "http_error", status: 409, code: "23505" });
  });

  it("does not leak input through JSON parse errors on malformed upstream responses", async () => {
    mockFetch(() => ({ status: 200, body: `{"ssn": ${SSN}, "dob": "${DOB}"` }));
    const error = await mirrorFinancingRow({ ...lead, userId: null }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamRequestError);
    expectClean((error as Error).message);
    expect(describeError(error)).toEqual({ category: "invalid_response", status: 200 });
  });

  it("still falls back to the base row when the extended financing columns are missing", async () => {
    const posts: unknown[] = [];
    mockFetch((url, init) => {
      if (init?.method === "POST" && url.includes("mc_financing")) {
        posts.push(JSON.parse(String(init.body)));
        return posts.length === 1
          ? { status: 400, body: JSON.stringify({ code: "PGRST204", message: "Could not find the 'ssn' column of 'mc_financing' in the schema cache" }) }
          : { status: 201, body: "" };
      }
      return { status: 200, body: JSON.stringify([{ id: 7 }]) };
    });
    await expect(mirrorFinancingRow({ ...lead, userId: null })).resolves.toBeUndefined();
    expect(posts).toHaveLength(2);
    expect(Object.keys(posts[1] as object)).not.toContain("ssn");
    expect(Object.keys(posts[1] as object)).not.toContain("application");
  });

  it("does not rethrow unrelated database failures as a missing-column fallback", async () => {
    let posts = 0;
    mockFetch((url, init) => {
      if (init?.method === "POST" && url.includes("mc_financing")) {
        posts += 1;
        return { status: 500, body: JSON.stringify({ code: "XX000", message: `boom ${SSN}` }) };
      }
      return { status: 200, body: JSON.stringify([{ id: 7 }]) };
    });
    await expect(mirrorFinancingRow({ ...lead, userId: null })).rejects.toBeInstanceOf(UpstreamRequestError);
    expect(posts).toBe(1);
  });

  it("logs only the operation and fixed fields for any thrown value", () => {
    const hostile = Object.assign(new Error(`failed for ${NAME} ${SSN} ${EMAIL}`), { name: `Err ${SSN}`, cause: new Error(DOB) });
    logSafeError("synthetic.operation", hostile);
    logSafeError("synthetic.operation", upstreamHttpError(400, JSON.stringify({ code: `bad ${SSN}`, message: ID_NUMBER })));
    logSafeError("synthetic.operation", `${SSN} thrown as a string`);
    const text = loggedText(errorSpy, logSpy, warnSpy);
    expectClean(text);
    expect(text).toContain("synthetic.operation");
  });

  it("does not log the GHL response body or the submitted payload on delivery failure", async () => {
    mockFetch(() => ({ status: 422, body: JSON.stringify({ error: `rejected ${SSN} ${EMAIL}`, echoed: lead }) }));
    const status = await postToGhl({ event_type: "financing", full_name: NAME, email: EMAIL, ssn: SSN });
    expect(status).toBe(422);
    const text = loggedText(errorSpy, logSpy, warnSpy);
    expectClean(text);
    expect(text).toContain("422");
  });

  it("never reports a failed GHL response as delivered, and logs only the status", async () => {
    for (const status of [400, 404, 422, 429, 500, 503]) {
      errorSpy.mockClear();
      logSpy.mockClear();
      mockFetch(() => ({ status, body: JSON.stringify({ error: `rejected ${SSN} ${EMAIL}` }) }));
      expect(await postToGhl({ event_type: "financing", full_name: NAME, email: EMAIL, ssn: SSN })).toBe(status);
      expect(loggedText(logSpy)).not.toMatch(/delivered/i);
      expect(errorSpy.mock.calls).toEqual([["[ghl-webhook] delivery failed", { status }]]);
      expectClean(loggedText(errorSpy, logSpy, warnSpy));
    }
  });

  it("logs a delivery only for a successful GHL response, without customer fields", async () => {
    mockFetch(() => ({ status: 200, body: "{}" }));
    expect(await postToGhl({ event_type: "book_a_visit", full_name: NAME, email: EMAIL })).toBe(200);
    expect(logSpy.mock.calls).toEqual([["[ghl-webhook] delivered", "book_a_visit", 200]]);
    expect(errorSpy).not.toHaveBeenCalled();
    expectClean(loggedText(errorSpy, logSpy, warnSpy));
  });

  it("returns a generic result and logs nothing sensitive when the legacy mirror server function fails", async () => {
    mockFetch(() => ({ status: 500, body: JSON.stringify({ message: `${SSN} ${DOB} ${ID_NUMBER}` }) }));
    const result = await mirrorLeadSubmission({ ...lead, phone: null, message: null, vehicleId: null, userId: null });
    expect(result).toEqual({ mirrored: false });
    expectClean(result);
    const text = loggedText(errorSpy, logSpy, warnSpy);
    expectClean(text);
    expect(text).toContain("legacy-mirror.lead");
  });

  it("returns a generic result and logs nothing sensitive when the GHL server function throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError(`fetch failed for ${SSN} ${EMAIL}`); }));
    const result = await deliverLeadToGhl({ ...lead, phone: "", message: "", vehicleUrl: "", vehicle: null });
    expect(result).toEqual({ delivered: false, status: null });
    expectClean(result);
    const text = loggedText(errorSpy, logSpy, warnSpy);
    expectClean(text);
    expect(text).toContain("ghl-webhook.request");
  });
});
