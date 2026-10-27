import { describe, expect, it } from "vitest";
import {
  buildAttributionDetails,
  classifyAttribution,
  deriveChannel,
  mayStoreClickId,
  mergeAttributionDetails,
  sanitizePageUrl,
  sanitizeReferrer,
  type Touch,
} from "./attribution";

function touch(overrides: Partial<Touch> = {}): Touch {
  return {
    source: "",
    medium: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    utm_term: "",
    fbclid: "",
    gclid: "",
    gbraid: "",
    wbraid: "",
    ttclid: "",
    li_fat_id: "",
    rdt_cid: "",
    referrer: "",
    landing_page: "",
    timestamp: "2026-10-20T12:00:00.000Z",
    ...overrides,
  };
}

describe("marketing source attribution", () => {
  it("requires paid evidence before classifying Google Ads", () => {
    const paid = classifyAttribution(touch({ utm_source: "Google", utm_medium: "cpc" }));
    expect(paid).toMatchObject({ source: "Google Ads", medium: "cpc", evidence: "inferred" });
    expect(classifyAttribution(touch({ utm_source: "google" }))).toMatchObject({
      source: "Other / Unknown",
      evidence: "unknown",
    });
  });

  it("classifies Google Vehicle Ads only when vehicle campaign evidence has paid support", () => {
    expect(classifyAttribution(touch({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "vehicle_listing_campaign",
    }))).toMatchObject({ source: "Google Vehicle Ads", evidence: "inferred" });

    expect(classifyAttribution(touch({
      utm_source: "google",
      utm_campaign: "vehicle_listing_campaign",
    }))).toMatchObject({ source: "Other / Unknown", evidence: "unknown" });

    expect(classifyAttribution(touch({
      utm_source: "google",
      utm_medium: "organic",
      utm_campaign: "vehicle_listing_campaign",
    }))).toMatchObject({ source: "Google Organic", evidence: "confirmed" });
  });

  it("classifies Google Ads from a Google click ID with vehicle campaign evidence", () => {
    expect(classifyAttribution(touch({
      utm_source: "google",
      utm_campaign: "vehicle_listing_campaign",
      gclid: "google-click-id",
    }))).toMatchObject({ source: "Google Vehicle Ads", evidence: "confirmed" });
  });

  it("distinguishes Google organic from paid traffic using organic evidence", () => {
    expect(classifyAttribution(touch({ utm_source: "google", utm_medium: "organic" }))).toMatchObject({
      source: "Google Organic",
      medium: "organic",
      evidence: "confirmed",
    });
    expect(classifyAttribution(touch({ referrer: "https://www.google.com/search?q=cars" }))).toMatchObject({
      source: "Google Organic",
      evidence: "inferred",
    });
  });

  it("does not guess Facebook or Instagram from fbclid alone", () => {
    expect(classifyAttribution(touch({ fbclid: "click-id" }))).toMatchObject({
      source: "Other / Unknown",
      evidence: "unknown",
    });
  });

  it("recognizes TikTok click-ID evidence", () => {
    expect(classifyAttribution(touch({ ttclid: "click-id" }))).toMatchObject({
      source: "TikTok",
      medium: "paid",
      evidence: "confirmed",
    });
  });

  it("uses unknown confidence for direct traffic and inferred confidence for referrals", () => {
    expect(classifyAttribution(touch())).toMatchObject({ source: "Direct Traffic", evidence: "unknown" });
    expect(classifyAttribution(touch({ referrer: "https://example.com/cars" }))).toMatchObject({
      source: "Referral Websites",
      medium: "referral",
      evidence: "inferred",
    });
  });

  it("preserves raw first- and last-touch values in lead details", () => {
    const first = touch({
      source: "Google Organic",
      medium: "organic",
      source_evidence: "inferred",
      source_reason: "Google referrer.",
      utm_source: "Google",
      referrer: "https://google.com/",
      landing_page: "https://mycarcorp.com/",
    });
    const last = touch({
      source: "TikTok",
      medium: "paid",
      source_evidence: "confirmed",
      source_reason: "TikTok click ID is present.",
      utm_source: "TikTok",
      ttclid: "raw-click-id",
      landing_page: "https://mycarcorp.com/sell",
    });
    const details = buildAttributionDetails(first, last, "https://mycarcorp.com/sell");

    expect(details).toMatchObject({
      first_touch_source: "Google Organic",
      first_touch_utm_source: "Google",
      first_touch_referrer: "https://google.com/",
      last_touch_source: "TikTok",
      last_touch_ttclid: "raw-click-id",
      lead_source: "TikTok",
      source_evidence: "confirmed",
      landing_page: "https://mycarcorp.com/",
      conversion_page: "https://mycarcorp.com/sell",
    });
  });

  it("keeps Sell/Trade intent while assigning marketing source from attribution", () => {
    const attribution = buildAttributionDetails(
      null,
      touch({ source: "Google Ads", medium: "cpc", source_evidence: "confirmed" }),
      "/sell",
    );
    const details = mergeAttributionDetails(
      { intent: "trade", lead_type: "trade", lead_page: "/sell" },
      attribution,
    );

    expect(details).toMatchObject({
      intent: "trade",
      lead_type: "trade",
      lead_page: "/sell",
      lead_source: "Google Ads",
    });
  });
});

