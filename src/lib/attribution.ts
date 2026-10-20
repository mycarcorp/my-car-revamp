/**
 * Lead-source attribution. Captures first-touch and last-touch data in
 * localStorage (browser only) and exposes flat fields to merge into lead details.
 */

const FIRST_KEY = "mc_attr_first";
const LAST_KEY = "mc_attr_last";
const SESSION_KEY = "mc_attr_session";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const CLICK_KEYS = ["fbclid", "gclid", "gbraid", "wbraid", "ttclid", "li_fat_id", "rdt_cid"] as const;

export type Touch = {
  source: string;
  medium: string;
  source_evidence?: AttributionEvidence;
  source_reason?: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  fbclid: string;
  gclid: string;
  gbraid: string;
  wbraid: string;
  ttclid: string;
  li_fat_id: string;
  rdt_cid: string;
  referrer: string;
  landing_page: string;
  timestamp: string;
};

export type AttributionEvidence = "confirmed" | "inferred" | "unknown";

export type SourceClassification = {
  source: string;
  medium: string;
  evidence: AttributionEvidence;
  reason: string;
};

type AttributionInput = Pick<
  Touch,
  | "utm_source"
  | "utm_medium"
  | "utm_campaign"
  | "utm_content"
  | "utm_term"
  | "fbclid"
  | "gclid"
  | "gbraid"
  | "wbraid"
  | "ttclid"
  | "li_fat_id"
  | "rdt_cid"
  | "referrer"
>;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Normalize one touch without discarding its original UTM or click-ID fields. */
export function classifyAttribution(t: AttributionInput): SourceClassification {
  const source = t.utm_source.trim().toLowerCase();
  const medium = t.utm_medium.trim().toLowerCase();
  const campaign = t.utm_campaign.trim().toLowerCase();
  const content = t.utm_content.trim().toLowerCase();
  const referrer = hostOf(t.referrer);
  const paidMedium = /(cpc|ppc|paid|ads?|display|cpm|social_paid|paid_social)/.test(medium);
  const paidGoogleClick = Boolean(t.gclid || t.gbraid || t.wbraid);
  const vehicleAd = /(vla|vehicle[_ -]?ads?|vehicle[_ -]?listing)/.test(
    `${source} ${medium} ${campaign} ${content}`,
  );
  const result = (
    normalizedSource: string,
    normalizedMedium: string,
    evidence: AttributionEvidence,
    reason: string,
  ): SourceClassification => ({
    source: normalizedSource,
    medium: normalizedMedium,
    evidence,
    reason,
  });
  const namedMetaSource = (value: string) => {
    const instagram = /instagram|(^|[^a-z])ig([^a-z]|$)/.test(value);
    const facebook = /facebook|(^|[^a-z])fb([^a-z]|$)/.test(value);
    if (instagram !== facebook) return instagram ? "Instagram" : "Facebook";
    return null;
  };

  if (/^(facebook|fb)$/.test(source)) {
    return result("Facebook", medium || "social", "confirmed", "Explicit utm_source identifies Facebook.");
  }
  if (/^(instagram|ig)$/.test(source)) {
    return result("Instagram", medium || "social", "confirmed", "Explicit utm_source identifies Instagram.");
  }
  if (source === "meta") {
    const platform = namedMetaSource(`${campaign} ${content}`);
    return platform
      ? result(platform, medium || "social", "inferred", "Meta source is disambiguated by campaign or content text.")
      : result("Other / Unknown", medium || "unknown", "unknown", "Meta source does not distinguish Facebook from Instagram.");
  }
  if (source === "google") {
    if (vehicleAd && (paidGoogleClick || paidMedium)) {
      return result(
        "Google Vehicle Ads",
        medium || "cpc",
        paidGoogleClick ? "confirmed" : "inferred",
        paidGoogleClick
          ? "Google Ads click ID and vehicle-ad campaign evidence are present."
          : "Google source has a paid medium and vehicle-ad campaign evidence.",
      );
    }
    if (paidGoogleClick) return result("Google Ads", medium || "cpc", "confirmed", "Google Ads click ID is present.");
    if (paidMedium) return result("Google Ads", medium, "inferred", "Google source has a paid medium tag.");
    if (/^(organic|seo)$/.test(medium)) return result("Google Organic", medium, "confirmed", "Google source has an explicit organic medium.");
    if (/(^|\.)google\./.test(referrer)) return result("Google Organic", "organic", "inferred", "External Google referrer without paid-click evidence.");
    return result("Other / Unknown", medium || "unknown", "unknown", "Google source lacks evidence to distinguish paid from organic.");
  }
  if (source === "tiktok") return result("TikTok", medium || "social", "confirmed", "Explicit utm_source identifies TikTok.");
  if (source === "linkedin") return result("LinkedIn", medium || "social", "confirmed", "Explicit utm_source identifies LinkedIn.");
  if (source === "reddit") return result("Reddit", medium || "social", "confirmed", "Explicit utm_source identifies Reddit.");
  if (source) return result("Other / Unknown", medium || "unknown", "unknown", "Unrecognized utm_source; the original value remains available in utm_source.");

  if (paidGoogleClick) return result("Google Ads", "cpc", "confirmed", "Google Ads click ID is present.");
  if (t.ttclid) return result("TikTok", "paid", "confirmed", "TikTok click ID is present.");
  if (t.li_fat_id) return result("LinkedIn", "paid", "confirmed", "LinkedIn click ID is present.");
  if (t.rdt_cid) return result("Reddit", "paid", "confirmed", "Reddit click ID is present.");
  const referrerMeta = namedMetaSource(referrer);
  if (referrerMeta) return result(referrerMeta, "social", "inferred", "External referrer identifies a social platform.");
  if (/^tiktok\.com$/.test(referrer)) return result("TikTok", "social", "inferred", "External referrer identifies TikTok.");
  if (/(^|\.)google\./.test(referrer)) return result("Google Organic", "organic", "inferred", "Google referrer without paid-click evidence.");
  if (referrer) return result("Referral Websites", "referral", "inferred", "An external referrer was recorded.");
  if (t.fbclid) return result("Other / Unknown", "unknown", "unknown", "fbclid is shared by Facebook and Instagram.");
  if (t.utm_medium || t.utm_campaign || t.utm_content || t.utm_term) {
    return result("Other / Unknown", medium || "unknown", "unknown", "UTM values are present without a source.");
  }
  return result("Direct Traffic", "none", "unknown", "No campaign, click ID, or external referrer was recorded.");
}

