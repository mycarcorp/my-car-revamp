/**
 * Lead-source attribution. Captures first-touch and last-touch data in
 * localStorage (browser only) and exposes flat fields to merge into lead details.
 *
 * Touch policy: the first touch is kept for 90 days and the last touch for 30 days. A visit with no
 * campaign or referrer signal never replaces a known touch, and in-site navigation is never a touch.
 * Only sanitized values are stored: referrers are reduced to their origin, landing pages keep only UTM
 * parameters, and the only advertising click ID kept is fbclid, and only while Meta consent is granted.
 */
import { getTrackingConsentPreferences, sanitizePagePath, type TrackingConsentPreferences } from "./analytics";

const FIRST_KEY = "mc_attr_first";
const LAST_KEY = "mc_attr_last";

export const FIRST_TOUCH_WINDOW_DAYS = 90;
export const LAST_TOUCH_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
/** The same touch seen again inside this window (reload, duplicate call) is not a new visit. */
const SAME_VISIT_MS = 30 * 60 * 1000;

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const CLICK_KEYS = ["fbclid", "gclid", "gbraid", "wbraid", "ttclid", "li_fat_id", "rdt_cid", "msclkid"] as const;
const MAX_VALUE = 200;
const MAX_PATH = 300;

export type AttributionChannel =
  | "organic_search"
  | "paid_search"
  | "organic_social"
  | "paid_social"
  | "social"
  | "ai_assistant"
  | "email"
  | "referral"
  | "direct"
  | "unknown";

export type Touch = {
  source: string;
  medium: string;
  channel?: string;
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
  msclkid?: string;
  referrer: string;
  landing_page: string;
  timestamp: string;
};

export type AttributionEvidence = "confirmed" | "inferred" | "unknown";