describe("organic search engine classification", () => {
  const cases: Array<[string, string]> = [
    ["https://www.bing.com/search?q=used+cars", "Bing Organic"],
    ["https://cn.bing.com/", "Bing Organic"],
    ["https://search.yahoo.com/search?p=cars", "Yahoo Organic"],
    ["https://uk.search.yahoo.com/", "Yahoo Organic"],
    ["https://duckduckgo.com/", "DuckDuckGo Organic"],
    ["https://html.duckduckgo.com/html", "DuckDuckGo Organic"],
    ["https://search.brave.com/search?q=x", "Brave Organic"],
    ["https://www.ecosia.org/search?q=x", "Ecosia Organic"],
    ["https://www.google.com/", "Google Organic"],
    ["https://www.google.co.uk/", "Google Organic"],
    ["https://www.google.com.au/", "Google Organic"],
  ];
  it.each(cases)("classifies the %s referrer as %s organic search", (referrer, source) => {
    expect(classifyAttribution(touch({ referrer }))).toMatchObject({ source, medium: "organic", channel: "organic_search", evidence: "inferred" });
  });

  it("confirms an engine from an explicit organic utm_source and medium", () => {
    for (const [utm, label] of [["bing", "Bing Organic"], ["yahoo", "Yahoo Organic"], ["duckduckgo", "DuckDuckGo Organic"], ["brave", "Brave Organic"], ["ecosia", "Ecosia Organic"]]) {
      expect(classifyAttribution(touch({ utm_source: utm, utm_medium: "organic" }))).toMatchObject({ source: label, channel: "organic_search", evidence: "confirmed" });
    }
  });

  it("does not treat look-alike or unrelated hosts as search engines", () => {
    for (const referrer of ["https://notbing.com/", "https://bing.com.evil.example/", "https://yahoo.com/", "https://mail.yahoo.com/", "https://brave.com/", "https://duckduckgo.example/", "https://ecosia.org.example/"]) {
      expect(classifyAttribution(touch({ referrer })), referrer).toMatchObject({ source: "Referral Websites", channel: "referral" });
    }
  });

  it("classifies Microsoft Ads from a click ID or paid medium, never from the organic referrer", () => {
    expect(classifyAttribution(touch({ msclkid: "abc" }))).toMatchObject({ source: "Microsoft Ads", channel: "paid_search", evidence: "confirmed" });
    expect(classifyAttribution(touch({ utm_source: "bing", utm_medium: "cpc" }))).toMatchObject({ source: "Microsoft Ads", channel: "paid_search", evidence: "inferred" });
    expect(classifyAttribution(touch({ utm_source: "bing", utm_medium: "cpc", msclkid: "abc" }))).toMatchObject({ source: "Microsoft Ads", evidence: "confirmed" });
    expect(classifyAttribution(touch({ referrer: "https://www.bing.com/" }))).toMatchObject({ source: "Bing Organic" });
  });
});

