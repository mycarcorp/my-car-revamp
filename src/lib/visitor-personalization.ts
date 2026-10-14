/**
 * First-party, anonymous, on-device visitor personalization.
 * Stores only non-sensitive browsing signals in localStorage (never form contents).
 * All functions are SSR-safe and no-op when storage is unavailable or the
 * browser signals a privacy preference (Global Privacy Control / Do Not Track).
 */

export type InterestCategory = "vehicle" | "shopping" | "financing" | "selling" | "trade" | "schedule";

export type VisitorEventType =
  | "home"
  | "search"
  | "vehicle_view"
  | "finance"
  | "sell"
  | "trade_intent"
  | "schedule"
  | "save_vehicle"
  | "search_filter"
  | "car_finder"
  | "form_complete";

export type VehicleRef = {
  id: string;
  slug: string;
  make?: string | null;
  model?: string | null;
  body?: string | null;
  priceCents?: number | null;
  year?: number | null;
};

export type VisitorEvent = {
  type: VisitorEventType;
  path: string;
  ts: number;
  category: InterestCategory;
  vehicle?: VehicleRef;
  filters?: { make?: string; model?: string; body?: string };
};

export type VisitorProfile = {
  v: 1;
  firstSeen: number;
  visits: number;
  lastVisitAt: number;
  events: VisitorEvent[];
};

export const STORAGE_KEY = "mycar_visitor_v1";
const SESSION_KEY = "mycar_visitor_session";
export const MAX_EVENTS = 150;
export const RETENTION_MS = 90 * 86400000;
export const DEDUPE_MS = 30 * 60000;
export const HALF_LIFE_DAYS = 14;

export const WEIGHTS: Record<VisitorEventType, number> = {
  home: 0,
  search: 2,
  search_filter: 2,
  car_finder: 2,
  vehicle_view: 3,
  finance: 3,
  sell: 3,
  trade_intent: 4,
  schedule: 4,
  save_vehicle: 4,
  form_complete: 0,
};
export const REPEAT_VEHICLE_WEIGHT = 4;

const CATEGORY: Record<VisitorEventType, InterestCategory> = {
  home: "shopping",
  search: "shopping",
  search_filter: "shopping",
  car_finder: "shopping",
  vehicle_view: "vehicle",
  save_vehicle: "vehicle",
  finance: "financing",
  sell: "selling",
  trade_intent: "trade",
  schedule: "schedule",
  form_complete: "shopping",
};

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.globalPrivacyControl === true || nav.doNotTrack === "1") return null;
    const s = window.localStorage;
    const k = "__mc_probe";
    s.setItem(k, "1");
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

export function emptyProfile(now = Date.now()): VisitorProfile {
  return { v: 1, firstSeen: now, visits: 0, lastVisitAt: now, events: [] };
}

export function prune(p: VisitorProfile, now = Date.now()): VisitorProfile {
  const events = p.events.filter((e) => now - e.ts < RETENTION_MS).slice(-MAX_EVENTS);
  return { ...p, events };
}

export function readProfile(): VisitorProfile | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as VisitorProfile;
    if (!p || p.v !== 1 || !Array.isArray(p.events)) return null;
    return prune(p);
  } catch {
    return null;
  }
}

function writeProfile(p: VisitorProfile) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(prune(p)));
  } catch {
    /* quota or blocked */
  }
}

/**
 * Count one visit per browser session (idempotent). Returns how many visits
 * happened BEFORE the current session (0 = first-time visitor), or null when
 * storage is unavailable.
 */
export function beginVisit(): number | null {
  const s = storage();
  if (!s) return null;
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing !== null) return Number(existing) || 0;
    const p = readProfile() ?? emptyProfile();
    window.sessionStorage.setItem(SESSION_KEY, String(p.visits));
    writeProfile({ ...p, visits: p.visits + 1, lastVisitAt: Date.now() });
    return p.visits;
  } catch {
    return null;
  }
}

function eventKey(e: Pick<VisitorEvent, "type" | "vehicle" | "filters" | "path">) {
  return `${e.type}|${e.vehicle?.id ?? ""}|${JSON.stringify(e.filters ?? {})}|${e.type === "search" ? "" : e.path}`;
}

/** Pure: append an event unless an identical one happened within DEDUPE_MS (refresh/back). */
export function addEvent(p: VisitorProfile, e: VisitorEvent): VisitorProfile {
  const key = eventKey(e);
  const dup = p.events.some((x) => eventKey(x) === key && e.ts - x.ts < DEDUPE_MS);
  if (dup) return p;
  return { ...p, events: [...p.events, e] };
}