export type SourceClassification = {
  source: string;
  medium: string;
  channel: AttributionChannel;
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
> &
  Partial<Pick<Touch, "msclkid">>;

/* -------------------------------------------------------------------------- */
/* URL and value sanitizing                                                    */
/* -------------------------------------------------------------------------- */

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function cleanValue(value: unknown, max = MAX_VALUE): string {
  if (typeof value !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

/** A referrer is kept as its origin only (https://host/). Paths, queries, fragments and credentials are dropped. */
export function sanitizeReferrer(raw: unknown): string {
  const text = cleanValue(raw, 2048);
  if (!text) return "";
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    if (!url.hostname) return "";
    return `${url.protocol}//${url.host}/`;
  } catch {
    return "";
  }
}

/** Page URLs keep their origin, a redacted path and only the UTM parameters. Click IDs and everything else are dropped. */
export function sanitizePageUrl(raw: unknown): string {
  const text = cleanValue(raw, 4096);
  if (!text) return "";
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    const kept = new URLSearchParams();
    for (const key of UTM_KEYS) {
      const value = cleanValue(url.searchParams.get(key));
      if (value) kept.set(key, value);
    }
    const query = kept.toString();
    return `${url.origin}${sanitizePagePath(url.pathname).slice(0, MAX_PATH)}${query ? `?${query}` : ""}`;
  } catch {
    return "";
  }
}

/* -------------------------------------------------------------------------- */
/* Classification                                                              */
/* -------------------------------------------------------------------------- */

const hostIs = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);
/** Google Search only: google.com and country domains, never mail/docs/gemini subdomains. */
const GOOGLE_SEARCH_HOST = /^google\.(?:com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/;

const SEARCH_ENGINES = [
  { label: "Bing Organic", utm: ["bing"], host: (h: string) => hostIs(h, "bing.com") },
  { label: "Yahoo Organic", utm: ["yahoo"], host: (h: string) => hostIs(h, "search.yahoo.com") },
  { label: "DuckDuckGo Organic", utm: ["duckduckgo", "duckduckgo.com"], host: (h: string) => hostIs(h, "duckduckgo.com") },
  { label: "Brave Organic", utm: ["brave"], host: (h: string) => h === "search.brave.com" },
  { label: "Ecosia Organic", utm: ["ecosia", "ecosia.org"], host: (h: string) => hostIs(h, "ecosia.org") },
] as const;

const AI_ASSISTANTS = [
  { label: "ChatGPT", utm: ["chatgpt", "chatgpt.com", "openai"], host: (h: string) => hostIs(h, "chatgpt.com") || h === "chat.openai.com" },
  { label: "Perplexity", utm: ["perplexity", "perplexity.ai"], host: (h: string) => hostIs(h, "perplexity.ai") },
  { label: "Gemini", utm: ["gemini", "gemini.google.com"], host: (h: string) => h === "gemini.google.com" || h === "bard.google.com" },
  { label: "Copilot", utm: ["copilot", "copilot.microsoft.com"], host: (h: string) => h === "copilot.microsoft.com" },
  { label: "Claude", utm: ["claude", "claude.ai"], host: (h: string) => hostIs(h, "claude.ai") },
] as const;

const PAID_MEDIUM_TOKENS = new Set(["cpc", "ppc", "cpm", "cpv", "paid", "paidsearch", "paidsocial", "display", "ad", "ads"]);
const ORGANIC_SOCIAL_MEDIUMS = new Set(["social", "organic", "organic_social", "social_organic", "organic-social", "social-organic"]);

/** Paid mediums are whole tokens (split on anything that is not a letter or digit), so "leads" or "downloads" never count. */
function isPaidMedium(medium: string): boolean {
  return medium.split(/[^a-z0-9]+/).some((token) => PAID_MEDIUM_TOKENS.has(token));
}

function isEmailMedium(medium: string): boolean {
  return /^e-?mail$/.test(medium);
}

/** Channel for a source label saved before channels existed. */
export function deriveChannel(source: string, medium: string): AttributionChannel {
  const label = source.trim().toLowerCase();
  const m = medium.trim().toLowerCase();
  if (label === "direct traffic" || label === "direct") return "direct";
  if (["google ads", "google vehicle ads", "microsoft ads"].includes(label)) return "paid_search";
  if (label.endsWith(" organic")) return "organic_search";
  if (AI_ASSISTANTS.some((assistant) => assistant.label.toLowerCase() === label)) return "ai_assistant";
  if (label === "referral websites") return "referral";
  if (["facebook", "instagram", "tiktok", "linkedin", "reddit"].includes(label)) {
    if (isPaidMedium(m)) return "paid_social";
    return ORGANIC_SOCIAL_MEDIUMS.has(m) ? "organic_social" : "social";
  }
  return isEmailMedium(m) ? "email" : "unknown";
}

/** Normalize one touch without discarding its original UTM or click-ID fields. */
export function classifyAttribution(t: AttributionInput): SourceClassification {
  const source = t.utm_source.trim().toLowerCase();
  const medium = t.utm_medium.trim().toLowerCase();
  const campaign = t.utm_campaign.trim().toLowerCase();
  const content = t.utm_content.trim().toLowerCase();
  const referrer = hostOf(t.referrer);
  const paidMedium = isPaidMedium(medium);
  const paidGoogleClick = Boolean(t.gclid || t.gbraid || t.wbraid);
  const vehicleAd = /(vla|vehicle[_ -]?ads?|vehicle[_ -]?listing)/.test(
    `${source} ${medium} ${campaign} ${content}`,
  );
  const result = (
    normalizedSource: string,
    normalizedMedium: string,
    evidence: AttributionEvidence,
    reason: string,
    channel: AttributionChannel,
  ): SourceClassification => ({
    source: normalizedSource,
    medium: normalizedMedium,
    channel,
    evidence,
    reason,
  });
  const namedMetaSource = (value: string) => {
    const instagram = /instagram|(^|[^a-z])ig([^a-z]|$)/.test(value);
    const facebook = /facebook|(^|[^a-z])fb([^a-z]|$)/.test(value);
    if (instagram !== facebook) return instagram ? "Instagram" : "Facebook";
    return null;
  };
  /** Paid social needs a paid UTM medium; a bare click ID or social referrer is never proof of an ad. */
  const socialChannel = (): AttributionChannel =>
    paidMedium ? "paid_social" : ORGANIC_SOCIAL_MEDIUMS.has(medium) ? "organic_social" : "social";

  if (/^(facebook|fb)$/.test(source)) {
    return result("Facebook", medium || "social", "confirmed", "Explicit utm_source identifies Facebook.", socialChannel());
  }
  if (/^(instagram|ig)$/.test(source)) {
    return result("Instagram", medium || "social", "confirmed", "Explicit utm_source identifies Instagram.", socialChannel());
  }
  if (source === "meta") {
    const platform = namedMetaSource(`${campaign} ${content}`);
    return platform
      ? result(platform, medium || "social", "inferred", "Meta source is disambiguated by campaign or content text.", socialChannel())
      : result("Other / Unknown", medium || "unknown", "unknown", "Meta source does not distinguish Facebook from Instagram.", "unknown");
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
        "paid_search",
      );
    }
    if (paidGoogleClick) return result("Google Ads", medium || "cpc", "confirmed", "Google Ads click ID is present.", "paid_search");
    if (paidMedium) return result("Google Ads", medium, "inferred", "Google source has a paid medium tag.", "paid_search");
    if (/^(organic|seo)$/.test(medium)) return result("Google Organic", medium, "confirmed", "Google source has an explicit organic medium.", "organic_search");
    if (GOOGLE_SEARCH_HOST.test(referrer)) return result("Google Organic", "organic", "inferred", "External Google Search referrer without paid-click evidence.", "organic_search");
    return result("Other / Unknown", medium || "unknown", "unknown", "Google source lacks evidence to distinguish paid from organic.", "unknown");
  }
  if (source === "tiktok") return result("TikTok", medium || "social", "confirmed", "Explicit utm_source identifies TikTok.", t.ttclid ? "paid_social" : socialChannel());
  if (source === "linkedin") return result("LinkedIn", medium || "social", "confirmed", "Explicit utm_source identifies LinkedIn.", t.li_fat_id ? "paid_social" : socialChannel());
  if (source === "reddit") return result("Reddit", medium || "social", "confirmed", "Explicit utm_source identifies Reddit.", t.rdt_cid ? "paid_social" : socialChannel());

  const aiBySource = AI_ASSISTANTS.find((assistant) => (assistant.utm as readonly string[]).includes(source));
  if (aiBySource) {
    return result(aiBySource.label, medium || "ai_referral", "confirmed", `Explicit utm_source identifies ${aiBySource.label}.`, "ai_assistant");
  }
  if (source === "bing" || source === "microsoft") {
    if (t.msclkid) return result("Microsoft Ads", medium || "cpc", "confirmed", "Microsoft Ads click ID is present.", "paid_search");
    if (paidMedium) return result("Microsoft Ads", medium, "inferred", "Microsoft source has a paid medium tag.", "paid_search");
  }
  const engineBySource = SEARCH_ENGINES.find((engine) => (engine.utm as readonly string[]).includes(source));
  if (engineBySource && /^(organic|seo)$/.test(medium)) {
    return result(engineBySource.label, medium, "confirmed", `${engineBySource.label} source has an explicit organic medium.`, "organic_search");
  }
  if (engineBySource && !paidMedium && engineBySource.host(referrer)) {
    return result(engineBySource.label, "organic", "inferred", `External ${engineBySource.label} referrer without paid evidence.`, "organic_search");
  }
  if (source) {
    return result("Other / Unknown", medium || "unknown", "unknown", "Unrecognized utm_source; the original value remains available in utm_source.", isEmailMedium(medium) ? "email" : "unknown");
  }

  if (paidGoogleClick) return result("Google Ads", "cpc", "confirmed", "Google Ads click ID is present.", "paid_search");
  if (t.msclkid) return result("Microsoft Ads", "cpc", "confirmed", "Microsoft Ads click ID is present.", "paid_search");
  if (t.ttclid) return result("TikTok", "paid", "confirmed", "TikTok click ID is present.", "paid_social");
  if (t.li_fat_id) return result("LinkedIn", "paid", "confirmed", "LinkedIn click ID is present.", "paid_social");
  if (t.rdt_cid) return result("Reddit", "paid", "confirmed", "Reddit click ID is present.", "paid_social");
  const referrerMeta = namedMetaSource(referrer);
  if (referrerMeta) return result(referrerMeta, "social", "inferred", "External referrer identifies a social platform.", "organic_social");
  if (/^tiktok\.com$/.test(referrer)) return result("TikTok", "social", "inferred", "External referrer identifies TikTok.", "organic_social");
  const aiByReferrer = AI_ASSISTANTS.find((assistant) => assistant.host(referrer));
  if (aiByReferrer) return result(aiByReferrer.label, "ai_referral", "inferred", `External referrer identifies ${aiByReferrer.label}.`, "ai_assistant");
  if (GOOGLE_SEARCH_HOST.test(referrer)) return result("Google Organic", "organic", "inferred", "Google Search referrer without paid-click evidence.", "organic_search");
  const engineByReferrer = SEARCH_ENGINES.find((engine) => engine.host(referrer));
  if (engineByReferrer) return result(engineByReferrer.label, "organic", "inferred", `External ${engineByReferrer.label} referrer without paid-click evidence.`, "organic_search");
  if (referrer) return result("Referral Websites", "referral", "inferred", "An external referrer was recorded.", "referral");
  if (t.fbclid) return result("Other / Unknown", "unknown", "unknown", "fbclid is shared by Facebook and Instagram.", "unknown");
  if (t.utm_medium || t.utm_campaign || t.utm_content || t.utm_term) {
    return result("Other / Unknown", medium || "unknown", "unknown", "UTM values are present without a source.", isEmailMedium(medium) ? "email" : "unknown");
  }
  return result("Direct Traffic", "none", "unknown", "No campaign, click ID, or external referrer was recorded.", "direct");
}