describe("AI assistant classification", () => {
  const cases: Array<[string, string]> = [
    ["https://chatgpt.com/", "ChatGPT"],
    ["https://chat.openai.com/", "ChatGPT"],
    ["https://www.perplexity.ai/search", "Perplexity"],
    ["https://gemini.google.com/app", "Gemini"],
    ["https://copilot.microsoft.com/", "Copilot"],
    ["https://claude.ai/chat/1", "Claude"],
  ];
  it.each(cases)("classifies the %s referrer as %s", (referrer, source) => {
    expect(classifyAttribution(touch({ referrer }))).toMatchObject({ source, medium: "ai_referral", channel: "ai_assistant", evidence: "inferred" });
  });

  it("confirms an assistant from utm_source, including the chatgpt.com value ChatGPT appends", () => {
    for (const [utm, label] of [["chatgpt.com", "ChatGPT"], ["ChatGPT", "ChatGPT"], ["perplexity", "Perplexity"], ["perplexity.ai", "Perplexity"], ["gemini", "Gemini"], ["copilot", "Copilot"], ["claude", "Claude"]]) {
      expect(classifyAttribution(touch({ utm_source: utm }))).toMatchObject({ source: label, channel: "ai_assistant", evidence: "confirmed" });
    }
  });

  it("does not match look-alike AI hosts", () => {
    for (const referrer of ["https://chatgpt.com.evil.example/", "https://notclaude.ai/", "https://myperplexity.ai/", "https://openai.com/"]) {
      expect(classifyAttribution(touch({ referrer })), referrer).toMatchObject({ source: "Referral Websites" });
    }
  });
});

describe("Google properties that are not Search", () => {
  it("never reports Gmail, Docs, Maps, Drive or accounts as Google Organic", () => {
    for (const host of ["mail.google.com", "docs.google.com", "maps.google.com", "drive.google.com", "accounts.google.com", "news.google.com", "google.com.evil.example", "notgoogle.com"]) {
      const result = classifyAttribution(touch({ referrer: `https://${host}/` }));
      expect(result.source, host).toBe("Referral Websites");
      expect(result.channel, host).toBe("referral");
    }
  });

  it("does not use a non-search Google referrer as organic evidence for utm_source=google", () => {
    expect(classifyAttribution(touch({ utm_source: "google", referrer: "https://mail.google.com/" }))).toMatchObject({ source: "Other / Unknown" });
    expect(classifyAttribution(touch({ utm_source: "google", referrer: "https://www.google.com/" }))).toMatchObject({ source: "Google Organic" });
  });
});

describe("social channel evidence", () => {
  it("calls social paid only when a paid UTM medium or a platform click ID proves it", () => {
    expect(classifyAttribution(touch({ utm_source: "facebook", utm_medium: "paid_social" }))).toMatchObject({ source: "Facebook", channel: "paid_social" });
    expect(classifyAttribution(touch({ utm_source: "instagram", utm_medium: "cpc" }))).toMatchObject({ source: "Instagram", channel: "paid_social" });
    expect(classifyAttribution(touch({ ttclid: "x" }))).toMatchObject({ source: "TikTok", channel: "paid_social" });
  });

  it("keeps organic social and unspecified social apart from paid", () => {
    expect(classifyAttribution(touch({ referrer: "https://l.facebook.com/" }))).toMatchObject({ source: "Facebook", channel: "organic_social" });
    expect(classifyAttribution(touch({ referrer: "https://l.instagram.com/" }))).toMatchObject({ source: "Instagram", channel: "organic_social" });
    expect(classifyAttribution(touch({ utm_source: "facebook", utm_medium: "social" }))).toMatchObject({ channel: "organic_social" });
    expect(classifyAttribution(touch({ utm_source: "facebook" }))).toMatchObject({ channel: "social" });
  });

  it("never treats fbclid alone, or fbclid with a Facebook referrer, as paid", () => {
    expect(classifyAttribution(touch({ fbclid: "x" }))).toMatchObject({ source: "Other / Unknown", channel: "unknown" });
    expect(classifyAttribution(touch({ fbclid: "x", referrer: "https://l.facebook.com/" }))).toMatchObject({ source: "Facebook", channel: "organic_social" });
  });
});

