export type ConsentState = "unknown" | "denied" | "granted";
export type TrackingConsentPreferences = { analytics: ConsentState; meta: ConsentState };
export type AnalyticsEvent =
  | { name: "page_view"; params: { page_path: string; page_location: string } }
  | { name: "view_item"; params: { item_id: string; item_name: string; item_category?: string; price?: number; currency?: "USD" } }
  | { name: "view_item_list"; params: { item_list_name: string; items: AnalyticsItem[] } }
  | { name: "select_item"; params: { item_list_name: string; items: AnalyticsItem[] } }
  | { name: "search"; params: { search_type: "inventory"; filter_count: number } }
  | { name: "appointment_type_selected"; params: { appointment_type: "test_drive" | "trade_appraisal" | "financing" | "general" } }
  | { name: "appointment_vehicle_selected"; params: { appointment_type: "test_drive" | "trade_appraisal" | "financing" | "general" } }
  | { name: "form_start"; params: { form_type: string } }
  | { name: "generate_lead"; params: { form_type: string; lead_intent?: "sell" | "trade" } }
  | { name: "click_to_call"; params: { link_location: ContactLinkLocation } }
  | { name: "click_directions"; params: { link_location: ContactLinkLocation } };

/** Fixed labels for where a call or directions link sits; never free text. */
export type ContactLinkLocation = "home_map" | "contact_page" | "schedule_page";

export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  item_category?: string;
  price?: number;
  currency?: "USD";
};

export type AnalyticsEnvironment = {
  measurementId?: string;
  consent: ConsentState;
  isPublicRoute: boolean;
};

export type AnalyticsAdapter = {
  load: (measurementId: string) => void;
  updateConsent?: (consent: "granted" | "denied") => void;
  send: (event: AnalyticsEvent) => void;
};

const GA_ID_PATTERN = /^G-[A-Z0-9]{6,}$/;
const DEFAULT_GA4_MEASUREMENT_ID = "G-CFXQ8JPE21";
const SAFE_FORM_TYPES = new Set(["contact", "car_finder", "sell", "trade", "finance", "appointment", "availability", "purchase_request"]);
const SAFE_LIST_NAMES = new Set(["vehicle_inventory", "related_vehicles", "search_results"]);
const SAFE_ITEM_CATEGORIES = new Set(["suv", "sedan", "truck", "coupe", "hatchback", "convertible", "minivan", "wagon", "van"]);
const MAX_LIST_ITEMS = 10;
const CONTACT_LINK_LOCATIONS = new Set<string>(["home_map", "contact_page", "schedule_page"]);
const SENSITIVE_VALUE_PATTERN = /@|\b\d{3}[- .]?\d{3}[- .]?\d{4}\b|\b[A-HJ-NPR-Z0-9]{17}\b/i;
const CONSENT_PREFERENCES_KEY = "mycar.trackingConsent.v1";
const LEGACY_ANALYTICS_CONSENT_KEY = "mycar.analyticsConsent";
const META_PIXEL_ID = "913977571315979";
let storageFallbackPreferences: TrackingConsentPreferences | null = null;

const unknownConsent: TrackingConsentPreferences = { analytics: "unknown", meta: "unknown" };

export function getTrackingConsentPreferences(): TrackingConsentPreferences {
  if (storageFallbackPreferences) return { ...storageFallbackPreferences };
  if (typeof window === "undefined") return { ...unknownConsent };
  try {
    const raw = window.localStorage.getItem(CONSENT_PREFERENCES_KEY);
    if (raw) {
      const value = JSON.parse(raw) as Partial<TrackingConsentPreferences>;
      const valid = (choice: unknown): choice is ConsentState => choice === "granted" || choice === "denied" || choice === "unknown";
      if (valid(value.analytics) && valid(value.meta)) return { analytics: value.analytics, meta: value.meta };
    }
    const legacy = window.localStorage.getItem(LEGACY_ANALYTICS_CONSENT_KEY);
    return { analytics: legacy === "denied" ? "denied" : "unknown", meta: "unknown" };
  } catch {
    return { ...unknownConsent };
  }
}