/** Backward-compatible source/medium helper for existing callers. */
export function classifySource(t: AttributionInput): Pick<SourceClassification, "source" | "medium"> {
  const { source, medium } = classifyAttribution(t);
  return { source, medium };
}

export function buildAttributionDetails(
  first: Touch | null,
  last: Touch | null,
  conversionPage: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  const add = (prefix: string, touch: Touch | null) => {
    if (!touch) return;
    for (const [key, value] of Object.entries(touch)) out[`${prefix}_${key}`] = String(value ?? "");
  };
  add("first_touch", first);
  add("last_touch", last);
  const current = last ?? first;
  out["lead_source"] = current?.source ?? "Direct Traffic";
  out["lead_medium"] = current?.medium ?? "none";
  out["source_evidence"] = current?.source_evidence ?? "unknown";
  out["source_reason"] = current?.source_reason ?? "No saved attribution touch was available.";
  for (const key of [...UTM_KEYS, ...CLICK_KEYS]) out[key] = current?.[key] ?? "";
  out["referrer"] = current?.referrer ?? "";
  out["landing_page"] = first?.landing_page ?? current?.landing_page ?? "";
  out["conversion_page"] = conversionPage;
  return out;
}

export function mergeAttributionDetails<T extends Record<string, unknown>>(
  details: T,
  attribution: Record<string, string>,
): T & Record<string, unknown> {
  const merged: Record<string, unknown> = { ...details };
  for (const [key, value] of Object.entries(attribution)) {
    if (merged[key] === undefined) merged[key] = value;
  }
  return merged as T & Record<string, unknown>;
}

function read(key: string): Touch | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Touch) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: Touch) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

/** Call on every page view; safe to call repeatedly. */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const rawRef = document.referrer || "";
  const ownHost = window.location.hostname.replace(/^www\./, "");
  const externalRef = rawRef && hostOf(rawRef) !== ownHost ? rawRef : "";

  const base = {
    utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "", utm_term: "",
    fbclid: "", gclid: "", gbraid: "", wbraid: "", ttclid: "", li_fat_id: "", rdt_cid: "",
    referrer: externalRef,
    landing_page: window.location.href,
  };
  for (const k of [...UTM_KEYS, ...CLICK_KEYS]) base[k] = (params.get(k) ?? "").slice(0, 500);

  const hasSignal = UTM_KEYS.some((k) => base[k]) || CLICK_KEYS.some((k) => base[k]) || !!externalRef;
  let newSession = false;
  try {
    newSession = !window.sessionStorage.getItem(SESSION_KEY);
    window.sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }

  const first = read(FIRST_KEY);
  const last = read(LAST_KEY);
  // New touch when campaign signals appear, or a fresh session starts.
  if (!hasSignal && first && last) return; // internal navigation / direct return visit

  const classification = classifyAttribution(base);
  const touch: Touch = {
    ...base,
    source: classification.source,
    medium: classification.medium,
    source_evidence: classification.evidence,
    source_reason: classification.reason,
    timestamp: new Date().toISOString(),
  };
  if (!first) write(FIRST_KEY, touch);
  // A Direct visit never overwrites a known campaign last touch.
  if (!last || hasSignal) write(LAST_KEY, touch);
  void newSession;
}

/** Flat attribution fields to merge into a lead's details. */
export function getAttributionDetails(): Record<string, string> {
  if (typeof window === "undefined") return {};
  captureAttribution();
  const first = read(FIRST_KEY);
  const last = read(LAST_KEY) ?? first;
  return buildAttributionDetails(first, last, window.location.href);
}
