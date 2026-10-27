import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureAttribution,
  getAttributionDetails,
  resetAttributionStateForTests,
} from "./attribution";

const ORIGIN = "https://mycarcorp.com";
const T0 = Date.parse("2026-11-01T12:00:00.000Z");
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

type Consent = { analytics: "granted" | "denied" | "unknown"; meta: "granted" | "denied" | "unknown" };

function setup(consent: Consent = { analytics: "unknown", meta: "unknown" }) {
  const data = new Map<string, string>([["mycar.trackingConsent.v1", JSON.stringify(consent)]]);
  const doc = { referrer: "" };
  const win: Record<string, unknown> = {
    localStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
    },
    location: {},
  };
  const place = (target: string) => {
    const url = new URL(target.startsWith("http") ? target : `${ORIGIN}${target}`);
    win["location"] = { href: url.href, search: url.search, hostname: url.hostname, pathname: url.pathname, origin: url.origin };
  };
  place("/");
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", doc);
  resetAttributionStateForTests();
  return {
    data,
    /** A full page load: the browser gives the page one document.referrer. */
    load(target: string, referrer = "", now = T0) {
      resetAttributionStateForTests();
      doc.referrer = referrer;
      place(target);
      captureAttribution(now);
    },
    /** Client-side navigation: the URL changes, document.referrer does not, and module state survives. */
    navigate(target: string, now = T0) {
      place(target);
      captureAttribution(now);
    },
    details: (now = T0) => getAttributionDetails(now),
    stored: (key: "mc_attr_first" | "mc_attr_last") => {
      const raw = data.get(key);
      return raw ? (JSON.parse(raw) as Record<string, string>) : null;
    },
    setConsent(next: Consent) { data.set("mycar.trackingConsent.v1", JSON.stringify(next)); },
  };
}

