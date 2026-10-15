import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  BadgeDollarSign,
  CalendarCheck,
  CarFront,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { allVehiclesQuery, type VehicleWithPhotos } from "@/lib/queries";
import { isVideoUrl } from "@/lib/vehicle-media";
import { formatMiles, formatUsd, vehicleTitle } from "@/lib/format";

/**
 * My Car inventory page: replace the file currently registering /search.
 * All filter options and vehicle imagery are derived from the real inventory query.
 * Listing cards open the full vehicle details page when clicked.
 * Unsupported metadata is never invented. Empty facets explain what's missing.
 */
type Filters = {
  q?: string;
  newOnly?: boolean;
  make?: string;
  model?: string;
  body?: string;
  fuel?: string;
  drivetrain?: string;
  color?: string;
  interior?: string;
  features?: string;
  deal?: string;
  shipping?: string;
  sort?: string;
  priceMin?: number;
  priceMax?: number;
  yearMin?: number;
  yearMax?: number;
  mileageMin?: number;
  mileageMax?: number;
  mpgMin?: number;
  seatsMin?: number;
  seatsMax?: number;
  page?: number;
};
type MultiKey = "make" | "model" | "body" | "fuel" | "drivetrain" | "color" | "interior" | "features" | "deal";
type Raw = Record<string, unknown>;
type FacetOption = { value: string; count: number };
const PAGE_SIZE = 24;
const toText = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const asNum = (v: unknown) => {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};
const asString = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const asBoolean = (v: unknown) => (v === true || v === "true" || v === "1" || v === 1 ? true : undefined);