export function sanitizePagePath(pathname: string): string {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return "/";
  const cleanPath = pathname.split(/[?#]/, 1)[0] || "/";
  return cleanPath.split("/").map((segment) => SENSITIVE_VALUE_PATTERN.test(decodePathSegment(segment)) ? "redacted" : segment).join("/");
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function sanitizePageLocation(pathname: string, origin: string): string {
  let safeOrigin = "";
  try {
    const parsed = new URL(origin);
    if (parsed.protocol === "https:" && parsed.origin === origin.replace(/\/$/, "")) safeOrigin = parsed.origin;
  } catch {
    return "";
  }
  return safeOrigin ? `${safeOrigin}${sanitizePagePath(pathname)}` : "";
}

export function isAnalyticsRoutePublic(pathname: string): boolean {
  return !["/admin", "/api", "/my", "/auth", "/reset-password"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function createAnalyticsController(adapter: AnalyticsAdapter) {
  let environment: AnalyticsEnvironment = { consent: "unknown", isPublicRoute: false };
  let loadedId: string | null = null;
  let lastPageLocation: string | null = null;
  let lastConsent: ConsentState = "unknown";

  function canCollect(): boolean {
    return Boolean(
      environment.consent === "granted" &&
      environment.isPublicRoute &&
      environment.measurementId &&
      GA_ID_PATTERN.test(environment.measurementId),
    );
  }

  function activate(): boolean {
    if (!canCollect()) return false;
    const measurementId = environment.measurementId!;
    if (loadedId !== measurementId) {
      adapter.load(measurementId);
      loadedId = measurementId;
      lastPageLocation = null;
    }
    return true;
  }

  return {
    configure(next: AnalyticsEnvironment): void {
      const consentChanged = next.consent !== lastConsent;
      lastConsent = next.consent;
      environment = next;
      if (environment.consent !== "granted" || !environment.isPublicRoute) {
        if (loadedId && consentChanged) adapter.updateConsent?.("denied");
        return;
      }
      if (activate() && consentChanged) adapter.updateConsent?.("granted");
    },

    getStatus(): { configured: boolean; consent: ConsentState; active: boolean } {
      return {
        configured: Boolean(environment.measurementId && GA_ID_PATTERN.test(environment.measurementId)),
        consent: environment.consent,
        active: canCollect() && loadedId === environment.measurementId,
      };
    },

    pageView(pathname: string, origin: string): boolean {
      if (!activate()) return false;
      const pagePath = sanitizePagePath(pathname);
      const pageLocation = sanitizePageLocation(pagePath, origin);
      if (!pageLocation || pageLocation === lastPageLocation) return false;
      lastPageLocation = pageLocation;
      adapter.send({ name: "page_view", params: { page_path: pagePath, page_location: pageLocation } });
      return true;
    },

    track(event: AnalyticsEvent): boolean {
      if (!activate()) return false;
      const safeEvent = sanitizeEvent(event);
      if (!safeEvent) return false;
      adapter.send(safeEvent);
      return true;
    },
  };
}

export function sanitizeEvent(event: AnalyticsEvent): AnalyticsEvent | null {
  if (event.name === "page_view") return null;
  if (event.name === "appointment_type_selected" || event.name === "appointment_vehicle_selected") {
    const types = new Set(["test_drive", "trade_appraisal", "financing", "general"]);
    const appointmentType = (event.params as { appointment_type?: unknown }).appointment_type;
    return typeof appointmentType === "string" && types.has(appointmentType as "test_drive" | "trade_appraisal" | "financing" | "general")
      ? { name: event.name, params: { appointment_type: appointmentType as "test_drive" | "trade_appraisal" | "financing" | "general" } }
      : null;
  }
  if (event.name === "form_start" || event.name === "generate_lead") {
    if (!SAFE_FORM_TYPES.has(event.params.form_type)) return null;
    if (event.name === "generate_lead") {
      const params: { form_type: string; lead_intent?: "sell" | "trade" } = { form_type: event.params.form_type };
      if (event.params.lead_intent === "sell" || event.params.lead_intent === "trade") params.lead_intent = event.params.lead_intent;
      return { name: event.name, params };
    }
    return { name: event.name, params: { form_type: event.params.form_type } };
  }
  if (event.name === "search") {
    return {
      name: "search",
      params: {
        search_type: "inventory",
        filter_count: Number.isFinite(event.params.filter_count) ? Math.max(0, Math.min(30, Math.trunc(event.params.filter_count))) : 0,
      },
    };
  }
  if (event.name === "click_to_call" || event.name === "click_directions") {
    const location = (event.params as { link_location?: unknown }).link_location;
    return typeof location === "string" && CONTACT_LINK_LOCATIONS.has(location)
      ? { name: event.name, params: { link_location: location as ContactLinkLocation } }
      : null;
  }
  const items = event.name === "view_item" ? [event.params] : event.params.items;
  const safeItems = items.slice(0, MAX_LIST_ITEMS).flatMap((item) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.item_id) || SENSITIVE_VALUE_PATTERN.test(item.item_id) || !item.item_name || item.item_id.length > 80 || item.item_name.length > 120) return [];
    if (SENSITIVE_VALUE_PATTERN.test(item.item_name)) return [];
    const safe: AnalyticsItem = { item_id: item.item_id, item_name: item.item_name };
    if (item.item_category && item.item_category.length <= 60 && SAFE_ITEM_CATEGORIES.has(item.item_category.toLowerCase())) {
      safe.item_category = item.item_category;
    }
    if (Number.isFinite(item.price) && (item.price ?? -1) >= 0) safe.price = item.price;
    if (item.currency === "USD") safe.currency = "USD";
    return [safe];
  });
  if (!safeItems.length) return null;
  if (event.name === "view_item") return { name: "view_item", params: safeItems[0]! };
  if (!SAFE_LIST_NAMES.has(event.params.item_list_name)) return null;
  return { name: event.name, params: { item_list_name: event.params.item_list_name, items: safeItems } };
}

export function getLeadFormType(leadType: string, details: Record<string, unknown> = {}): string | null {
  if (leadType === "trade") return details["intent"] === "sell" ? "sell" : "trade";
  if (leadType === "contact" && details["request_type"] === "car_finder") return "car_finder";
  return ["contact", "finance", "appointment", "availability", "purchase_request"].includes(leadType) ? leadType : null;
}

export function recordLeadSubmission(
  succeeded: boolean,
  leadType: string,
  details: Record<string, unknown> = {},
  send: (event: AnalyticsEvent) => boolean = trackAnalyticsEvent,
): boolean {
  if (!succeeded) return false;
  const formType = getLeadFormType(leadType, details);
  if (!formType) return false;
  const leadIntent = formType === "sell" || formType === "trade" ? formType : undefined;
  // Meta runs on its own consent; finance and purchase requests are not in the Meta event map.
  trackMetaLeadSubmission(formType, details["lead_event_id"]);
  return send({ name: "generate_lead", params: { form_type: formType, ...(leadIntent ? { lead_intent: leadIntent } : {}) } });
}

export function recordFormStart(formType: string, send: (event: AnalyticsEvent) => boolean = trackAnalyticsEvent): boolean {
  if (!SAFE_FORM_TYPES.has(formType)) return false;
  return send({ name: "form_start", params: { form_type: formType } });
}

type Gtag = (...args: unknown[]) => void;
let gtagFunction: Gtag | null = null;
let runtimeController: ReturnType<typeof createAnalyticsController> | null = null;

export function getGa4MeasurementId(): string {
  const configured = import.meta.env["VITE_GA4_MEASUREMENT_ID"];
  return typeof configured === "string" && GA_ID_PATTERN.test(configured)
    ? configured
    : DEFAULT_GA4_MEASUREMENT_ID;
}

export function createBrowserAnalyticsAdapter(): AnalyticsAdapter {
  return {
    load(measurementId) {
      if (typeof window === "undefined" || document.querySelector('script[data-mycar-ga="true"]')) return;
      const w = window as Window & { dataLayer?: unknown[]; gtag?: Gtag };
      w.dataLayer = w.dataLayer ?? [];
      // gtag.js only executes commands pushed as `arguments` objects; a rest-param Array is ignored.
      w.gtag = w.gtag ?? function gtag() {
        // eslint-disable-next-line prefer-rest-params
        w.dataLayer!.push(arguments);
      };
      gtagFunction = w.gtag;
      w.gtag("js", new Date());
      w.gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      w.gtag("consent", "update", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      w.gtag("config", measurementId, { send_page_view: false, allow_google_signals: false });
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
      script.dataset["mycarGa"] = "true";
      document.head.appendChild(script);
    },
    updateConsent(consent) {
      gtagFunction?.("consent", "update", {
        analytics_storage: consent,
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
    },
    send(event) {
      if (typeof window === "undefined" || !gtagFunction) return;
      gtagFunction("event", event.name, event.params);
    },
  };
}

function runtime() {
  runtimeController ??= createAnalyticsController(createBrowserAnalyticsAdapter());
  return runtimeController;
}

function storedConsent(): ConsentState {
  return getTrackingConsentPreferences().analytics;
}

export function configureAnalytics(pathname: string, enabled = true): void {
  const isPublicRoute = enabled && isAnalyticsRoutePublic(pathname);
  runtime().configure({
    measurementId: getGa4MeasurementId(),
    consent: typeof window === "undefined" ? "unknown" : storedConsent(),
    isPublicRoute,
  });
}

export function trackPageView(pathname: string): boolean {
  return runtime().pageView(pathname, typeof window === "undefined" ? "" : window.location.origin);
}

export function trackAnalyticsEvent(event: AnalyticsEvent): boolean {
  return runtime().track(event);
}

export function getAnalyticsStatus() {
  return runtime().getStatus();
}

/** Backward-compatible GA4-only choice setter; Meta remains independently decided. */
export function setAnalyticsConsent(consent: "granted" | "denied", pathname: string): void {
  const current = getTrackingConsentPreferences();
  setTrackingConsentPreferences({ analytics: consent, meta: current.meta === "unknown" ? "denied" : current.meta }, pathname);
}

export function setTrackingConsentPreferences(
  preferences: { analytics: "granted" | "denied"; meta: "granted" | "denied" },
  pathname: string,
): void {
  if (typeof window === "undefined") return;
  const safePreferences: TrackingConsentPreferences = {
    analytics: preferences.analytics === "granted" ? "granted" : "denied",
    meta: preferences.meta === "granted" ? "granted" : "denied",
  };
  let stored = false;
  try {
    window.localStorage.setItem(CONSENT_PREFERENCES_KEY, JSON.stringify(safePreferences));
    stored = true;
  } catch {
    storageFallbackPreferences = safePreferences;
  }
  if (stored) {
    storageFallbackPreferences = null;
    try {
      window.localStorage.setItem(LEGACY_ANALYTICS_CONSENT_KEY, preferences.analytics);
    } catch {
      // The versioned preference remains authoritative if a legacy write fails.
    }
  }
  configureAnalytics(pathname);
  if (preferences.analytics === "granted") trackPageView(pathname);
  trackMetaPageView(pathname);
}

type MetaPixel = (...args: unknown[]) => void;
let metaPixel: MetaPixel | null = null;
let metaPixelLoaded = false;
/** True while the Pixel has been told consent is granted; used to revoke only on a real transition. */
let metaConsentGranted = false;
/** Location (path + query) of the last PageView sent, so repeat calls for the same page never double count. */
let lastMetaPageKey: string | null = null;
/** The last vehicle page that sent ViewContent, so effect re-runs on the same page never send it twice. */
let lastMetaViewContent: { page: string; itemId: string } | null = null;
/** Event IDs already sent, so one qualifying action can never produce two events. */
const firedMetaEventIds = new Set<string>();
const lastContactClick = new Map<string, number>();

// The Meta Pixel reads the browser URL itself (document location and referrer), so event parameters cannot
// protect it. Safety therefore depends on the URL: the Pixel only runs on pages whose whole URL is either
// query-free or made up solely of known advertising parameters with opaque, well-formed values.
const META_UTM_KEYS = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]);
const META_CLICK_ID_KEYS = new Set(["fbclid", "gclid", "gbraid", "wbraid", "ttclid", "msclkid"]);
const RAW_UTM_VALUE = /^[A-Za-z0-9_\-.~%+*:|]{1,256}$/;
const DECODED_UTM_VALUE = /^[A-Za-z0-9 _\-.~+*:|]{1,256}$/;
const CLICK_ID_VALUE = /^[A-Za-z0-9_.-]{10,256}$/;

function isSafeUtmValue(raw: string): boolean {
  if (!RAW_UTM_VALUE.test(raw)) return false;
  let decoded = raw;
  // Decode repeatedly so double-encoded values (%2540 -> %40 -> @) cannot hide sensitive data.
  for (let pass = 0; pass < 3 && decoded.includes("%"); pass += 1) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      return false;
    }
  }
  if (decoded.includes("%") || !DECODED_UTM_VALUE.test(decoded)) return false;
  // Platform IDs such as Meta's {{campaign.id}} are long all-digit strings and are accepted as opaque IDs.
  if (/^\d{15,20}$/.test(decoded)) return true;
  if (SENSITIVE_VALUE_PATTERN.test(decoded)) return false;
  // Rejects phone numbers, SSNs and similar identifiers even when separated by spaces, dots or hyphens.
  return !/\d{9,}/.test(decoded.replace(/[ .-]/g, ""));
}

function isSafeClickIdValue(raw: string): boolean {
  // Click IDs are opaque tokens generated by the ad platform and always contain letters.
  return CLICK_ID_VALUE.test(raw) && /[A-Za-z]/.test(raw);
}

/**
 * True only when the Meta Pixel may run on this URL: https, no credentials or fragment, a path that needs no
 * redaction, and either no query or only unique, well-formed advertising parameters.
 */
export function isMetaSafeUrl(href: string): boolean {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) return false;
  if (sanitizePagePath(url.pathname) !== url.pathname) return false;
  const query = url.search.startsWith("?") ? url.search.slice(1) : url.search;
  if (!query) return true;
  const seen = new Set<string>();
  for (const part of query.split("&")) {
    const separator = part.indexOf("=");
    if (separator <= 0) return false;
    const key = part.slice(0, separator);
    const value = part.slice(separator + 1);
    if (seen.has(key)) return false;
    seen.add(key);
    if (META_UTM_KEYS.has(key)) {
      if (!isSafeUtmValue(value)) return false;
    } else if (META_CLICK_ID_KEYS.has(key)) {
      if (!isSafeClickIdValue(value)) return false;
    } else {
      return false;
    }
  }
  return true;
}

