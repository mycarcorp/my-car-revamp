export type ConsentState = "unknown" | "denied" | "granted";
export type AnalyticsEvent =
  | { name: "page_view"; params: { page_path: string; page_location: string } }
  | { name: "view_item"; params: { item_id: string; item_name: string; item_category?: string; price?: number; currency?: "USD" } }
  | { name: "view_item_list"; params: { item_list_name: string; items: AnalyticsItem[] } }
  | { name: "select_item"; params: { item_list_name: string; items: AnalyticsItem[] } }
  | { name: "search"; params: { search_type: "inventory"; filter_count: number } }
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
const SAFE_FORM_TYPES = new Set(["contact", "car_finder", "sell", "trade", "finance", "appointment", "availability", "purchase_request"]);
const SAFE_LIST_NAMES = new Set(["vehicle_inventory", "related_vehicles", "search_results"]);
const SAFE_ITEM_CATEGORIES = new Set(["suv", "sedan", "truck", "coupe", "hatchback", "convertible", "minivan", "wagon", "van"]);
const MAX_LIST_ITEMS = 10;
const SENSITIVE_VALUE_PATTERN = /@|\b\d{3}[- .]?\d{3}[- .]?\d{4}\b|\b[A-HJ-NPR-Z0-9]{17}\b/i;

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

function browserAdapter(): AnalyticsAdapter {
  return {
    load(measurementId) {
      if (typeof window === "undefined" || document.querySelector('script[data-mycar-ga="true"]')) return;
      const w = window as Window & { dataLayer?: unknown[]; gtag?: Gtag };
      w.dataLayer = w.dataLayer ?? [];
      w.gtag = w.gtag ?? function gtag(...args: unknown[]) { w.dataLayer!.push(args); };
      gtagFunction = w.gtag;
      w.gtag("js", new Date());
      w.gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      w.gtag("consent", "update", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
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
  runtimeController ??= createAnalyticsController(browserAdapter());
  return runtimeController;
}

function storedConsent(): ConsentState {
  if (typeof window === "undefined") return "unknown";
  try {
    const value = window.localStorage.getItem("mycar.analyticsConsent");
    return value === "granted" || value === "denied" ? value : "unknown";
  } catch {
    return "unknown";
  }
}

export function configureAnalytics(pathname: string, enabled = true): void {
  const isPublicRoute = enabled && isAnalyticsRoutePublic(pathname);
  runtime().configure({
    measurementId: import.meta.env["VITE_GA4_MEASUREMENT_ID"],
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

/** Call only from an approved analytics-consent interface. No consent UI currently invokes this. */
export function setAnalyticsConsent(consent: "granted" | "denied", pathname: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("mycar.analyticsConsent", consent);
  } catch {
    return;
  }
  configureAnalytics(pathname);
  if (consent === "granted") trackPageView(pathname);
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