describe("paid medium matching", () => {
  it("matches whole recognized tokens only", () => {
    for (const medium of ["cpc", "CPC", "ppc", "paid", "paid_social", "paid-search", "display", "cpc_brand", "ads", "social_paid"]) {
      expect(classifyAttribution(touch({ utm_source: "google", utm_medium: medium })).source, medium).toBe("Google Ads");
    }
  });

  it("does not match substrings such as leads, downloads or headlines", () => {
    for (const medium of ["newsletter_leads", "downloads", "headlines", "roadshow", "uploads", "adsorption", "dispaid"]) {
      expect(classifyAttribution(touch({ utm_source: "google", utm_medium: medium })).source, medium).toBe("Other / Unknown");
    }
  });

  it("labels email media as the email channel without changing the source label", () => {
    expect(classifyAttribution(touch({ utm_source: "ghl", utm_medium: "email" }))).toMatchObject({ source: "Other / Unknown", channel: "email" });
  });
});

describe("existing classifications are preserved with a channel", () => {
  it("keeps labels for Google, direct and referral", () => {
    expect(classifyAttribution(touch({ utm_source: "google", utm_medium: "cpc" }))).toMatchObject({ source: "Google Ads", channel: "paid_search" });
    expect(classifyAttribution(touch({ utm_source: "google", utm_medium: "organic" }))).toMatchObject({ source: "Google Organic", channel: "organic_search" });
    expect(classifyAttribution(touch())).toMatchObject({ source: "Direct Traffic", channel: "direct" });
    expect(classifyAttribution(touch({ referrer: "https://example.com/cars" }))).toMatchObject({ source: "Referral Websites", channel: "referral" });
    expect(classifyAttribution(touch({ gclid: "x" }))).toMatchObject({ source: "Google Ads", channel: "paid_search" });
  });

  it("derives a channel for touches saved before channels existed", () => {
    expect(deriveChannel("Google Organic", "organic")).toBe("organic_search");
    expect(deriveChannel("Google Ads", "cpc")).toBe("paid_search");
    expect(deriveChannel("Facebook", "paid")).toBe("paid_social");
    expect(deriveChannel("Facebook", "social")).toBe("organic_social");
    expect(deriveChannel("Direct Traffic", "none")).toBe("direct");
    expect(deriveChannel("Referral Websites", "referral")).toBe("referral");
    expect(deriveChannel("Other / Unknown", "unknown")).toBe("unknown");
    expect(deriveChannel("", "")).toBe("unknown");
  });
});