/** @internal Resets module-level Pixel state; used by tests that stub window and document. */
export function resetMetaPixelStateForTests(): void {
  metaPixel = null;
  metaPixelLoaded = false;
  metaConsentGranted = false;
  lastMetaPageKey = null;
  lastMetaViewContent = null;
  firedMetaEventIds.clear();
  lastContactClick.clear();
}

function loadMetaPixel(): MetaPixel | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  const w = window as Window & { fbq?: MetaPixel; _fbq?: MetaPixel };
  if (!w.fbq) {
    const queue: MetaPixel & { callMethod?: MetaPixel; queue?: unknown[]; loaded?: boolean; version?: string } = function (...args: unknown[]) {
      if (queue.callMethod) queue.callMethod(...args);
      else queue.queue?.push(args);
    };
    queue.queue = [];
    queue.loaded = true;
    queue.version = "2.0";
    w.fbq = queue;
    w._fbq = queue;
  }
  metaPixel = w.fbq;
  if (!metaPixelLoaded) {
    if (!document.querySelector('script[data-mycar-meta="true"]')) {
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      script.dataset["mycarMeta"] = "true";
      document.head.appendChild(script);
    }
    // Both calls must run before init: they stop Meta's automatic event setup (button-click and form-field
    // detection) so only the events this site sends explicitly are collected.
    metaPixel("set", "autoConfig", false, META_PIXEL_ID);
    metaPixel("set", "smartSetup", false, META_PIXEL_ID);
    metaPixel("init", META_PIXEL_ID);
    metaPixelLoaded = true;
  }
  return metaPixel;
}