/** Backward-compatible source/medium helper for existing callers. */
export function classifySource(t: AttributionInput): Pick<SourceClassification, "source" | "medium"> {
  const { source, medium } = classifyAttribution(t);
  return { source, medium };
}

/* -------------------------------------------------------------------------- */
/* Consent for advertising click IDs                                           */
/* -------------------------------------------------------------------------- */

/**
 * Only fbclid can be stored, and only while Meta consent is granted. GA4 (analytics) consent is not advertising
 * authorization, so Google Ads click IDs (gclid, gbraid, wbraid) are never stored until a separate, verified
 * advertising consent exists; the same goes for msclkid, ttclid, li_fat_id and rdt_cid. A click ID that is not
 * stored can still decide the source label for the visit it arrived on.
 */
export function mayStoreClickId(key: string, preferences: TrackingConsentPreferences): boolean {
  return key === "fbclid" && preferences.meta === "granted";
}

function scrubClickIds<T extends Partial<Touch>>(touch: T, preferences: TrackingConsentPreferences): T {
  const out: Record<string, unknown> = { ...touch };
  for (const key of CLICK_KEYS) {
    if (key in out && !mayStoreClickId(key, preferences)) out[key] = "";
  }
  return out as T;
}

/* -------------------------------------------------------------------------- */
/* Lead detail fields                                                          */
/* -------------------------------------------------------------------------- */

