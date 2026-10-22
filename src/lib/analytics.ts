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
  | { name: "generate_lead"; params: { form_type: string; lead_intent?: "sell" | "trade" } };

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
      w.gtag = w.gtag ?? function gtag(...args: unknown[]) { w.dataLayer!.push(args); };
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

function pageLocationHasSensitiveQuery(): boolean {
  if (typeof window === "undefined") return true;
  const url = new URL(window.location.href);
  return url.search.length > 0;
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
    metaPixel("init", META_PIXEL_ID);
    metaPixelLoaded = true;
  }
  return metaPixel;
}

export function trackMetaPageView(pathname: string): boolean {
  if (typeof window === "undefined") return false;
  const consent = getTrackingConsentPreferences().meta;
  if (consent !== "granted" || !isAnalyticsRoutePublic(pathname)) {
    if (metaPixelLoaded) metaPixel?.("consent", "revoke");
    return false;
  }
  if (pageLocationHasSensitiveQuery() || sanitizePagePath(pathname) !== pathname) return false;
  const pixel = loadMetaPixel();
  if (!pixel) return false;
  pixel("consent", "grant");
  pixel("track", "PageView");
  return true;
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