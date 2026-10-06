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

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Classify a touch into a channel label. */
export function classifySource(t: Omit<Touch, "source" | "medium" | "timestamp">): {
  source: string;
  medium: string;
} {
  const src = t.utm_source.toLowerCase();
  const med = t.utm_medium.toLowerCase();
  const camp = t.utm_campaign.toLowerCase();
  const ref = hostOf(t.referrer);
  const paidMedium = /(cpc|ppc|paid|ads?|display|cpm|social_paid|paid_social)/.test(med);
  const isVla =
    /(vla|vehicle[_ -]?ads?|vehicle[_ -]?listing)/.test(`${src} ${med} ${camp}`);

  // UTMs win — they distinguish Facebook vs Instagram and VLA.
  if (src) {
    if (/(instagram|^ig$)/.test(src)) return { source: "Instagram", medium: med || (paidMedium ? "paid" : "social") };
    if (/(facebook|^fb$|meta)/.test(src)) return { source: "Facebook", medium: med || "social" };
    if (/google/.test(src)) {
      if (isVla) return { source: "Google Vehicle Ads", medium: med || "cpc" };
      if (paidMedium) return { source: "Google Ads", medium: med };
      return { source: "Google Organic", medium: med || "organic" };
    }
    if (/tiktok/.test(src)) return { source: "TikTok", medium: med || "social" };
    if (/linkedin/.test(src)) return { source: "LinkedIn", medium: med || "social" };
    if (/reddit/.test(src)) return { source: "Reddit", medium: med || "social" };
    return { source: t.utm_source, medium: med || "referral" };
  }

  // Click IDs without UTMs.
  if (t.gclid || t.gbraid || t.wbraid) return { source: isVla ? "Google Vehicle Ads" : "Google Ads", medium: "cpc" };
  if (t.ttclid) return { source: "TikTok", medium: "paid" };
  if (t.li_fat_id) return { source: "LinkedIn", medium: "paid" };
  if (t.rdt_cid) return { source: "Reddit", medium: "paid" };

  // Referrer-based.
  if (ref) {
    if (/instagram\.com$/.test(ref)) return { source: "Instagram", medium: "social" };
    if (/(facebook\.com|fb\.com|fb\.me|messenger\.com)$/.test(ref) || t.fbclid)
      return { source: "Facebook", medium: "social" };
    if (/(^|\.)google\./.test(ref)) return { source: "Google Organic", medium: "organic" };
    if (/tiktok\.com$/.test(ref)) return { source: "TikTok", medium: "social" };
    if (/(linkedin\.com|lnkd\.in)$/.test(ref)) return { source: "LinkedIn", medium: "social" };
    if (/reddit\.com$/.test(ref)) return { source: "Reddit", medium: "social" };
    return { source: "Referral", medium: "referral" };
  }
  if (t.fbclid) return { source: "Facebook", medium: "social" };
  return { source: "Direct", medium: "none" };
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
  if (!hasSignal && !newSession && first && last) return;
  if (!hasSignal && last && !newSession) return;

  const touch: Touch = { ...base, ...classifySource(base), timestamp: new Date().toISOString() };
  if (!first) write(FIRST_KEY, touch);
  // A direct return visit shouldn't overwrite a known campaign last touch.
  if (!last || hasSignal) write(LAST_KEY, touch);
}

/** Flat attribution fields to merge into a lead's details. */
export function getAttributionDetails(): Record<string, string> {
  if (typeof window === "undefined") return {};
  captureAttribution();
  const first = read(FIRST_KEY);
  const last = read(LAST_KEY) ?? first;
  const out: Record<string, string> = {};
  const add = (prefix: string, t: Touch | null) => {
    if (!t) return;
    for (const [k, v] of Object.entries(t)) out[`${prefix}_${k}`] = String(v ?? "");
  };
  add("first_touch", first);
  add("last_touch", last);
  // Convenience top-level fields (last touch).
  out["lead_source"] = last?.source ?? "Direct";
  out["lead_medium"] = last?.medium ?? "none";
  for (const k of [...UTM_KEYS, ...CLICK_KEYS]) out[k] = last?.[k] ?? "";
  out["referrer"] = last?.referrer ?? "";
  out["landing_page"] = first?.landing_page ?? "";
  out["conversion_page"] = window.location.href;
  return out;
}