function outputTouch(touch: Touch): Touch {
  return {
    ...touch,
    channel: touch.channel || deriveChannel(touch.source ?? "", touch.medium ?? ""),
    referrer: sanitizeReferrer(touch.referrer),
    landing_page: sanitizePageUrl(touch.landing_page),
  };
}

export function buildAttributionDetails(
  first: Touch | null,
  last: Touch | null,
  conversionPage: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  const firstOut = first ? outputTouch(first) : null;
  const lastOut = last ? outputTouch(last) : null;
  const add = (prefix: string, touch: Touch | null) => {
    if (!touch) return;
    for (const [key, value] of Object.entries(touch)) out[`${prefix}_${key}`] = String(value ?? "");
  };
  add("first_touch", firstOut);
  add("last_touch", lastOut);
  const current = lastOut ?? firstOut;
  out["lead_source"] = current?.source ?? "Direct Traffic";
  out["lead_medium"] = current?.medium ?? "none";
  out["channel"] = current?.channel ?? "direct";
  out["source_evidence"] = current?.source_evidence ?? "unknown";
  out["source_reason"] = current?.source_reason ?? "No saved attribution touch was available.";
  for (const key of [...UTM_KEYS, ...CLICK_KEYS]) out[key] = String(current?.[key] ?? "");
  out["referrer"] = current?.referrer ?? "";
  out["landing_page"] = firstOut?.landing_page ?? current?.landing_page ?? "";
  out["conversion_page"] = sanitizePageUrl(conversionPage);
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

/* -------------------------------------------------------------------------- */
/* Storage and capture                                                         */
/* -------------------------------------------------------------------------- */

function read(key: string): Touch | null {
  try {
    const raw = window.localStorage.getItem(key);
    const value = raw ? (JSON.parse(raw) as unknown) : null;
    return value && typeof value === "object" ? (value as Touch) : null;
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

function isFresh(touch: Touch | null, days: number, now: number): touch is Touch {
  if (!touch) return false;
  const stamp = Date.parse(touch.timestamp);
  return Number.isFinite(stamp) && now - stamp < days * DAY_MS && stamp <= now + DAY_MS;
}

function isDirect(touch: Touch): boolean {
  return (touch.channel || deriveChannel(touch.source ?? "", touch.medium ?? "")) === "direct";
}

/** What makes two observations the same visit; the timestamp and landing page are deliberately excluded. */
function signature(touch: Touch): string {
  return [touch.source, touch.medium, touch.referrer, ...UTM_KEYS.map((key) => touch[key])].join("|");
}

// A page load has exactly one document.referrer. In-site (client-side) navigation keeps returning that same
// value, so it is read once per load and never treated as a new touch.
let referrerHandledForLoad = false;
// The same goes for campaign parameters: a URL is a touch once per load, so reading it again later is not a new visit.
let handledSearchForLoad: string | null = null;

export function resetAttributionStateForTests(): void {
  referrerHandledForLoad = false;
  handledSearchForLoad = null;
}

/** Call on every page view; safe to call repeatedly. `now` is injectable for deterministic tests. */
export function captureAttribution(now: number = Date.now()): void {
  if (typeof window === "undefined") return;
  const preferences = getTrackingConsentPreferences();
  const storedFirst = read(FIRST_KEY);
  const storedLast = read(LAST_KEY);
  let first = isFresh(storedFirst, FIRST_TOUCH_WINDOW_DAYS, now) ? scrubClickIds(storedFirst, preferences) : null;
  let last = isFresh(storedLast, LAST_TOUCH_WINDOW_DAYS, now) ? scrubClickIds(storedLast, preferences) : null;
  // A touch that outlived its window is dropped; the newer one carries the journey forward.
  if (!first && last) first = last;

  const searchHandled = handledSearchForLoad === window.location.search;
  handledSearchForLoad = window.location.search;
  const params = new URLSearchParams(searchHandled ? "" : window.location.search);
  const ownHost = window.location.hostname.replace(/^www\./, "");
  const rawReferrer = referrerHandledForLoad ? "" : document.referrer || "";
  referrerHandledForLoad = true;
  const externalReferrer = rawReferrer && hostOf(rawReferrer) !== ownHost ? sanitizeReferrer(rawReferrer) : "";

  const observed = {
    utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "", utm_term: "",
    fbclid: "", gclid: "", gbraid: "", wbraid: "", ttclid: "", li_fat_id: "", rdt_cid: "", msclkid: "",
    referrer: externalReferrer,
    landing_page: sanitizePageUrl(window.location.href),
  };
  for (const key of [...UTM_KEYS, ...CLICK_KEYS]) observed[key] = cleanValue(params.get(key));
  const hasSignal = UTM_KEYS.some((key) => observed[key]) || CLICK_KEYS.some((key) => observed[key]) || Boolean(externalReferrer);

  let nextFirst = first;
  let nextLast = last;
  const stamp = new Date(now).toISOString();
  if (hasSignal) {
    // Classify with every parameter seen on this visit, then store only what consent allows.
    const classification = classifyAttribution(observed);
    const touch: Touch = {
      ...scrubClickIds(observed, preferences),
      source: classification.source,
      medium: classification.medium,
      channel: classification.channel,
      source_evidence: classification.evidence,
      source_reason: classification.reason,
      timestamp: stamp,
    };
    const sameVisit = last && signature(last) === signature(touch) && now - Date.parse(last.timestamp) < SAME_VISIT_MS;
    if (!sameVisit) nextLast = touch;
    if (!nextFirst || isDirect(nextFirst)) nextFirst = touch;
  } else if (!nextLast || !nextFirst) {
    // Nothing to attribute yet: record a Direct visit so leads still carry a touch. A Direct visit never replaces a known one.
    const classification = classifyAttribution(observed);
    const direct: Touch = {
      ...observed,
      source: classification.source,
      medium: classification.medium,
      channel: classification.channel,
      source_evidence: classification.evidence,
      source_reason: classification.reason,
      timestamp: stamp,
    };
    nextLast = nextLast ?? direct;
    nextFirst = nextFirst ?? nextLast;
  }

  if (nextFirst && JSON.stringify(nextFirst) !== JSON.stringify(storedFirst)) write(FIRST_KEY, nextFirst);
  if (nextLast && JSON.stringify(nextLast) !== JSON.stringify(storedLast)) write(LAST_KEY, nextLast);
}

/** Flat attribution fields to merge into a lead's details. */
export function getAttributionDetails(now: number = Date.now()): Record<string, string> {
  if (typeof window === "undefined") return {};
  captureAttribution(now);
  const preferences = getTrackingConsentPreferences();
  const storedFirst = read(FIRST_KEY);
  const storedLast = read(LAST_KEY);
  const first = isFresh(storedFirst, FIRST_TOUCH_WINDOW_DAYS, now) ? scrubClickIds(storedFirst, preferences) : null;
  const last = isFresh(storedLast, LAST_TOUCH_WINDOW_DAYS, now) ? scrubClickIds(storedLast, preferences) : null;
  return buildAttributionDetails(first, last ?? first, window.location.href);
}