describe("attribution capture and persistence", () => {
  beforeEach(() => vi.stubGlobal("window", undefined));
  afterEach(() => {
    vi.unstubAllGlobals();
    resetAttributionStateForTests();
  });

  describe("internal navigation", () => {
    it("keeps the campaign UTMs of a visit that arrived with a referrer after in-site navigation", () => {
      const env = setup();
      env.load("/?utm_source=facebook&utm_medium=paid_social&utm_campaign=spring", "https://l.facebook.com/l.php?u=secret", T0);
      const arrival = env.details(T0);
      for (const path of ["/inventory", "/inventory/2019-honda-civic", "/contact"]) env.navigate(path, T0 + 2 * MINUTE);
      const later = env.details(T0 + 3 * MINUTE);
      expect(later).toMatchObject({
        lead_source: "Facebook",
        lead_medium: "paid_social",
        channel: "paid_social",
        utm_campaign: "spring",
        last_touch_utm_campaign: "spring",
        last_touch_channel: "paid_social",
        first_touch_utm_campaign: "spring",
      });
      expect(later["last_touch_timestamp"]).toBe(arrival["last_touch_timestamp"]);
      expect(later["landing_page"]).toBe(arrival["landing_page"]);
      expect(later["landing_page"]).toContain("utm_campaign=spring");
    });

    it("keeps an existing campaign last touch when a returning visitor navigates inside the site", () => {
      const env = setup();
      env.load("/", "https://www.google.com/", T0);
      env.load("/?utm_source=facebook&utm_medium=paid_social&utm_campaign=fall", "https://l.facebook.com/", T0 + 2 * DAY);
      env.navigate("/sell", T0 + 2 * DAY + MINUTE);
      env.navigate("/contact", T0 + 2 * DAY + 2 * MINUTE);
      expect(env.details(T0 + 2 * DAY + 3 * MINUTE)).toMatchObject({
        first_touch_source: "Google Organic",
        last_touch_source: "Facebook",
        last_touch_utm_campaign: "fall",
      });
    });

    it("never treats a same-site referrer as a touch", () => {
      const env = setup();
      env.load("/?utm_source=google&utm_medium=organic", "", T0);
      env.load("/inventory", "https://mycarcorp.com/", T0 + 5 * MINUTE);
      env.load("/inventory", "https://www.mycarcorp.com/search", T0 + 6 * MINUTE);
      expect(env.details(T0 + 7 * MINUTE)).toMatchObject({ last_touch_source: "Google Organic", last_touch_medium: "organic" });
    });

    it("reads document.referrer once per page load, so repeated calls add no touch", () => {
      const env = setup();
      env.load("/", "https://www.bing.com/", T0);
      const first = env.stored("mc_attr_last");
      env.navigate("/inventory", T0 + DAY);
      env.navigate("/contact", T0 + DAY);
      env.details(T0 + DAY);
      expect(env.stored("mc_attr_last")).toEqual(first);
    });
  });

  describe("direct visits", () => {
    it("never overwrite a known campaign", () => {
      const env = setup();
      env.load("/?utm_source=google&utm_medium=cpc&utm_campaign=brand", "", T0);
      env.load("/", "", T0 + 5 * DAY);
      env.load("/contact", "", T0 + 6 * DAY);
      expect(env.details(T0 + 6 * DAY)).toMatchObject({ lead_source: "Google Ads", channel: "paid_search", last_touch_utm_campaign: "brand" });
    });

    it("records Direct for a first visit with no signal", () => {
      const env = setup();
      env.load("/", "", T0);
      expect(env.details(T0)).toMatchObject({ lead_source: "Direct Traffic", channel: "direct", first_touch_source: "Direct Traffic", last_touch_source: "Direct Traffic" });
    });

    it("upgrades a first Direct touch when a qualifying touch arrives, keeping the new touch's own timestamp", () => {
      const env = setup();
      env.load("/", "", T0);
      env.load("/", "https://www.google.com/", T0 + 3 * DAY);
      const details = env.details(T0 + 3 * DAY);
      expect(details).toMatchObject({ first_touch_source: "Google Organic", first_touch_channel: "organic_search", last_touch_source: "Google Organic" });
      expect(details["first_touch_timestamp"]).toBe(new Date(T0 + 3 * DAY).toISOString());
    });

    it("keeps a real first touch, and its original timestamp, when later touches arrive", () => {
      const env = setup();
      env.load("/", "https://duckduckgo.com/", T0);
      env.load("/?utm_source=facebook&utm_medium=cpc", "https://l.facebook.com/", T0 + 10 * DAY);
      const details = env.details(T0 + 10 * DAY);
      expect(details).toMatchObject({ first_touch_source: "DuckDuckGo Organic", last_touch_source: "Facebook" });
      expect(details["first_touch_timestamp"]).toBe(new Date(T0).toISOString());
    });
  });

  describe("same session new arrivals", () => {
    it("lets a new external campaign visit update the last touch while the first touch stays", () => {
      const env = setup();
      env.load("/?utm_source=google&utm_medium=organic&utm_campaign=gbp", "", T0);
      env.navigate("/inventory", T0 + MINUTE);
      env.load("/?utm_source=facebook&utm_medium=paid_social&utm_campaign=retarget", "https://l.facebook.com/", T0 + 5 * MINUTE);
      expect(env.details(T0 + 6 * MINUTE)).toMatchObject({
        first_touch_utm_campaign: "gbp",
        last_touch_utm_campaign: "retarget",
        last_touch_source: "Facebook",
      });
    });

    it("does not count a reload of the same touch as a new visit", () => {
      const env = setup();
      env.load("/?utm_source=google&utm_medium=organic", "https://www.google.com/", T0);
      const before = env.stored("mc_attr_last");
      env.load("/?utm_source=google&utm_medium=organic", "https://www.google.com/", T0 + 10 * MINUTE);
      expect(env.stored("mc_attr_last")).toEqual(before);
    });

    it("refreshes the last touch for a returning visit from the same source, but never the first touch", () => {
      const env = setup();
      env.load("/", "https://www.google.com/", T0);
      env.load("/", "https://www.google.com/", T0 + 10 * DAY);
      const details = env.details(T0 + 10 * DAY);
      expect(details["first_touch_timestamp"]).toBe(new Date(T0).toISOString());
      expect(details["last_touch_timestamp"]).toBe(new Date(T0 + 10 * DAY).toISOString());
    });
  });

  describe("expiry", () => {
    it("keeps the last touch for 30 days and the first touch for 90", () => {
      const env = setup();
      env.load("/?utm_source=google&utm_medium=cpc&utm_campaign=spring", "", T0);
      expect(env.details(T0 + 29 * DAY)).toMatchObject({ last_touch_utm_campaign: "spring", first_touch_utm_campaign: "spring", lead_source: "Google Ads" });
      env.load("/", "", T0 + 31 * DAY);
      expect(env.details(T0 + 31 * DAY)).toMatchObject({
        first_touch_utm_campaign: "spring",
        last_touch_source: "Direct Traffic",
        lead_source: "Direct Traffic",
      });
    });

    it("starts a new journey once the first touch is 90 days old", () => {
      const env = setup();
      env.load("/?utm_source=google&utm_medium=cpc&utm_campaign=spring", "", T0);
      env.load("/", "", T0 + 89 * DAY);
      expect(env.details(T0 + 89 * DAY)["first_touch_utm_campaign"]).toBe("spring");
      env.load("/", "", T0 + 91 * DAY);
      const details = env.details(T0 + 91 * DAY);
      expect(details).toMatchObject({ first_touch_source: "Direct Traffic", last_touch_source: "Direct Traffic" });
      expect(details["first_touch_utm_campaign"]).toBe("");
    });

    it("reports no stale touch for a lead submitted long after the visit, then recovers on the next touch", () => {
      const env = setup();
      env.load("/?utm_source=facebook&utm_medium=cpc", "", T0);
      expect(env.details(T0 + 200 * DAY)).toMatchObject({ lead_source: "Direct Traffic", first_touch_source: "Direct Traffic" });
      env.load("/", "https://search.brave.com/", T0 + 201 * DAY);
      expect(env.details(T0 + 201 * DAY)).toMatchObject({ first_touch_source: "Brave Organic", last_touch_source: "Brave Organic" });
    });

    it("treats a touch with an unreadable or future timestamp as expired", () => {
      const env = setup();
      env.data.set("mc_attr_first", JSON.stringify({ source: "Google Ads", medium: "cpc", timestamp: "not a date" }));
      env.data.set("mc_attr_last", JSON.stringify({ source: "Google Ads", medium: "cpc", timestamp: new Date(T0 + 400 * DAY).toISOString() }));
      env.load("/", "", T0);
      expect(env.details(T0)).toMatchObject({ lead_source: "Direct Traffic", first_touch_source: "Direct Traffic" });
    });
  });

  describe("click IDs and consent", () => {
    const campaign = "/?utm_source=google&utm_medium=cpc&gclid=g1&gbraid=gb1&wbraid=wb1&fbclid=f1&ttclid=t1&msclkid=m1&li_fat_id=l1&rdt_cid=r1";

    it("stores no click ID while consent is unknown, yet still classifies the visit", () => {
      const env = setup({ analytics: "unknown", meta: "unknown" });
      env.load(campaign, "", T0);
      const details = env.details(T0);
      expect(details).toMatchObject({ lead_source: "Google Ads", channel: "paid_search" });
      for (const key of ["gclid", "gbraid", "wbraid", "fbclid", "ttclid", "msclkid", "li_fat_id", "rdt_cid"]) {
        expect(details[key], key).toBe("");
        expect(details[`first_touch_${key}`], key).toBe("");
        expect(details[`last_touch_${key}`], key).toBe("");
      }
      expect(JSON.stringify([env.stored("mc_attr_first"), env.stored("mc_attr_last")])).not.toMatch(/"(g1|gb1|wb1|f1|t1|m1|l1|r1)"/);
    });

    it("stores no click ID when consent is denied", () => {
      const env = setup({ analytics: "denied", meta: "denied" });
      env.load(campaign, "", T0);
      const details = env.details(T0);
      for (const key of ["gclid", "fbclid"]) expect(details[key]).toBe("");
    });

    it("never stores Google Ads click IDs under GA4-only consent, but still classifies the visit as Google Ads", () => {
      const env = setup({ analytics: "granted", meta: "denied" });
      env.load(campaign, "", T0);
      const details = env.details(T0);
      expect(details).toMatchObject({ gclid: "", gbraid: "", wbraid: "", fbclid: "", lead_source: "Google Ads", channel: "paid_search" });
      expect(JSON.stringify([env.stored("mc_attr_first"), env.stored("mc_attr_last")])).not.toMatch(/"(g1|gb1|wb1)"/);
    });

    it("keeps Google Ads attribution from the click ID alone when nothing is stored", () => {
      const env = setup({ analytics: "granted", meta: "granted" });
      env.load("/?gclid=g1", "", T0);
      expect(env.details(T0)).toMatchObject({ lead_source: "Google Ads", lead_medium: "cpc", channel: "paid_search", source_evidence: "confirmed", gclid: "" });
      vi.unstubAllGlobals();
      const vehicle = setup({ analytics: "granted", meta: "granted" });
      vehicle.load("/?utm_source=google&utm_campaign=vehicle_listing&gbraid=gb1", "", T0);
      expect(vehicle.details(T0)).toMatchObject({ lead_source: "Google Vehicle Ads", gbraid: "" });
    });

    it("keeps fbclid only with Meta consent", () => {
      const metaOnly = setup({ analytics: "denied", meta: "granted" });
      metaOnly.load(campaign, "", T0);
      expect(metaOnly.details(T0)).toMatchObject({ gclid: "", fbclid: "f1" });
      vi.unstubAllGlobals();
      const analyticsOnly = setup({ analytics: "granted", meta: "denied" });
      analyticsOnly.load(campaign, "", T0);
      expect(analyticsOnly.details(T0)["fbclid"]).toBe("");
    });

    it("stores only fbclid, even when everything is granted", () => {
      const env = setup({ analytics: "granted", meta: "granted" });
      env.load(campaign, "", T0);
      expect(env.details(T0)).toMatchObject({ fbclid: "f1", gclid: "", gbraid: "", wbraid: "", ttclid: "", msclkid: "", li_fat_id: "", rdt_cid: "" });
    });

    it("removes Google click IDs saved earlier under the previous rule", () => {
      const env = setup({ analytics: "granted", meta: "granted" });
      const stale = {
        source: "Google Ads", medium: "cpc", utm_source: "google", utm_medium: "cpc", utm_campaign: "", utm_content: "", utm_term: "",
        fbclid: "", gclid: "old-g", gbraid: "old-gb", wbraid: "old-wb", ttclid: "", li_fat_id: "", rdt_cid: "",
        referrer: "", landing_page: "https://mycarcorp.com/", timestamp: new Date(T0 - DAY).toISOString(),
      };
      env.data.set("mc_attr_first", JSON.stringify(stale));
      env.data.set("mc_attr_last", JSON.stringify(stale));
      // Excluded from a lead immediately, before any further capture.
      expect(env.details(T0)).toMatchObject({ gclid: "", gbraid: "", wbraid: "", first_touch_gclid: "", last_touch_gclid: "", lead_source: "Google Ads" });
      env.navigate("/contact", T0 + MINUTE);
      expect(JSON.stringify([env.stored("mc_attr_first"), env.stored("mc_attr_last")])).not.toMatch(/old-g|old-gb|old-wb/);
    });

    it("clears stored click IDs once consent is withdrawn", () => {
      const env = setup({ analytics: "granted", meta: "granted" });
      env.load(campaign, "", T0);
      expect(env.stored("mc_attr_last")?.["fbclid"]).toBe("f1");
      expect(env.stored("mc_attr_last")?.["gclid"]).toBe("");

      env.setConsent({ analytics: "granted", meta: "denied" });
      const afterMeta = env.details(T0 + MINUTE);
      expect(afterMeta).toMatchObject({ fbclid: "", last_touch_fbclid: "", first_touch_fbclid: "" });
      expect(env.stored("mc_attr_last")?.["fbclid"]).toBe("");
      expect(env.stored("mc_attr_first")?.["fbclid"]).toBe("");

      env.setConsent({ analytics: "denied", meta: "denied" });
      env.navigate("/contact", T0 + 2 * MINUTE);
      expect(env.details(T0 + 3 * MINUTE)).toMatchObject({ gclid: "", gbraid: "", wbraid: "", last_touch_gclid: "", fbclid: "" });
      // The source label stays: only the identifiers are removed.
      expect(env.details(T0 + 4 * MINUTE)).toMatchObject({ lead_source: "Google Ads" });
    });

    it("excludes click IDs from a lead even if the stored touch still holds them, until the next capture", () => {
      const env = setup({ analytics: "granted", meta: "granted" });
      env.load(campaign, "", T0);
      env.setConsent({ analytics: "denied", meta: "denied" });
      expect(env.details(T0 + MINUTE)).toMatchObject({ gclid: "", fbclid: "" });
    });

    it("keeps restricted click IDs out of lead details and the GHL payload", async () => {
      const { deliverLeadToGhl, resetGhlForwardingStateForTests } = await import("./ghl-webhook.functions");
      resetGhlForwardingStateForTests();
      const restricted = ["gclid", "gbraid", "wbraid", "ttclid", "msclkid", "li_fat_id", "rdt_cid"];
      for (const consent of [{ analytics: "granted", meta: "denied" }, { analytics: "granted", meta: "granted" }, { analytics: "unknown", meta: "unknown" }] as const) {
        const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
        const env = setup(consent);
        vi.stubGlobal("fetch", fetchMock);
        env.load(campaign, "", T0);
        const details = env.details(T0);
        for (const key of restricted) expect(details[key], key).toBe("");
        await deliverLeadToGhl({ leadType: "contact", fullName: "Synthetic Person", email: "synthetic.person@example.test", phone: "", message: "", vehicleUrl: "", vehicle: null, details });
        const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        const payload = JSON.parse(String(call[1].body)) as Record<string, unknown>;
        for (const key of restricted) expect(payload[key], key).toBe("");
        expect(JSON.stringify(payload)).not.toMatch(/"(g1|gb1|wb1|t1|m1|l1|r1)"/);
        expect(payload["fbclid"]).toBe(consent.meta === "granted" ? "f1" : "");
        expect(payload["lead_source"]).toBe("Google Ads");
        vi.unstubAllGlobals();
      }
    });

    it("keeps independent GA4 and Meta preferences independent", () => {
      const env = setup({ analytics: "denied", meta: "granted" });
      env.load("/?fbclid=f1&gclid=g1", "", T0);
      const details = env.details(T0);
      expect(details["fbclid"]).toBe("f1");
      expect(details["gclid"]).toBe("");
    });
  });

  describe("sanitizing what is stored", () => {
    it("stores the referrer origin only and a landing page with UTMs only", () => {
      const env = setup({ analytics: "granted", meta: "granted" });
      env.load(
        "/inventory?utm_source=google&utm_medium=organic&email=jane%40example.test&token=abc&fbclid=f1&gclid=g1#details",
        "https://www.google.com/search?q=jane+doe&email=jane%40example.test",
        T0,
      );
      const stored = env.stored("mc_attr_last")!;
      expect(stored["referrer"]).toBe("https://www.google.com/");
      expect(stored["landing_page"]).toBe("https://mycarcorp.com/inventory?utm_source=google&utm_medium=organic");
      const serialized = JSON.stringify([env.stored("mc_attr_first"), stored, env.details(T0)]);
      expect(serialized).not.toMatch(/jane|example\.test|token=|q=|#details/);
    });

    it("caps stored value lengths and strips control characters", () => {
      const env = setup();
      env.load(`/?utm_campaign=${"x".repeat(1000)}&utm_source=goo%00gle%0Dx&utm_medium=%07cpc`, "", T0);
      const stored = env.stored("mc_attr_last")!;
      expect(stored["utm_campaign"]!.length).toBeLessThanOrEqual(200);
      // eslint-disable-next-line no-control-regex
      for (const value of Object.values(stored)) expect(value).not.toMatch(/[\u0000-\u001f]/);
    });

    it("fails safely on malformed referrers, malformed query strings and unavailable storage", () => {
      const env = setup();
      expect(() => env.load("/?utm_source=%E0%A4%A&utm_medium=%", "not a url at all", T0)).not.toThrow();
      expect(() => env.load("/", "javascript:alert(1)", T0 + MINUTE)).not.toThrow();
      expect(() => env.load("/", "android-app://com.google.android.googlequicksearchbox", T0 + 2 * MINUTE)).not.toThrow();
      expect(() => env.details(T0 + 3 * MINUTE)).not.toThrow();

      const broken = setup();
      (window as unknown as { localStorage: unknown }).localStorage = {
        getItem: () => { throw new Error("blocked"); },
        setItem: () => { throw new Error("blocked"); },
      };
      expect(() => broken.load("/", "https://www.google.com/", T0)).not.toThrow();
      expect(() => broken.details(T0)).not.toThrow();
      expect(broken.details(T0)).toMatchObject({ lead_source: "Direct Traffic" });
    });

    it("does nothing outside the browser", () => {
      vi.unstubAllGlobals();
      vi.stubGlobal("window", undefined);
      expect(() => captureAttribution(T0)).not.toThrow();
      expect(getAttributionDetails(T0)).toEqual({});
    });
  });

  describe("older saved touches", () => {
    it("still reads touches saved before channels, msclkid and sanitizing existed", () => {
      const env = setup();
      const legacy = {
        source: "Google Organic",
        medium: "organic",
        source_evidence: "inferred",
        source_reason: "Google referrer.",
        utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "", utm_term: "",
        fbclid: "", gclid: "", gbraid: "", wbraid: "", ttclid: "", li_fat_id: "", rdt_cid: "",
        referrer: "https://www.google.com/search?q=something+private",
        landing_page: "https://mycarcorp.com/sell?email=jane%40example.test&utm_source=google&fbclid=abc#top",
        timestamp: new Date(T0 - 5 * DAY).toISOString(),
      };
      env.data.set("mc_attr_first", JSON.stringify(legacy));
      env.data.set("mc_attr_last", JSON.stringify(legacy));
      env.load("/contact", "", T0);
      const details = env.details(T0);
      expect(details).toMatchObject({
        lead_source: "Google Organic",
        channel: "organic_search",
        first_touch_channel: "organic_search",
        last_touch_channel: "organic_search",
        msclkid: "",
        referrer: "https://www.google.com/",
        landing_page: "https://mycarcorp.com/sell?utm_source=google",
        conversion_page: "https://mycarcorp.com/contact",
      });
      expect(JSON.stringify(details)).not.toMatch(/something|jane|example\.test|#top/);
    });

    it("ignores corrupt stored values", () => {
      const env = setup();
      env.data.set("mc_attr_first", "{not json");
      env.data.set("mc_attr_last", "42");
      env.load("/", "https://www.bing.com/", T0);
      expect(env.details(T0)).toMatchObject({ first_touch_source: "Bing Organic", last_touch_source: "Bing Organic" });
    });
  });
});
