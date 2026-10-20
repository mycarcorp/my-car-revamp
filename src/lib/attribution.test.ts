import { describe, expect, it } from "vitest";
import {
  buildAttributionDetails,
  classifyAttribution,
  mergeAttributionDetails,
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