function suppressMetaPixel(): false {
  lastMetaPageKey = null;
  lastMetaViewContent = null;
  if (metaPixelLoaded && metaConsentGranted) {
    metaPixel?.("consent", "revoke");
    metaConsentGranted = false;
  }
  return false;
}

/** Consent, route and URL checks shared by every Meta event. Meta consent is independent of GA4 consent. */
function metaPageEligible(pathname: string): boolean {
  if (getTrackingConsentPreferences().meta !== "granted") return false;
  if (!isAnalyticsRoutePublic(pathname) || sanitizePagePath(pathname) !== pathname) return false;
  return isMetaSafeUrl(window.location.href);
}

function ensureMetaPixel(): MetaPixel | null {
  const pixel = loadMetaPixel();
  if (!pixel) return null;
  if (!metaConsentGranted) {
    pixel("consent", "grant");
    metaConsentGranted = true;
  }
  return pixel;
}

/**
 * Sends one Meta PageView for the current page when Meta consent is granted and the URL is safe.
 * Repeat calls for the same page (route effects, preference re-saves) never send a duplicate.
 */
export function trackMetaPageView(pathname: string): boolean {
  if (typeof window === "undefined") return false;
  if (!metaPageEligible(pathname)) return suppressMetaPixel();
  const location = new URL(window.location.href);
  const pageKey = `${location.pathname}${location.search}`;
  if (pageKey === lastMetaPageKey) return false;
  // Moving to another page ends the previous page's ViewContent window.
  if (lastMetaViewContent && lastMetaViewContent.page !== pageKey) lastMetaViewContent = null;
  const pixel = ensureMetaPixel();
  if (!pixel) return false;
  pixel("track", "PageView");
  lastMetaPageKey = pageKey;
  return true;
}