export function trackEvent(
  type: VisitorEventType,
  extra: { path?: string; vehicle?: VehicleRef; filters?: VisitorEvent["filters"] } = {},
) {
  const s = storage();
  if (!s) return;
  const path = extra.path ?? window.location.pathname;
  const p = readProfile() ?? { ...emptyProfile(), visits: 1 };
  const e: VisitorEvent = { type, path, ts: Date.now(), category: CATEGORY[type] };
  if (extra.vehicle) e.vehicle = extra.vehicle;
  if (extra.filters && Object.values(extra.filters).some(Boolean)) e.filters = extra.filters;
  writeProfile(addEvent(p, e));
}

/** Track page-level events from a pathname (called globally on navigation). */
export function trackPath(pathname: string) {
  if (pathname === "/") return trackEvent("home", { path: pathname });
  if (pathname.startsWith("/search")) return trackEvent("search", { path: pathname });
  if (pathname.startsWith("/finance")) return trackEvent("finance", { path: pathname });
  if (pathname.startsWith("/sell")) return trackEvent("sell", { path: pathname });
  if (pathname.startsWith("/schedule")) return trackEvent("schedule", { path: pathname });
}

export function clearProfile() {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function decay(ts: number, now: number) {
  const days = Math.max(0, now - ts) / 86400000;
  return Math.pow(0.5, days / HALF_LIFE_DAYS);
}

export type InterestSummary = {
  scores: Record<InterestCategory, number>;
  ranked: InterestCategory[];
  topVehicle: VehicleRef | null;
  topVehicleViews: number;
  recentVehicles: VehicleRef[];
  preferredBodies: string[];
  preferredMakes: string[];
  priceCents: number | null;
  meaningful: boolean;
};

export function summarize(p: VisitorProfile, now = Date.now()): InterestSummary {
  const scores: Record<InterestCategory, number> = {
    vehicle: 0,
    shopping: 0,
    financing: 0,
    selling: 0,
    trade: 0,
    schedule: 0,
  };
  const vehicleViews = new Map<string, { ref: VehicleRef; count: number; score: number; last: number }>();
  const bodies = new Map<string, number>();
  const makes = new Map<string, number>();
  const prices: number[] = [];

  for (const e of p.events) {
    const d = decay(e.ts, now);
    let w = WEIGHTS[e.type];
    if (e.type === "vehicle_view" && e.vehicle) {
      const cur = vehicleViews.get(e.vehicle.id);
      if (cur) w = REPEAT_VEHICLE_WEIGHT;
      const entry = cur ?? { ref: e.vehicle, count: 0, score: 0, last: 0 };
      entry.ref = e.vehicle;
      entry.count += 1;
      entry.score += w * d;
      entry.last = Math.max(entry.last, e.ts);
      vehicleViews.set(e.vehicle.id, entry);
      if (e.vehicle.priceCents) prices.push(e.vehicle.priceCents);
    }
    scores[e.category] += w * d;
    const body = e.vehicle?.body ?? e.filters?.body;
    const make = e.vehicle?.make ?? e.filters?.make;
    if (body) bodies.set(body, (bodies.get(body) ?? 0) + Math.max(w, 1) * d);
    if (make) makes.set(make, (makes.get(make) ?? 0) + Math.max(w, 1) * d);
  }

  const byScore = [...vehicleViews.values()].sort((a, b) => b.score - a.score);
  const top = byScore[0] ?? null;
  // A specific vehicle leads only when it was viewed more than once.
  if (top && top.count < 2) {
    scores.shopping += scores.vehicle;
    scores.vehicle = 0;
  }
  const ranked = (Object.keys(scores) as InterestCategory[])
    .filter((k) => scores[k] > 0)
    .sort((a, b) => scores[b] - scores[a]);
  const sortMap = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const recentVehicles = [...vehicleViews.values()].sort((a, b) => b.last - a.last).map((x) => x.ref);
  prices.sort((a, b) => a - b);

  return {
    scores,
    ranked,
    topVehicle: top && top.count >= 2 ? top.ref : null,
    topVehicleViews: top?.count ?? 0,
    recentVehicles,
    preferredBodies: sortMap(bodies),
    preferredMakes: sortMap(makes),
    priceCents: prices.length ? prices[Math.floor(prices.length / 2)]! : null,
    meaningful: ranked.length > 0,
  };
}
