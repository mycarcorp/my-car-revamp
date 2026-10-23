import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBrowserAnalyticsAdapter,
  createAnalyticsController,
  getGa4MeasurementId,
  getTrackingConsentPreferences,
  getLeadFormType,
  isAnalyticsRoutePublic,
  isMetaSafeUrl,
  publicCatalogItemId,
  recordFormStart,
  recordLeadSubmission,
  resetMetaPixelStateForTests,
  sanitizeEvent,
  sanitizePageLocation,
  setTrackingConsentPreferences,
  trackMetaPageView,
} from "./analytics";

function mockAdapter() {
  return {
    load: vi.fn(),
    updateConsent: vi.fn(),
    send: vi.fn(),
  };
}

describe("central GA4 analytics gate", () => {
  it("uses the required production measurement ID when build-time env injection is missing", () => {
    expect(getGa4MeasurementId()).toBe("G-CFXQ8JPE21");
  });

  it("loads the Google tag only after consent and sends one page view per route", () => {
    const calls: unknown[][] = [];
    const script = { async: false, src: "", dataset: {} as Record<string, string> };
    const appendChild = vi.fn();
    vi.stubGlobal("window", { location: { origin: "https://mycarcorp.com" }, dataLayer: calls });
    vi.stubGlobal("document", {
      querySelector: vi.fn(() => null),
      createElement: vi.fn(() => script),
      head: { appendChild },
    });
    try {
      const adapter = createBrowserAnalyticsAdapter();
      const analytics = createAnalyticsController(adapter);
      const environment = { measurementId: getGa4MeasurementId(), isPublicRoute: true };
      analytics.configure({ ...environment, consent: "unknown" });
      expect(analytics.pageView("/", "https://mycarcorp.com")).toBe(false);
      expect(appendChild).not.toHaveBeenCalled();
      expect(calls).toHaveLength(0);

      analytics.configure({ ...environment, consent: "granted" });
      expect(appendChild).toHaveBeenCalledOnce();
      expect(script.src).toBe("https://www.googletagmanager.com/gtag/js?id=G-CFXQ8JPE21");
      expect(analytics.pageView("/", "https://mycarcorp.com")).toBe(true);
      expect(analytics.pageView("/", "https://mycarcorp.com")).toBe(false);
      expect(analytics.pageView("/search", "https://mycarcorp.com")).toBe(true);
      expect(calls.filter((call) => call[0] === "event" && call[1] === "page_view")).toHaveLength(2);
      expect(analytics.track({
        name: "view_item",
        params: { item_id: "2019-honda-civic", item_name: "2019 Honda Civic" },
      })).toBe(true);
      expect(calls.some((call) => call[0] === "event" && call[1] === "view_item")).toBe(true);

      analytics.configure({ ...environment, consent: "denied" });
      expect(analytics.pageView("/inventory", "https://mycarcorp.com")).toBe(false);
      expect(analytics.track({ name: "view_item", params: { item_id: "2019-honda-civic", item_name: "2019 Honda Civic" } })).toBe(false);
      expect(analytics.track({ name: "form_start", params: { form_type: "contact" } })).toBe(false);
      expect(calls.filter((call) => call[0] === "event" && call[1] === "page_view")).toHaveLength(2);
      expect(calls.some((call) => call[0] === "consent" && call[1] === "update" && (call[2] as { analytics_storage?: string }).analytics_storage === "denied")).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("pushes gtag commands to dataLayer as Arguments objects, which gtag.js requires", () => {
    const calls: unknown[] = [];
    const script = { async: false, src: "", dataset: {} as Record<string, string> };
    vi.stubGlobal("window", { location: { origin: "https://mycarcorp.com" }, dataLayer: calls });
    vi.stubGlobal("document", {
      querySelector: vi.fn(() => null),
      createElement: vi.fn(() => script),
      head: { appendChild: vi.fn() },
    });
    try {
      const analytics = createAnalyticsController(createBrowserAnalyticsAdapter());
      analytics.configure({ measurementId: "G-CFXQ8JPE21", consent: "granted", isPublicRoute: true });
      analytics.pageView("/", "https://mycarcorp.com");
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        expect(Object.prototype.toString.call(call)).toBe("[object Arguments]");
        expect(Array.isArray(call)).toBe(false);
      }
      const commands = calls.map((call) => (call as unknown[])[0]);
      expect(commands).toEqual(expect.arrayContaining(["js", "consent", "config", "event"]));
      expect(calls.filter((call) => (call as unknown[])[0] === "config")).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not load or send before explicit analytics consent", () => {
    const adapter = mockAdapter();
    const analytics = createAnalyticsController(adapter);
    analytics.configure({ measurementId: "G-CFXQ8JPE21", consent: "unknown", isPublicRoute: true });
    expect(analytics.pageView("/", "https://mycarcorp.com")).toBe(false);
    expect(analytics.track({ name: "form_start", params: { form_type: "contact" } })).toBe(false);
    expect(adapter.load).not.toHaveBeenCalled();
    expect(adapter.send).not.toHaveBeenCalled();
  });

  it("does not load on admin routes even after consent", () => {
    const adapter = mockAdapter();
    const analytics = createAnalyticsController(adapter);
    analytics.configure({ measurementId: "G-CFXQ8JPE21", consent: "granted", isPublicRoute: false });
    expect(analytics.pageView("/admin/marketing", "https://mycarcorp.com")).toBe(false);
    expect(adapter.load).not.toHaveBeenCalled();
    expect(isAnalyticsRoutePublic("/admin/marketing")).toBe(false);
    expect(isAnalyticsRoutePublic("/api/public/vehicles")).toBe(false);
    expect(isAnalyticsRoutePublic("/my/purchases/123")).toBe(false);
    expect(isAnalyticsRoutePublic("/auth/callback")).toBe(false);
    expect(isAnalyticsRoutePublic("/reset-password")).toBe(false);
    expect(isAnalyticsRoutePublic("/search")).toBe(true);
    expect(isAnalyticsRoutePublic("/administrator")).toBe(true);
  });

  it("sends one page_view per sanitized route location", () => {
    const adapter = mockAdapter();
    const analytics = createAnalyticsController(adapter);
    analytics.configure({ measurementId: "G-CFXQ8JPE21", consent: "granted", isPublicRoute: true });
    expect(analytics.pageView("/schedule?vin=1HGCM82633A004352#form", "https://mycarcorp.com")).toBe(true);
    expect(analytics.pageView("/schedule?email=private@example.com", "https://mycarcorp.com")).toBe(false);
    expect(analytics.pageView("/search?make=Honda", "https://mycarcorp.com")).toBe(true);
    expect(adapter.load).toHaveBeenCalledTimes(1);
    expect(adapter.send).toHaveBeenCalledTimes(2);
    expect(adapter.send).toHaveBeenNthCalledWith(1, {
      name: "page_view",
      params: { page_path: "/schedule", page_location: "https://mycarcorp.com/schedule" },
    });
    expect(sanitizePageLocation("/inventory/car?vin=1HGCM82633A004352#detail", "https://mycarcorp.com"))
      .toBe("https://mycarcorp.com/inventory/car");
    expect(sanitizePageLocation("/inventory/1HGCM82633A004352", "https://mycarcorp.com"))
      .toBe("https://mycarcorp.com/inventory/redacted");
    expect(sanitizePageLocation("/", "http://mycarcorp.com")).toBe("");
  });

  it("requires a valid configured measurement ID", () => {
    const adapter = mockAdapter();
    const analytics = createAnalyticsController(adapter);
    analytics.configure({ measurementId: "", consent: "granted", isPublicRoute: true });
    expect(analytics.getStatus()).toMatchObject({ configured: false, active: false });
    expect(analytics.pageView("/", "https://mycarcorp.com")).toBe(false);
    expect(adapter.load).not.toHaveBeenCalled();
  });

  it("loads only after explicit grant and sends denied on consent revocation", () => {
    const adapter = mockAdapter();
    const analytics = createAnalyticsController(adapter);
    analytics.configure({ measurementId: "G-CFXQ8JPE21", consent: "unknown", isPublicRoute: true });
    expect(adapter.load).not.toHaveBeenCalled();
    analytics.configure({ measurementId: "G-CFXQ8JPE21", consent: "granted", isPublicRoute: true });
    expect(adapter.load).toHaveBeenCalledTimes(1);
    expect(adapter.updateConsent).toHaveBeenCalledWith("granted");
    analytics.configure({ measurementId: "G-CFXQ8JPE21", consent: "denied", isPublicRoute: true });
    expect(adapter.updateConsent).toHaveBeenLastCalledWith("denied");
    expect(analytics.track({ name: "form_start", params: { form_type: "contact" } })).toBe(false);
    expect(adapter.send).not.toHaveBeenCalled();
  });
});

describe("GA4 event allowlists", () => {
  it("keeps appointment events consent-aware and strips all fields except appointment type", () => {
    expect(sanitizeEvent({
      name: "appointment_vehicle_selected",
      params: {
        appointment_type: "test_drive",
        vehicle_id: "internal-id",
        vehicle_vin: "1HGCM82633A004352",
        stock_number: "MC-123",
        page_url: "https://mycarcorp.com/schedule?vin=1HGCM82633A004352",
      },
    } as never)).toEqual({ name: "appointment_vehicle_selected", params: { appointment_type: "test_drive" } });
    expect(sanitizeEvent({
      name: "appointment_type_selected",
      params: { appointment_type: "customer supplied type", email: "private@example.com" },
    } as never)).toBeNull();
  });

  it("stores independent analytics and Meta decisions without enabling either by default", () => {
    const data = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
    };
    vi.stubGlobal("window", { localStorage, location: { origin: "https://mycarcorp.com", href: "https://mycarcorp.com/" } });
    vi.stubGlobal("document", {
      querySelector: vi.fn(() => null),
      createElement: vi.fn(() => ({ async: false, src: "", dataset: {} })),
      head: { appendChild: vi.fn() },
    });
    try {
      data.set("mycar.analyticsConsent", "granted");
      expect(getTrackingConsentPreferences()).toEqual({ analytics: "unknown", meta: "unknown" });
      expect(trackMetaPageView("/")).toBe(false);
      setTrackingConsentPreferences({ analytics: "granted", meta: "denied" }, "/");
      expect(getTrackingConsentPreferences()).toEqual({ analytics: "granted", meta: "denied" });
      expect(JSON.parse(data.get("mycar.trackingConsent.v1") ?? "{}")).toEqual({ analytics: "granted", meta: "denied" });
      setTrackingConsentPreferences({ analytics: "denied", meta: "denied" }, "/");
      expect(getTrackingConsentPreferences()).toEqual({ analytics: "denied", meta: "denied" });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("applies denials in memory when persistent storage is blocked", () => {
    let blocked = true;
    const data = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => {
        if (blocked) throw new Error("storage blocked");
        return data.get(key) ?? null;
      },
      setItem: (key: string, value: string) => {
        if (blocked) throw new Error("storage blocked");
        data.set(key, value);
      },
    };
    vi.stubGlobal("window", { localStorage, location: { origin: "https://mycarcorp.com", href: "https://mycarcorp.com/" } });
    try {
      setTrackingConsentPreferences({ analytics: "denied", meta: "denied" }, "/");
      expect(getTrackingConsentPreferences()).toEqual({ analytics: "denied", meta: "denied" });
      blocked = false;
      setTrackingConsentPreferences({ analytics: "denied", meta: "denied" }, "/");
      expect(getTrackingConsentPreferences()).toEqual({ analytics: "denied", meta: "denied" });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not initialize Meta Pixel on query-bearing URLs even after Meta consent", () => {
    const data = new Map([["mycar.trackingConsent.v1", JSON.stringify({ analytics: "denied", meta: "granted" })]]);
    const createElement = vi.fn(() => ({ async: false, src: "", dataset: {} }));
    const appendChild = vi.fn();
    vi.stubGlobal("window", {
      localStorage: { getItem: (key: string) => data.get(key) ?? null },
      location: { origin: "https://mycarcorp.com", href: "https://mycarcorp.com/schedule?type=test_drive" },
    });
    vi.stubGlobal("document", {
      querySelector: vi.fn(() => null),
      createElement,
      head: { appendChild },
    });
    try {
      expect(trackMetaPageView("/schedule")).toBe(false);
      expect(createElement).not.toHaveBeenCalled();
      expect(appendChild).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps only whitelisted form fields and strips caller-supplied identifiers", () => {
    expect(sanitizeEvent({
      name: "generate_lead",
      params: {
        form_type: "sell",
        lead_intent: "trade",
        email: "private@example.com",
        phone: "5405550100",
        vin: "1HGCM82633A004352",
        full_name: "Private Customer",
      },
    } as never)).toEqual({ name: "generate_lead", params: { form_type: "sell", lead_intent: "trade" } });
  });

  it("rejects unsafe item identifiers, PII-like names, and arbitrary list labels", () => {
    expect(sanitizeEvent({
      name: "view_item_list",
      params: {
        item_list_name: "search=VIN123",
        items: [{ item_id: "550e8400-e29b-41d4-a716-446655440000", item_name: "Jane Doe" }],
      },
    })).toBeNull();
    expect(sanitizeEvent({
      name: "view_item",
      params: { item_id: "public-car-slug", item_name: "Jane Doe 5405550100" },
    })).toBeNull();
    expect(sanitizeEvent({
      name: "view_item",
      params: { item_id: "vehicle-slug", item_name: "2019 Honda Civic", item_category: "Sedan", price: 15000, currency: "USD" },
    })).toEqual({
      name: "view_item",
      params: { item_id: "vehicle-slug", item_name: "2019 Honda Civic", item_category: "Sedan", price: 15000, currency: "USD" },
    });
    expect(sanitizeEvent({
      name: "view_item",
      params: { item_id: "1hgcm82633a004352", item_name: "2019 Honda Civic", item_category: "Sedan" },
    })).toBeNull();
    expect(publicCatalogItemId(2019, "Honda", "Civic")).toBe("2019-honda-civic");
    expect(publicCatalogItemId(2019, "1HGCM82633A004352", "Civic")).toBe("");
  });

  it("allows only fixed form categories and first-party sell/trade intent", () => {
    expect(getLeadFormType("trade", { intent: "sell" })).toBe("sell");
    expect(getLeadFormType("contact", { request_type: "car_finder" })).toBe("car_finder");
    const send = vi.fn(() => true);
    expect(recordFormStart("finance", send)).toBe(true);
    expect(recordFormStart("arbitrary-user-value", send)).toBe(false);
    expect(recordLeadSubmission(true, "trade", { intent: "trade" }, send)).toBe(true);
    expect(send).toHaveBeenLastCalledWith({ name: "generate_lead", params: { form_type: "trade", lead_intent: "trade" } });
  });

  it("does not record failed lead submissions", () => {
    const send = vi.fn(() => true);
    expect(recordLeadSubmission(false, "finance", {}, send)).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
describe("Meta Pixel URL safety", () => {
  const origin = "https://mycarcorp.com";
  const fbclid = "IwAR2xK9aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789_abc-def";
  const gclid = "Cj0KCQjw-r_BhDdARIsAG8Kj7nXyZabc123_-defGHIjkl";

  it("allows query-free URLs and known advertising parameters with opaque values", () => {
    for (const path of [
      "/",
      "/?",
      "/search",
      `/?fbclid=${fbclid}`,
      `/finance?utm_source=facebook&utm_medium=paid_social&utm_campaign=preapproval_2026_10&fbclid=${fbclid}`,
      `/search?utm_source=google&utm_medium=cpc&utm_campaign=vla_inventory_2026_10&gclid=${gclid}`,
      "/?utm_source=fb&utm_medium=paid_social&utm_campaign=120210123456789012&utm_content=Spring%20Sale&utm_term=used+suv",
      "/?utm_campaign=fall-sale-2026-10-24",
      "/?gbraid=0AAAAAo1234567890abcdef&wbraid=CjQKCAjw1234567890abc&ttclid=E.C.P.AbCdEf12345&msclkid=abcdef1234567890abcdef",
    ]) {
      expect(isMetaSafeUrl(`${origin}${path}`), path).toBe(true);
    }
  });

  it("rejects unknown keys, repeated keys, empty values and malformed query structure", () => {
    for (const path of [
      "/schedule?type=test_drive",
      "/search?make=Honda",
      "/?email=private%40example.com",
      "/?name=Jane+Doe",
      "/?vin=1HGCM82633A004352",
      `/?fbclid=${fbclid}&email=private%40example.com`,
      `/?utm_source=a&utm_source=b`,
      `/?fbclid=${fbclid}&fbclid=${fbclid}`,
      "/?utm_source=",
      "/?utm_source",
      "/?&utm_source=facebook",
      "/?utm_source=facebook&",
      "/?utm%5Fsource=facebook",
      "/?UTM_SOURCE=facebook",
    ]) {
      expect(isMetaSafeUrl(`${origin}${path}`), path).toBe(false);
    }
  });

  it("rejects suspicious, encoded and sensitive values in allowed keys", () => {
    for (const path of [
      "/?utm_source=private%40example.com",
      "/?utm_source=private%2540example.com",
      "/?utm_source=a%252540b.com",
      "/?utm_content=5405550100",
      "/?utm_content=540-555-0100",
      "/?utm_content=540%20555%200100",
      "/?utm_term=1HGCM82633A004352",
      "/?utm_term=123-45-6789",
      "/?utm_term=123%2045%206789",
      "/?utm_campaign=%3Cscript%3Ealert(1)%3C%2Fscript%3E",
      "/?utm_campaign=a%2",
      "/?utm_campaign=jane/doe",
      `/?utm_campaign=${"a".repeat(257)}`,
      "/?fbclid=short",
      "/?fbclid=5405550100",
      "/?fbclid=abc%40def123456789",
      "/?fbclid=abc def123456789",
      `/?gclid=${"a".repeat(257)}`,
    ]) {
      expect(isMetaSafeUrl(`${origin}${path}`), path).toBe(false);
    }
  });

  it("rejects unsafe paths, fragments, credentials, insecure schemes and unparsable URLs", () => {
    expect(isMetaSafeUrl(`${origin}/inventory/1HGCM82633A004352?fbclid=${fbclid}`)).toBe(false);
    expect(isMetaSafeUrl(`${origin}/inventory/private@example.com`)).toBe(false);
    expect(isMetaSafeUrl(`${origin}/?fbclid=${fbclid}#details`)).toBe(false);
    expect(isMetaSafeUrl(`${origin}/#access_token=secret`)).toBe(false);
    expect(isMetaSafeUrl("https://user:pass@mycarcorp.com/")).toBe(false);
    expect(isMetaSafeUrl(`http://mycarcorp.com/?fbclid=${fbclid}`)).toBe(false);
    expect(isMetaSafeUrl("not a url")).toBe(false);
    expect(isMetaSafeUrl("")).toBe(false);
  });
});

describe("Meta Pixel PageView tracking", () => {
  const origin = "https://mycarcorp.com";
  const fbclid = "IwAR2xK9aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789_abc-def";

  function setup(options: { meta?: "granted" | "denied" | "unknown"; analytics?: "granted" | "denied" | "unknown"; path?: string } = {}) {
    const data = new Map<string, string>([
      ["mycar.trackingConsent.v1", JSON.stringify({ analytics: options.analytics ?? "denied", meta: options.meta ?? "granted" })],
    ]);
    const appendChild = vi.fn();
    const win: Record<string, unknown> = {
      localStorage: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => { data.set(key, value); },
      },
      location: { origin, href: `${origin}${options.path ?? "/"}` },
    };
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", {
      querySelector: vi.fn(() => null),
      createElement: vi.fn(() => ({ async: false, src: "", dataset: {} as Record<string, string> })),
      head: { appendChild },
    });
    return {
      appendChild,
      data,
      go: (path: string) => { (win["location"] as { href: string }).href = `${origin}${path}`; },
      calls: () => ((win["fbq"] as { queue?: unknown[][] } | undefined)?.queue ?? []).map((entry) => [...entry]),
      count: (name: string) => ((win["fbq"] as { queue?: unknown[][] } | undefined)?.queue ?? []).filter((entry) => entry[0] === "track" && entry[1] === name).length,
    };
  }

  beforeEach(() => resetMetaPixelStateForTests());
  afterEach(() => {
    vi.unstubAllGlobals();
    resetMetaPixelStateForTests();
  });

  it("sends exactly one PageView on a paid landing URL, with auto-configuration disabled before init", () => {
    const env = setup({ path: `/?utm_source=facebook&utm_medium=paid_social&fbclid=${fbclid}` });
    expect(trackMetaPageView("/")).toBe(true);
    expect(env.calls()).toEqual([
      ["set", "autoConfig", false, "913977571315979"],
      ["set", "smartSetup", false, "913977571315979"],
      ["init", "913977571315979"],
      ["consent", "grant"],
      ["track", "PageView"],
    ]);
    expect(env.appendChild).toHaveBeenCalledTimes(1);
  });

  it("sends only the bare PageView: no custom data, URL, or customer values reach the Pixel calls", () => {
    const env = setup({ path: `/?fbclid=${fbclid}` });
    trackMetaPageView("/");
    const trackCall = env.calls().find((entry) => entry[0] === "track");
    expect(trackCall).toEqual(["track", "PageView"]);
    const serialized = JSON.stringify(env.calls());
    expect(serialized).not.toContain(fbclid);
    expect(serialized).not.toContain("mycarcorp.com");
  });

  it("does not load or fire the Pixel on unsafe URLs even with Meta consent", () => {
    for (const path of ["/schedule?type=test_drive", "/search?make=Honda", `/?fbclid=${fbclid}&email=private%40example.com`, "/?utm_term=1HGCM82633A004352", "/?utm_source=facebook#frag"]) {
      const env = setup({ path });
      expect(trackMetaPageView(path.split(/[?#]/)[0]!)).toBe(false);
      expect(env.calls()).toEqual([]);
      expect(env.appendChild).not.toHaveBeenCalled();
      resetMetaPixelStateForTests();
      vi.unstubAllGlobals();
    }
  });

  it("does not fire for redacted paths or private routes", () => {
    const vin = "1HGCM82633A004352";
    const env = setup({ path: `/inventory/${vin}` });
    expect(trackMetaPageView(`/inventory/${vin}`)).toBe(false);
    env.go("/admin/marketing");
    expect(trackMetaPageView("/admin/marketing")).toBe(false);
    env.go("/my/purchases/123");
    expect(trackMetaPageView("/my/purchases/123")).toBe(false);
    expect(env.calls()).toEqual([]);
  });

  it("requires explicit Meta consent and ignores GA4 consent in both directions", () => {
    for (const meta of ["unknown", "denied"] as const) {
      const env = setup({ meta, analytics: "granted", path: `/?fbclid=${fbclid}` });
      expect(trackMetaPageView("/")).toBe(false);
      expect(env.calls()).toEqual([]);
      expect(env.appendChild).not.toHaveBeenCalled();
      resetMetaPixelStateForTests();
      vi.unstubAllGlobals();
    }
    const env = setup({ meta: "granted", analytics: "denied" });
    expect(trackMetaPageView("/")).toBe(true);
    expect(env.count("PageView")).toBe(1);
  });

  it("does not let a GA4 consent change trigger Meta", () => {
    const env = setup({ meta: "denied", analytics: "unknown" });
    setTrackingConsentPreferences({ analytics: "granted", meta: "denied" }, "/");
    expect(env.calls()).toEqual([]);
    expect(env.count("PageView")).toBe(0);
  });

  it("counts one PageView per page: route changes add one each, repeated calls for the same page add none", () => {
    const env = setup({ path: `/?fbclid=${fbclid}` });
    expect(trackMetaPageView("/")).toBe(true);
    expect(trackMetaPageView("/")).toBe(false);
    expect(env.count("PageView")).toBe(1);

    env.go("/search");
    expect(trackMetaPageView("/search")).toBe(true);
    expect(trackMetaPageView("/search")).toBe(false);
    expect(env.count("PageView")).toBe(2);

    env.go("/finance");
    expect(trackMetaPageView("/finance")).toBe(true);
    expect(env.count("PageView")).toBe(3);

    // One script, one init and one auto-config disable no matter how many pages were viewed.
    expect(env.appendChild).toHaveBeenCalledTimes(1);
    expect(env.calls().filter((entry) => entry[0] === "init")).toHaveLength(1);
    expect(env.calls().filter((entry) => entry[0] === "set" && entry[1] === "autoConfig")).toHaveLength(1);
    expect(env.calls().filter((entry) => entry[0] === "consent" && entry[1] === "grant")).toHaveLength(1);
  });

  it("does not duplicate PageView when preferences are re-saved on a page that already fired", () => {
    const env = setup({ meta: "granted", analytics: "denied" });
    expect(trackMetaPageView("/")).toBe(true);
    setTrackingConsentPreferences({ analytics: "granted", meta: "granted" }, "/");
    setTrackingConsentPreferences({ analytics: "denied", meta: "granted" }, "/");
    expect(env.count("PageView")).toBe(1);
  });

  it("fires one PageView when Meta consent is newly granted from the consent manager", () => {
    const env = setup({ meta: "unknown", analytics: "unknown", path: `/?utm_source=facebook&fbclid=${fbclid}` });
    expect(trackMetaPageView("/")).toBe(false);
    setTrackingConsentPreferences({ analytics: "denied", meta: "granted" }, "/");
    expect(env.count("PageView")).toBe(1);
    expect(env.calls()[0]).toEqual(["set", "autoConfig", false, "913977571315979"]);
  });

  it("revokes Pixel consent on an unsafe page and re-grants when a safe page is viewed again", () => {
    const env = setup({ path: `/?fbclid=${fbclid}` });
    expect(trackMetaPageView("/")).toBe(true);

    env.go("/search?make=Honda");
    expect(trackMetaPageView("/search")).toBe(false);
    expect(env.calls().filter((entry) => entry[0] === "consent" && entry[1] === "revoke")).toHaveLength(1);
    expect(env.count("PageView")).toBe(1);

    // Further suppressed calls do not repeat the revoke.
    expect(trackMetaPageView("/search")).toBe(false);
    expect(env.calls().filter((entry) => entry[0] === "consent" && entry[1] === "revoke")).toHaveLength(1);

    env.go("/");
    expect(trackMetaPageView("/")).toBe(true);
    expect(env.calls().filter((entry) => entry[0] === "consent" && entry[1] === "grant")).toHaveLength(2);
    expect(env.count("PageView")).toBe(2);
  });

  it("revokes when Meta consent is withdrawn and counts a fresh PageView if it is granted again", () => {
    const env = setup({ path: "/" });
    expect(trackMetaPageView("/")).toBe(true);
    env.data.set("mycar.trackingConsent.v1", JSON.stringify({ analytics: "denied", meta: "denied" }));
    expect(trackMetaPageView("/")).toBe(false);
    expect(env.calls().filter((entry) => entry[0] === "consent" && entry[1] === "revoke")).toHaveLength(1);
    env.data.set("mycar.trackingConsent.v1", JSON.stringify({ analytics: "denied", meta: "granted" }));
    expect(trackMetaPageView("/")).toBe(true);
    expect(env.count("PageView")).toBe(2);
  });
});