type MetaConversionName = "ViewContent" | "Lead" | "Schedule" | "Contact";
type MetaEventParams = Record<string, string | number | string[]>;

const EVENT_ID_PATTERN = /^mc_[a-f0-9-]{16,40}$/;

/** Opaque random ID shared by browser and (future) server events for deduplication. Carries no customer data. */
export function createEventId(): string {
  const webCrypto = (globalThis as { crypto?: Crypto }).crypto;
  if (webCrypto?.randomUUID) return `mc_${webCrypto.randomUUID()}`;
  const bytes = new Uint8Array(16);
  if (webCrypto?.getRandomValues) webCrypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return `mc_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

/** Every Meta conversion goes through here: consent, safe URL, once per event ID, no customer data. */
function sendMetaEvent(name: MetaConversionName, params: MetaEventParams, eventId: string): boolean {
  if (typeof window === "undefined") return false;
  if (!metaPageEligible(window.location.pathname)) return suppressMetaPixel();
  if (firedMetaEventIds.has(eventId)) return false;
  const pixel = ensureMetaPixel();
  if (!pixel) return false;
  pixel("track", name, params, { eventID: eventId });
  if (firedMetaEventIds.size >= 500) firedMetaEventIds.clear();
  firedMetaEventIds.add(eventId);
  return true;
}

/** Form types that map to a Meta conversion. Finance, purchase requests and availability are deliberately absent. */
const META_FORM_EVENTS = new Map<string, "Lead" | "Schedule">([
  ["contact", "Lead"],
  ["car_finder", "Lead"],
  ["sell", "Lead"],
  ["trade", "Lead"],
  ["appointment", "Schedule"],
]);

/**
 * Adds an opaque event ID to a lead's details when the lead type can produce a Meta conversion.
 * Returns null and leaves `details` untouched for finance, purchase and any other type.
 */
export function withLeadEventId(leadType: string, details: Record<string, unknown>): string | null {
  const formType = getLeadFormType(leadType, details);
  if (!formType || !META_FORM_EVENTS.has(formType)) return null;
  const eventId = createEventId();
  details["lead_event_id"] = eventId;
  return eventId;
}

/** Meta Lead / Schedule for a submission that was already saved. Never called for finance or purchase requests. */
export function trackMetaLeadSubmission(formType: string, rawEventId?: unknown): boolean {
  const metaEvent = META_FORM_EVENTS.get(formType);
  if (!metaEvent) return false;
  const eventId = typeof rawEventId === "string" && EVENT_ID_PATTERN.test(rawEventId) ? rawEventId : createEventId();
  return sendMetaEvent(metaEvent, { content_category: formType }, eventId);
}

/** Meta ViewContent for a vehicle detail page, using the same sanitized catalog fields as GA4 view_item. */
export function trackMetaViewContent(item: Extract<AnalyticsEvent, { name: "view_item" }>["params"]): boolean {
  if (typeof window === "undefined") return false;
  const safe = sanitizeEvent({ name: "view_item", params: item });
  if (!safe || safe.name !== "view_item") return false;
  const page = `${window.location.pathname}${window.location.search}`;
  const itemId = safe.params.item_id;
  if (lastMetaViewContent && lastMetaViewContent.page === page && lastMetaViewContent.itemId === itemId) return false;
  const params: MetaEventParams = {
    content_type: "vehicle",
    content_ids: [itemId],
    content_name: safe.params.item_name,
    ...(safe.params.item_category ? { content_category: safe.params.item_category } : {}),
    ...(safe.params.price !== undefined ? { value: safe.params.price, currency: "USD" } : {}),
  };
  const sent = sendMetaEvent("ViewContent", params, createEventId());
  if (sent) lastMetaViewContent = { page, itemId };
  return sent;
}

/**
 * Records a phone or directions click: GA4 click_to_call / click_directions with a fixed location label,
 * plus Meta Contact for phone clicks. Quick repeat clicks on the same link count once.
 */
export function trackContactClick(kind: "phone" | "directions", linkLocation: ContactLinkLocation): void {
  if (!CONTACT_LINK_LOCATIONS.has(linkLocation)) return;
  const key = `${kind}:${linkLocation}`;
  const now = Date.now();
  if (now - (lastContactClick.get(key) ?? -Infinity) < 1000) return;
  lastContactClick.set(key, now);
  trackAnalyticsEvent({ name: kind === "phone" ? "click_to_call" : "click_directions", params: { link_location: linkLocation } });
  if (kind === "phone") sendMetaEvent("Contact", { content_category: "phone_click", content_name: linkLocation }, createEventId());
}

export function publicCatalogItemId(
  year: number | string | null | undefined,
  make: string | null | undefined,
  model: string | null | undefined,
): string {
  const parts = [year == null ? "" : String(year), make ?? "", model ?? ""];
  if (parts.some((part) => SENSITIVE_VALUE_PATTERN.test(part))) return "";
  return parts
    .map((part) => part.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("-")
    .slice(0, 80);
}