/** Only trust explicit inventory new/used classification, not model year or mileage. */
const isBrandNew = (vehicle: VehicleWithPhotos): boolean => {
  const row = record(vehicle);
  const explicit = firstField(row, ["is_new", "isNew", "brand_new", "is_brand_new"]);
  if (explicit === true || explicit === 1 || explicit === "true" || explicit === "1") return true;
  if (explicit === false || explicit === 0 || explicit === "false" || explicit === "0") return false;
  const classification = firstField(row, [
    "condition",
    "vehicle_condition",
    "inventory_type",
    "inventoryType",
    "new_used",
    "new_or_used",
    "sale_condition",
  ]);
  return (
    typeof classification === "string" &&
    ["new", "brand new", "new vehicle", "new car"].includes(classification.trim().toLowerCase())
  );
};

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const integer = (n: number) => new Intl.NumberFormat("en-US").format(n);
const dateMs = (value: unknown) => {
  const n = Date.parse(String(value ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const record = (v: VehicleWithPhotos) => v as unknown as Raw;
const priceOf = (v: VehicleWithPhotos) => Number(v.price_cents ?? 0) / 100;
const prevOf = (v: VehicleWithPhotos) => Number(v.prior_price_cents ?? 0) / 100;
const isDrop = (v: VehicleWithPhotos) => prevOf(v) > priceOf(v) && priceOf(v) > 0;
const freeShipping = (v: VehicleWithPhotos) => {
  const value = firstField(record(v), ["free_shipping", "freeShipping", "is_free_shipping"]);
  return value === true || value === 1 || value === "true";
};
const isRecent = (v: VehicleWithPhotos) => {
  const date = dateMs(v.date_received);
  return date > 0 && Date.now() - date >= 0 && Date.now() - date <= 7 * 86400000;
};
const splitValues = (v?: string) =>
  v
    ? v
        .split("|")
        .map((x) => decodeURIComponentSafe(x))
        .filter(Boolean)
    : [];
const decodeURIComponentSafe = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
const encodedValues = (v: string[]) => (v.length ? v.map((x) => encodeURIComponent(x)).join("|") : undefined);
const hasSelected = (filter: string | undefined, value: string) =>
  splitValues(filter).some((x) => x.toLowerCase() === value.toLowerCase());
const includesAny = (filter: string | undefined, values: string[]) => {
  const chosen = splitValues(filter).map((x) => x.toLowerCase());
  return !chosen.length || values.some((x) => chosen.includes(x.toLowerCase()));
};
const firstField = (row: Raw, keys: string[]): unknown => {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null && val !== "") return val;
  }
  return undefined;
};
const fieldText = (v: VehicleWithPhotos, keys: string[]): string => toText(firstField(record(v), keys));
const fieldNumber = (v: VehicleWithPhotos, keys: string[]): number | undefined => asNum(firstField(record(v), keys));
const interiorColor = (v: VehicleWithPhotos) => fieldText(v, ["interior_color", "interiorColor"]);
const drivetrain = (v: VehicleWithPhotos) => fieldText(v, ["drivetrain", "drive_train"]);
const seating = (v: VehicleWithPhotos) =>
  fieldNumber(v, ["seating_capacity", "seats", "seat_count", "seatingCapacity"]);
const combinedMpg = (v: VehicleWithPhotos) =>
  fieldNumber(v, ["mpg_combined", "mpge_combined", "combined_mpg", "combined_mpge"]);
const carFeatures = (v: VehicleWithPhotos): string[] => {
  const row = record(v);

  const source = firstField(row, ["features", "vehicle_features", "equipment", "options"]);
  if (Array.isArray(source))
    return source
      .map((x) => (typeof x === "string" ? x : x && typeof x === "object" ? toText((x as Raw).name) : ""))
      .filter(Boolean);
  if (typeof source === "string") {
    try {
      const parsed: unknown = JSON.parse(source);
      if (Array.isArray(parsed)) return parsed.map((x) => toText(x)).filter(Boolean);
    } catch {
      /* plain text */
    }
    return source
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};
const colorHex = (color: string): string | undefined => {
  const c = color.toLowerCase();
  const colors: Record<string, string> = {
    black: "#202124",
    white: "#ffffff",
    silver: "#b8bec5",
    gray: "#8c939b",
    grey: "#8c939b",
    red: "#ba3535",
    blue: "#3471b1",
    green: "#438060",
    brown: "#80634b",
    beige: "#e3d3b2",
    tan: "#ccaa7b",
    gold: "#cba548",
    orange: "#dc7d37",
    yellow: "#e9c542",
    purple: "#75529f",
    burgundy: "#79283b",
    charcoal: "#4a4f56",
    cream: "#f2e5c8",
  };
  return Object.keys(colors).find((k) => c.includes(k))
    ? colors[Object.keys(colors).find((k) => c.includes(k))!]
    : undefined;
};
const bodyIcon = (value: string) => {
  const b = value.toLowerCase();
  if (b.includes("truck") || b.includes("pickup")) return "🛻";
  if (b.includes("suv") || b.includes("crossover")) return "🚙";
  if (b.includes("van")) return "🚐";
  if (b.includes("coupe") || b.includes("convertible")) return "🏎️";
  return "🚘";
};
/**
 * Inventory-only listing card. The entire card is a navigation link.
 * The purchase flow remains on the vehicle detail page only.
 * Shipping offers are shown only when explicitly flagged in vehicle data.
 */
function InventoryListingCard({ vehicle }: { vehicle: VehicleWithPhotos }) {
  const photos = [...(vehicle.vehicle_photos ?? [])]
    .sort((a, b) => a.position - b.position)
    .filter((photo) => Boolean(photo.url) && !isVideoUrl(photo.url));
  const image = photos[0];
  const title = vehicleTitle(vehicle);
  const slug = String(vehicle.slug ?? "").trim();

  // Never navigate using an invented slug.
  if (!slug) {
    return (
      <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex aspect-[16/9] items-center justify-center bg-slate-100 text-slate-400">
          <CarFront className="size-12" />
        </div>
        <div className="space-y-2 p-4">
          <h3 className="text-sm font-bold text-[#173954]">{title}</h3>
          <p className="text-sm text-slate-500">Vehicle details unavailable</p>
        </div>
      </article>
    );
  }

  return (
    <Link
      to="/inventory/$slug"
      params={{ slug }}
      aria-label={`View details for ${title}`}
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#9ac1e6] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1478cc]"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#f2f5f8]">
        {image ? (
          <img
            src={image.url}
            alt={image.alt || `${title} exterior or interior photo`}
            loading="lazy"
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.025]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400">
            <CarFront className="size-12" />
          </div>
        )}
        {photos.length > 1 && (
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/35 px-2 py-1">
            {photos.slice(0, 5).map((photo, index) => (
              <span
                key={photo.id}
                className={`size-1.5 rounded-full ${index === 0 ? "bg-[#1595e9]" : "bg-white/90"}`}
              />
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-sm font-bold text-[#173954] sm:text-[15px]">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">
          {vehicle.trim ? `${vehicle.trim} · ` : ""}
          {formatMiles(vehicle.mileage)}
        </p>
        <p className="mt-3 text-xl font-extrabold tracking-tight text-[#173954]">
          {formatUsd(Number(vehicle.price_cents))}
        </p>
        <div className="mt-auto pt-8">
          <div className="border-t border-slate-200 pt-3 text-xs font-semibold">
            {freeShipping(vehicle) ? (
              <span className="text-emerald-600">Free shipping</span>
            ) : (
              <span className="text-slate-500">View pickup & delivery details</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export const Route = createFileRoute("/search")({
  validateSearch: (r: Record<string, unknown>): Filters => ({
    q: asString(r.q),
    newOnly: asBoolean(r.newOnly),
    make: asString(r.make),
    model: asString(r.model),
    body: asString(r.body),
    fuel: asString(r.fuel),
    drivetrain: asString(r.drivetrain),
    color: asString(r.color),
    interior: asString(r.interior),
    features: asString(r.features),
    deal: asString(r.deal),
    shipping: asString(r.shipping),
    sort: asString(r.sort),
    priceMin: asNum(r.priceMin),
    priceMax: asNum(r.priceMax),
    yearMin: asNum(r.yearMin),
    yearMax: asNum(r.yearMax),
    mileageMin: asNum(r.mileageMin),
    mileageMax: asNum(r.mileageMax),
    mpgMin: asNum(r.mpgMin),
    seatsMin: asNum(r.seatsMin),
    seatsMax: asNum(r.seatsMax),
    page: asNum(r.page),
  }),
  head: () => ({
    meta: [
      { title: "Used Cars for Sale in Fredericksburg, VA | My Car" },
      {
        name: "description",
        content:
          "Search My Car's available used cars, trucks and SUVs in Fredericksburg, Virginia. Compare current inventory, prices, photos and vehicle features.",
      },
      { property: "og:title", content: "Used Cars for Sale in Fredericksburg, VA | My Car" },
      { property: "og:description", content: "Browse used cars, current deals and financing options at My Car." },
      { property: "og:url", content: "https://mycarcorp.com/search" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://mycarcorp.com/search" }],
  }),
  component: SearchPage,
});

const SORTS = [
  ["recommended", "Recommended"],
  ["recent", "Recently added"],
  ["price-asc", "Price: low to high"],
  ["price-desc", "Price: high to low"],
  ["drop", "Biggest price drop"],
  ["mileage-asc", "Mileage: low to high"],
  ["newest", "Year: newest first"],
  ["oldest", "Year: oldest first"],
] as const;
const FILTER_KEYS: (keyof Filters)[] = [
  "q",
  "newOnly",
  "make",
  "model",
  "body",
  "fuel",
  "drivetrain",
  "color",
  "interior",
  "features",
  "deal",
  "shipping",
  "priceMin",
  "priceMax",
  "yearMin",
  "yearMax",
  "mileageMin",
  "mileageMax",
  "mpgMin",
  "seatsMin",
  "seatsMax",
];
const compact = (f: Filters): Filters => {
  const out: Raw = {};
  for (const [key, val] of Object.entries(f))
    if (val !== undefined && val !== "" && val !== false && !(key === "page" && val === 1)) out[key] = val;
  return out as Filters;
};
const tally = (vehicles: VehicleWithPhotos[], choose: (v: VehicleWithPhotos) => string[]): FacetOption[] => {
  const counts = new Map<string, number>();
  for (const v of vehicles)
    for (const option of new Set(choose(v).filter(Boolean))) counts.set(option, (counts.get(option) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, count }));
};

function Group({
  title,
  children,
  openByDefault = false,
}: {
  title: string;
  children: React.ReactNode;
  openByDefault?: boolean;
}) {
  const [open, setOpen] = useState(openByDefault);
  return (
    <section className="border-b border-slate-200/80 py-1">
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 py-3 text-left text-xs font-semibold text-slate-800 hover:text-blue-700"
        onClick={() => setOpen((x) => !x)}
      >
        {title}
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-3 pb-4">{children}</div>}
    </section>
  );
}
function Checklist({
  options,
  selected,
  onToggle,
  searchable = false,
  withColors = false,
  withBodyIcons = false,
  emptyText = "No data available for this filter.",
}: {
  options: FacetOption[];
  selected?: string;
  onToggle: (value: string) => void;
  searchable?: boolean;
  withColors?: boolean;
  withBodyIcons?: boolean;
  emptyText?: string;
}) {
  const [query, setQuery] = useState("");
  const [expand, setExpand] = useState(false);
  const matched = options.filter((x) => x.value.toLowerCase().includes(query.toLowerCase()));
  const visible = expand || query ? matched : matched.slice(0, 7);
  return (
    <div className="space-y-2">
      {searchable && options.length > 7 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search options"
            className="h-9 bg-white pl-8 text-xs"
          />
        </div>
      )}

      {options.length === 0 && (
        <p className="rounded-md bg-slate-50 px-2 py-2 text-[11px] leading-4 text-slate-500">{emptyText}</p>
      )}
      <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
        {visible.map((option) => {
          const checked = hasSelected(selected, option.value);
          const hex = withColors ? colorHex(option.value) : undefined;
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-xs hover:bg-slate-50 ${checked ? "font-semibold text-blue-800" : "text-slate-700"}`}
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 shrink-0 accent-blue-600"
                checked={checked}
                onChange={() => onToggle(option.value)}
              />
              {withColors && (
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-slate-300"
                  style={{ backgroundColor: hex || "#f1f5f9" }}
                  title={option.value}
                >
                  {!hex && <span className="flex justify-center text-[9px]">?</span>}
                </span>
              )}
              {withBodyIcons && (
                <span className="w-6 shrink-0 text-center text-lg" aria-hidden="true">
                  {bodyIcon(option.value)}
                </span>
              )}
              <span className="min-w-0 flex-1 break-words">{option.value}</span>
              <span className="text-[10px] font-normal text-slate-400">{option.count}</span>
            </label>
          );
        })}
      </div>
      {!query && options.length > 7 && (
        <button
          type="button"
          onClick={() => setExpand((v) => !v)}
          className="text-xs font-semibold text-blue-700 hover:underline"
        >
          {expand ? "Show less" : `Show all ${options.length}`}
        </button>
      )}
      {query && matched.length === 0 && <p className="text-xs text-slate-500">No matching options.</p>}
    </div>
  );
}
function RangeFilter({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  format = integer,
  description,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (n: [number, number]) => void;
  format?: (n: number) => string;
  description?: string;
}) {
  const safeMax = Math.max(max, min + step);
  const low = Math.max(min, Math.min(value[0], safeMax));
  const high = Math.max(low, Math.min(value[1], safeMax));
  const disabled = max <= min;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-700">{label}</span>
        <span className="text-[10px] text-slate-500">
          {format(low)} – {format(high)}
        </span>
      </div>
      <Slider
        min={min}
        max={safeMax}
        step={step}
        value={[low, high]}
        disabled={disabled}
        onValueChange={(v) => onChange([v[0] ?? 0, v[1] ?? 0])}
        aria-label={label}
        className="py-2"
      />

      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-slate-500">
          Minimum
          <Input
            aria-label={`${label} minimum`}
            type="number"
            min={min}
            max={high}
            step={step}
            disabled={disabled}
            className="mt-1 h-8 bg-white px-2 text-xs"
            value={low}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange([Math.max(min, Math.min(n, high)), high]);
            }}
          />
        </label>
        <label className="text-[10px] text-slate-500">
          Maximum
          <Input
            aria-label={`${label} maximum`}
            type="number"
            min={low}
            max={safeMax}
            step={step}
            disabled={disabled}
            className="mt-1 h-8 bg-white px-2 text-xs"
            value={high}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange([low, Math.min(safeMax, Math.max(n, low))]);
            }}
          />
        </label>
      </div>
      {description && <p className="text-[10px] leading-4 text-slate-500">{description}</p>}
    </div>
  );
}
function Promotion({ type }: { type: "finance" | "trade" | "schedule" | "deals" }) {
  const config = {
    finance: {
      icon: BadgeDollarSign,
      title: "Financing with My Car",
      desc: "Explore financing options for your next vehicle.",
      label: "Explore Financing",
      href: "/finance",
    },
    trade: {
      icon: CarFront,
      title: "Trade in your car",
      desc: "Request a trade-in offer for your current vehicle.",
      label: "Get Your Offer",
      href: "/sell",
    },
    schedule: {
      icon: CalendarCheck,
      title: "Ready for a test drive?",
      desc: "Schedule your visit and see your next car in person.",
      label: "Schedule a Visit",
      href: "/schedule",
    },
    deals: {
      icon: Tag,
      title: "Find price drops",
      desc: "Browse vehicles with verified price reductions.",
      label: "Shop Price Drops",
      href: "/search?deal=price-drop",
    },
  }[type];
  const Icon = config.icon;
  return (
    <article className="flex min-h-[325px] flex-col items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-7 text-center shadow-sm">
      <div className="rounded-2xl bg-blue-50 p-4 text-blue-600">
        <Icon className="h-10 w-10" />
      </div>
      <h3 className="mt-4 text-base font-bold text-slate-900">{config.title}</h3>
      <p className="mt-2 text-xs leading-5 text-slate-500">{config.desc}</p>
      <a
        href={config.href}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
      >
        {config.label}
        <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </article>
  );
}

type SidebarProps = {
  filters: Filters;
  vehicles: VehicleWithPhotos[];
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
  onlySaved: boolean;
  onSaved: (n: boolean) => void;
  savedCount: number;
};
function FilterSidebar({ filters, vehicles, onChange, onClear, onlySaved, onSaved, savedCount }: SidebarProps) {
  const toggle = (key: MultiKey, option: string) => {
    const old = splitValues(filters[key]);
    const next = old.some((x) => x.toLowerCase() === option.toLowerCase())
      ? old.filter((x) => x.toLowerCase() !== option.toLowerCase())
      : [...old, option];
    onChange({ [key]: encodedValues(next), ...(key === "make" ? { model: undefined } : {}) });
  };
  const makeOptions = useMemo(() => tally(vehicles, (v) => [v.make ?? ""]), [vehicles]);
  const modelSource = useMemo(
    () => vehicles.filter((v) => includesAny(filters.make, [v.make ?? ""])),
    [vehicles, filters.make],
  );
  const modelOptions = useMemo(() => tally(modelSource, (v) => [v.model ?? ""]), [modelSource]);
  const bodyOptions = useMemo(() => tally(vehicles, (v) => [v.body_style ?? ""]), [vehicles]);
  const fuelOptions = useMemo(() => tally(vehicles, (v) => [v.fuel_type ?? ""]), [vehicles]);
  const driveOptions = useMemo(() => tally(vehicles, (v) => [drivetrain(v)]), [vehicles]);
  const exteriorOptions = useMemo(() => tally(vehicles, (v) => [v.exterior_color ?? ""]), [vehicles]);
  const interiorOptions = useMemo(() => tally(vehicles, (v) => [interiorColor(v)]), [vehicles]);
  const featureOptions = useMemo(() => tally(vehicles, carFeatures), [vehicles]);
  const prices = vehicles.map(priceOf).filter((n) => n > 0);
  const priceMin = prices.length ? Math.floor(Math.min(...prices) / 1000) * 1000 : 0;
  const priceMax = prices.length ? Math.ceil(Math.max(...prices) / 1000) * 1000 : 0;
  const years = vehicles.map((v) => Number(v.year)).filter((n) => n > 1900);
  const yearMin = years.length ? Math.min(...years) : 2000;
  const yearMax = years.length ? Math.max(...years) : 2026;
  const mileages = vehicles.map((v) => Number(v.mileage)).filter((n) => Number.isFinite(n) && n >= 0);
  const mileageMax = mileages.length ? Math.ceil(Math.max(...mileages) / 5000) * 5000 : 0;
  const seats = vehicles.map(seating).filter((x): x is number => x !== undefined);
  const seatMin = seats.length ? Math.min(...seats) : 0;
  const seatMax = seats.length ? Math.max(...seats) : 0;
  const mpgs = vehicles.map(combinedMpg).filter((x): x is number => x !== undefined && x > 0);
  const mpgMax = mpgs.length ? Math.ceil(Math.max(...mpgs) / 5) * 5 : 0;
  const dealOptions: FacetOption[] = [
    { value: "price-drop", count: vehicles.filter(isDrop).length },
    { value: "recent", count: vehicles.filter(isRecent).length },
  ];
  const count = FILTER_KEYS.filter((k) => filters[k] !== undefined && filters[k] !== "").length + Number(onlySaved);
  return (
    <div className="space-y-1">
      <div className="border-b border-slate-200 pb-3 pt-1">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="mycar-new-only"
            className="cursor-pointer text-[11px] font-semibold text-slate-800 sm:text-xs"
          >
            Only Brand New Cars
          </label>
          <button
            id="mycar-new-only"
            type="button"
            role="switch"
            aria-label="Only Brand New Cars"
            aria-checked={Boolean(filters.newOnly)}
            onClick={() => onChange({ newOnly: filters.newOnly ? undefined : true })}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${filters.newOnly ? "bg-blue-600" : "bg-slate-300"}`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${filters.newOnly ? "translate-x-[18px]" : "translate-x-[2px]"}`}
            />
          </button>
        </div>
        {count > 0 && (
          <button
            type="button"
            className="mt-2 text-[11px] font-semibold text-blue-700 hover:underline"
            onClick={onClear}
          >
            Clear all filters ({count})
          </button>
        )}
      </div>
      <Group title="Payment & Price" openByDefault>
        <RangeFilter
          label="Price range"
          min={priceMin}
          max={priceMax}
          step={priceMax > priceMin + 1000 ? 500 : 100}
          value={[filters.priceMin ?? priceMin, filters.priceMax ?? priceMax]}
          format={money}
          onChange={([min, max]) =>
            onChange({ priceMin: min <= priceMin ? undefined : min, priceMax: max >= priceMax ? undefined : max })
          }
        />
        <a
          href="/finance"
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
        >
          Explore financing <ArrowRight className="h-3 w-3" />
        </a>
      </Group>
      <Group title="Make & Model" openByDefault>
        <p className="text-[11px] font-semibold text-slate-700">Make</p>
        <Checklist searchable options={makeOptions} selected={filters.make} onToggle={(v) => toggle("make", v)} />
        <div className="border-t border-slate-100 pt-3">
          <p className="mb-2 text-[11px] font-semibold text-slate-700">Model</p>
          <Checklist searchable options={modelOptions} selected={filters.model} onToggle={(v) => toggle("model", v)} />
        </div>
      </Group>
      <Group title="Body Type">
        <Checklist withBodyIcons options={bodyOptions} selected={filters.body} onToggle={(v) => toggle("body", v)} />
      </Group>
      <Group title="Year & Mileage">
        <RangeFilter
          label="Year range"
          min={yearMin}
          max={yearMax}
          value={[filters.yearMin ?? yearMin, filters.yearMax ?? yearMax]}
          onChange={([min, max]) =>
            onChange({ yearMin: min <= yearMin ? undefined : min, yearMax: max >= yearMax ? undefined : max })
          }
        />
        <div className="border-t border-slate-100 pt-3">
          <RangeFilter
            label="Mileage"
            min={0}
            max={mileageMax}
            step={mileageMax > 5000 ? 1000 : 100}
            value={[filters.mileageMin ?? 0, filters.mileageMax ?? mileageMax]}
            onChange={([min, max]) =>
              onChange({ mileageMin: min <= 0 ? undefined : min, mileageMax: max >= mileageMax ? undefined : max })
            }
            description="Mileage represents miles on the odometer."
          />
        </div>
      </Group>
      <Group title="Free Shipping & Deals">
        <p className="text-[10px] text-slate-500">
          My Car is a local dealership. Shipping offers aren't shown without verified availability.
        </p>
        <Checklist options={dealOptions} selected={filters.deal} onToggle={(v) => toggle("deal", v)} />
        {vehicles.some(freeShipping) ? (
          <label className="flex cursor-pointer items-center gap-2 px-1 text-xs">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-blue-600"
              checked={filters.shipping === "free"}
              onChange={(e) => onChange({ shipping: e.target.checked ? "free" : undefined })}
            />
            Free shipping ({vehicles.filter(freeShipping).length})
          </label>
        ) : (
          <p className="text-[10px] text-slate-500">
            Free-shipping filter will appear if your feed supplies verified free-shipping flags.
          </p>
        )}
        <label className="flex cursor-pointer items-center gap-2 px-1 text-xs">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-blue-600"
            checked={onlySaved}
            onChange={(e) => onSaved(e.target.checked)}
          />{" "}
          Saved vehicles ({savedCount})
        </label>
      </Group>
      <Group title="Fuel Type">
        <Checklist options={fuelOptions} selected={filters.fuel} onToggle={(v) => toggle("fuel", v)} />
      </Group>
      <Group title="MPG / MPGe">
        {mpgMax > 0 ? (
          <>
            <label className="text-[11px] font-semibold">Minimum combined MPG / MPGe</label>
            <Slider
              min={0}
              max={mpgMax}
              step={1}
              value={[filters.mpgMin ?? 0]}
              onValueChange={(v) => onChange({ mpgMin: (v[0] ?? 0) <= 0 ? undefined : v[0] })}
              className="py-3"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Any</span>
              <span>{filters.mpgMin ? `${filters.mpgMin}+` : "Any"}</span>
            </div>
            <p className="text-[10px] text-slate-500">
              Uses the combined efficiency field available in your inventory feed.
            </p>
          </>
        ) : (
          <p className="text-[11px] text-slate-500">
            Combined MPG/MPGe isn't available in your current inventory data.
          </p>
        )}
      </Group>
      <Group title="Features">
        <Checklist
          searchable
          options={featureOptions}
          selected={filters.features}
          onToggle={(v) => toggle("features", v)}
          emptyText="Your inventory feed doesn't currently expose feature lists. Add vehicle equipment data to enable this filter."
        />
      </Group>
      <Group title="Exterior Color">
        <Checklist withColors options={exteriorOptions} selected={filters.color} onToggle={(v) => toggle("color", v)} />
      </Group>
      <Group title="Interior Color">
        <Checklist
          withColors
          options={interiorOptions}
          selected={filters.interior}
          onToggle={(v) => toggle("interior", v)}
          emptyText="Interior color is not available in the inventory data yet."
        />
      </Group>
      <Group title="Seating Capacity">
        {seats.length > 0 ? (
          <RangeFilter
            label="Seats"
            min={seatMin}
            max={seatMax}
            value={[filters.seatsMin ?? seatMin, filters.seatsMax ?? seatMax]}
            onChange={([min, max]) =>
              onChange({ seatsMin: min <= seatMin ? undefined : min, seatsMax: max >= seatMax ? undefined : max })
            }
          />
        ) : (
          <p className="text-[11px] text-slate-500">Seating capacity is not available in your inventory feed yet.</p>
        )}
      </Group>
      <Group title="Drivetrain">
        <Checklist options={driveOptions} selected={filters.drivetrain} onToggle={(v) => toggle("drivetrain", v)} />
      </Group>
    </div>
  );
}

function SearchPage() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const { data: allVehicles = [], isLoading, isError } = useQuery(allVehiclesQuery());
  const [filters, setFilters] = useState<Filters>(params);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [onlySaved, setOnlySaved] = useState(false);
  useEffect(() => {
    const sync = () => {
      try {
        const parsed: unknown = JSON.parse(localStorage.getItem("mycar-saved-vehicles") || "[]");
        setSavedIds(Array.isArray(parsed) ? parsed.map(String) : []);
      } catch {
        setSavedIds([]);
      }
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);
  useEffect(() => {
    setFilters(params);
  }, [JSON.stringify(params)]);
  const update = useCallback(
    (patch: Partial<Filters>) => {
      setFilters((previous) => {
        const next = compact({ ...previous, ...patch, page: undefined });
        void navigate({ search: () => next, replace: true, resetScroll: false });
        return next;
      });
    },
    [navigate],
  );
  const clear = () => {
    setOnlySaved(false);
    setFilters({});
    void navigate({ search: () => ({}), replace: true, resetScroll: false });
  };
  const vehicles = useMemo(
    () => allVehicles.filter((v) => v.status === "available" || v.status === "pending"),
    [allVehicles],
  );
  const priceDrops = useMemo(() => vehicles.filter(isDrop).length, [vehicles]);
  const filtered = useMemo(() => {
    const queryTerms = (filters.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const found = vehicles.filter((v) => {
      if (filters.newOnly && !isBrandNew(v)) return false;
      const searched = [v.year, v.make, v.model, v.trim, v.vin, v.stock_number, v.body_style, v.exterior_color]
        .join(" ")
        .toLowerCase();
      if (queryTerms.some((q) => !searched.includes(q))) return false;
      if (!includesAny(filters.make, [v.make ?? ""])) return false;
      if (!includesAny(filters.model, [v.model ?? ""])) return false;
      if (!includesAny(filters.body, [v.body_style ?? ""])) return false;
      if (!includesAny(filters.fuel, [v.fuel_type ?? ""])) return false;
      if (!includesAny(filters.drivetrain, [drivetrain(v)])) return false;
      if (!includesAny(filters.color, [v.exterior_color ?? ""])) return false;
      if (!includesAny(filters.interior, [interiorColor(v)])) return false;
      if (!includesAny(filters.features, carFeatures(v))) return false;
      const price = priceOf(v);
      if (filters.priceMin !== undefined && price < filters.priceMin) return false;
      if (filters.priceMax !== undefined && price > filters.priceMax) return false;
      if (filters.yearMin !== undefined && Number(v.year) < filters.yearMin) return false;
      if (filters.yearMax !== undefined && Number(v.year) > filters.yearMax) return false;
      if (filters.mileageMin !== undefined && (v.mileage == null || Number(v.mileage) < filters.mileageMin))
        return false;
      if (filters.mileageMax !== undefined && (v.mileage == null || Number(v.mileage) > filters.mileageMax))
        return false;
      if (filters.mpgMin !== undefined && (combinedMpg(v) ?? -1) < filters.mpgMin) return false;
      if (filters.seatsMin !== undefined && (seating(v) ?? -1) < filters.seatsMin) return false;
      if (filters.seatsMax !== undefined && (seating(v) ?? Infinity) > filters.seatsMax) return false;
      if (filters.shipping === "free" && !freeShipping(v)) return false;
      const deals = splitValues(filters.deal);
      if (deals.length && !deals.some((d) => (d === "price-drop" ? isDrop(v) : d === "recent" ? isRecent(v) : false)))
        return false;
      if (onlySaved && !savedIds.includes(String(v.id))) return false;
      return true;
    });
    return found.sort((a, b) => {
      switch (filters.sort) {
        case "recent":
          return dateMs(b.date_received) - dateMs(a.date_received);
        case "price-asc":
          return priceOf(a) - priceOf(b);
        case "price-desc":
          return priceOf(b) - priceOf(a);
        case "drop":
          return prevOf(b) - priceOf(b) - (prevOf(a) - priceOf(a));
        case "mileage-asc":
          return Number(a.mileage ?? Infinity) - Number(b.mileage ?? Infinity);
        case "newest":
          return Number(b.year) - Number(a.year);
        case "oldest":
          return Number(a.year) - Number(b.year);
        default:
          return (
            Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)) ||
            dateMs(b.date_received) - dateMs(a.date_received)
          );
      }
    });
  }, [vehicles, filters, onlySaved, savedIds]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.max(1, Math.min(Number(filters.page) || 1, totalPages));
  const displayed = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const count =
    FILTER_KEYS.filter((key) => filters[key] !== undefined && filters[key] !== "").length + Number(onlySaved);
  const pageTo = (newPage: number) => {
    const next = compact({ ...filters, page: newPage });
    setFilters(next);
    void navigate({ search: () => next, resetScroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const sidebarProps: SidebarProps = {
    filters,
    vehicles,
    onChange: update,
    onClear: clear,
    onlySaved,
    onSaved: setOnlySaved,
    savedCount: savedIds.length,
  };
  const chip = (key: keyof Filters, val: string) => (
    <button
      key={key}
      type="button"
      onClick={() => update({ [key]: undefined })}
      className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] text-blue-800 hover:bg-blue-100"
    >
      {key === "newOnly" ? "Only Brand New Cars" : `${key}: `}{" "}
      {key === "deal" || ["make", "model", "body", "fuel", "drivetrain", "color", "interior", "features"].includes(key)
        ? splitValues(val).join(", ")
        : key === "newOnly"
          ? ""
          : val}{" "}
      <X className="h-3 w-3" />
    </button>
  );
  return (
    <div className="mx-auto max-w-[1536px] px-3 pb-16 pt-5 sm:px-5 lg:px-6">
      <div className="grid items-start gap-4 lg:grid-cols-[235px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="hidden max-h-[calc(100vh-100px)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 lg:sticky lg:top-20 lg:block">
          <FilterSidebar {...sidebarProps} />
        </aside>
        <main className="min-w-0">
          <div className="rounded-lg bg-blue-50 p-3 sm:p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                aria-label="Search cars"
                value={filters.q ?? ""}
                onChange={(e) => update({ q: e.target.value || undefined })}
                placeholder="Search make, model, year, VIN or keyword"
                className="h-11 border-blue-100 bg-white pl-10 pr-9"
              />
              {filters.q && (
                <button
                  aria-label="Clear search"
                  type="button"
                  onClick={() => update({ q: undefined })}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="my-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <span>{isLoading ? "Loading vehicles…" : `${integer(filtered.length)} vehicles found`}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setMobileOpen(true)}>
                <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                Filters {count ? `(${count})` : ""}
              </Button>
              <label className="flex items-center gap-2">
                Sort by{" "}
                <select
                  aria-label="Sort vehicles"
                  value={filters.sort ?? "recommended"}
                  className="h-9 max-w-[190px] rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800"
                  onChange={(e) => update({ sort: e.target.value === "recommended" ? undefined : e.target.value })}
                >
                  {SORTS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {priceDrops > 0 && (
            <button
              type="button"
              onClick={() => update({ deal: hasSelected(filters.deal, "price-drop") ? undefined : "price-drop" })}
              className="mb-4 flex w-full items-center justify-between rounded-lg bg-slate-100 px-4 py-4 text-left hover:bg-blue-50"
            >
              <div>
                <p className="text-sm font-extrabold text-slate-900 sm:text-base">
                  We've lowered prices to give you more savings!
                </p>
                <p className="mt-1 text-xs text-blue-700">
                  Shop {priceDrops} vehicles with verified price reductions <ArrowRight className="inline h-3 w-3" />
                </p>
              </div>
              <div className="ml-3 rounded-full bg-emerald-600 p-3 text-white">
                <ArrowDown className="h-5 w-5" />
              </div>
            </button>
          )}
          {count > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">Active filters:</span>
              {FILTER_KEYS.filter((k) => filters[k] !== undefined && filters[k] !== "").map((k) =>
                chip(k, String(filters[k])),
              )}
              {onlySaved && (
                <button
                  type="button"
                  onClick={() => setOnlySaved(false)}
                  className="rounded-full border px-2.5 py-1 text-[11px]"
                >
                  Saved vehicles <X className="inline h-3 w-3" />
                </button>
              )}
              <button type="button" onClick={clear} className="text-xs font-semibold text-blue-700 hover:underline">
                Clear all
              </button>
            </div>
          )}
          {isError ? (
            <div className="rounded-lg border border-red-200 bg-white p-10 text-center">
              <h2 className="font-bold">Unable to load inventory</h2>
              <p className="mt-2 text-sm text-slate-500">Please refresh or contact My Car.</p>
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-[320px] animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : displayed.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <CarFront className="mx-auto mb-3 h-10 w-10 text-slate-400" />
              <h2 className="font-bold">No vehicles match your search</h2>
              <p className="mt-2 text-sm text-slate-500">
                {filters.newOnly
                  ? "No vehicles are explicitly marked as brand new in the current inventory results. Turn off Only Brand New Cars to browse other vehicles."
                  : "Try widening your filters or let us help you find a vehicle."}
              </p>
              <div className="mt-5 flex justify-center gap-2">
                <Button variant="outline" onClick={clear}>
                  Clear Filters
                </Button>
                <Button asChild>
                  <Link to="/contact">Contact My Car</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {displayed.flatMap((vehicle, index) => {
                const absolute = (page - 1) * PAGE_SIZE + index + 1;
                const elements = [<InventoryListingCard key={`vehicle-${vehicle.id}`} vehicle={vehicle} />];
                if (absolute === 6) elements.push(<Promotion key="finance" type="finance" />);
                if (absolute === 15) elements.push(<Promotion key="trade" type="trade" />);
                if (absolute === 23) elements.push(<Promotion key="deals" type="deals" />);
                if (absolute === 31) elements.push(<Promotion key="schedule" type="schedule" />);
                return elements;
              })}
            </div>
          )}

          {!isLoading && filtered.length > PAGE_SIZE && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => pageTo(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
                .map((n) => (
                  <Button key={n} variant={n === page ? "default" : "outline"} size="sm" onClick={() => pageTo(n)}>
                    {n}
                  </Button>
                ))}
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => pageTo(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </main>
      </div>
      <section className="mt-16 rounded-xl bg-slate-50 px-5 py-8 sm:px-8">
        <h2 className="text-lg font-bold">Used car shopping at My Car</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Shop used vehicles in Fredericksburg, VA. Compare prices, mileage, photos and available features, then contact
          My Car or schedule a test drive.
        </p>
        <div className="mt-5 flex flex-wrap gap-4 text-sm">
          <Link to="/finance" className="text-blue-700 hover:underline">
            Financing options →
          </Link>
          <Link to="/sell" className="text-blue-700 hover:underline">
            Sell or trade →
          </Link>
          <Link to="/schedule" className="text-blue-700 hover:underline">
            Schedule a visit →
          </Link>
          <Link to="/contact" className="text-blue-700 hover:underline">
            Contact My Car →
          </Link>
        </div>
      </section>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 lg:hidden"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMobileOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Vehicle filters"
            className="absolute inset-y-0 left-0 flex w-[min(90vw,390px)] flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="font-bold">Filters</h2>
              <button aria-label="Close filters" onClick={() => setMobileOpen(false)}>
                <X />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <FilterSidebar {...sidebarProps} />
            </div>
            <div className="border-t p-4">
              <Button className="w-full" onClick={() => setMobileOpen(false)}>
                Show {integer(filtered.length)} Vehicles
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