describe("URL sanitizing", () => {
  it("reduces a referrer to its origin", () => {
    expect(sanitizeReferrer("https://www.example.com/path/page?email=a%40b.c&token=abc#frag")).toBe("https://www.example.com/");
    expect(sanitizeReferrer("https://user:pass@example.com:8443/x?y=1")).toBe("https://example.com:8443/");
    expect(sanitizeReferrer("http://example.com/a")).toBe("http://example.com/");
  });

  it("drops malformed, non-web and empty referrers safely", () => {
    for (const value of ["", "not a url", "javascript:alert(1)", "android-app://com.google.android.googlequicksearchbox", "ftp://example.com/", "//example.com", undefined, null, 7, {}]) {
      expect(sanitizeReferrer(value), String(value)).toBe("");
    }
  });

  it("keeps only UTM parameters on page URLs and removes fragments, credentials and click IDs", () => {
    expect(sanitizePageUrl("https://user:pw@mycarcorp.com/contact?utm_source=google&utm_medium=organic&email=a%40b.c&gclid=abc&fbclid=x&token=1#section"))
      .toBe("https://mycarcorp.com/contact?utm_source=google&utm_medium=organic");
    expect(sanitizePageUrl("https://mycarcorp.com/")).toBe("https://mycarcorp.com/");
    expect(sanitizePageUrl("https://mycarcorp.com/search?make=honda&year=2019")).toBe("https://mycarcorp.com/search");
  });

  it("strips control characters, caps lengths and fails safely on bad input", () => {
    const url = sanitizePageUrl(`https://mycarcorp.com/?utm_campaign=${"a".repeat(500)}%07b`);
    expect(url.length).toBeLessThan(300);
    // eslint-disable-next-line no-control-regex
    expect(url).not.toMatch(/[\u0000-\u001f]/);
    for (const value of ["", "garbage", "javascript:alert(1)", "data:text/html,x", null, undefined, 4]) expect(sanitizePageUrl(value)).toBe("");
  });

  it("redacts VIN-like path segments", () => {
    expect(sanitizePageUrl("https://mycarcorp.com/inventory/1HGCM82633A004352")).not.toContain("1HGCM82633A004352");
  });

  it("sanitizes old stored touches and the conversion page when building lead details", () => {
    const old = touch({
      source: "Google Organic",
      medium: "organic",
      referrer: "https://www.google.com/search?q=private+name&email=a%40b.c",
      landing_page: "https://mycarcorp.com/?email=a%40b.c&utm_source=google&fbclid=abc#x",
    });
    const details = buildAttributionDetails(old, old, "https://mycarcorp.com/contact?phone=5555550100&utm_medium=organic#top");
    expect(details["referrer"]).toBe("https://www.google.com/");
    expect(details["landing_page"]).toBe("https://mycarcorp.com/?utm_source=google");
    expect(details["conversion_page"]).toBe("https://mycarcorp.com/contact?utm_medium=organic");
    expect(JSON.stringify(details)).not.toMatch(/a%40b|5555550100|private\+name|#/);
  });
});

describe("lead detail channel fields", () => {
  it("adds channel, first_touch_channel and last_touch_channel, deriving them for older records", () => {
    const first = touch({ source: "Google Organic", medium: "organic" }); // saved before channels existed
    const last = touch({ source: "ChatGPT", medium: "ai_referral", channel: "ai_assistant", msclkid: "m1" });
    const details = buildAttributionDetails(first, last, "https://mycarcorp.com/contact");
    expect(details).toMatchObject({
      channel: "ai_assistant",
      first_touch_channel: "organic_search",
      last_touch_channel: "ai_assistant",
      lead_source: "ChatGPT",
      msclkid: "m1",
    });
  });

  it("defaults to direct when there is no stored touch", () => {
    expect(buildAttributionDetails(null, null, "https://mycarcorp.com/")).toMatchObject({ channel: "direct", lead_source: "Direct Traffic" });
  });
});

describe("click ID consent mapping", () => {
  it("allows only fbclid, and only with Meta consent", () => {
    expect(mayStoreClickId("fbclid", { analytics: "denied", meta: "granted" })).toBe(true);
    expect(mayStoreClickId("fbclid", { analytics: "granted", meta: "granted" })).toBe(true);
    expect(mayStoreClickId("fbclid", { analytics: "granted", meta: "denied" })).toBe(false);
    expect(mayStoreClickId("fbclid", { analytics: "granted", meta: "unknown" })).toBe(false);
  });

  it("never allows Google Ads click IDs, even with GA4 and Meta consent granted", () => {
    for (const key of ["gclid", "gbraid", "wbraid"]) {
      for (const analytics of ["granted", "denied", "unknown"] as const) {
        for (const meta of ["granted", "denied", "unknown"] as const) expect(mayStoreClickId(key, { analytics, meta }), key).toBe(false);
      }
    }
  });

  it("never stores click IDs that have no consent category", () => {
    const all = { analytics: "granted", meta: "granted" } as const;
    for (const key of ["msclkid", "ttclid", "li_fat_id", "rdt_cid", "other", ""]) expect(mayStoreClickId(key, all), key).toBe(false);
  });
});
