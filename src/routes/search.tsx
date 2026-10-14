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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { allVehiclesQuery, siteSettingsQuery, type VehicleWithPhotos } from "@/lib/queries";
import { VehicleCard } from "@/components/VehicleCard";

/*
 * My Car /search inventory page.
 * Paste into the SAME file that currently declares createFileRoute('/search').
 * Real photos/prices come from allVehiclesQuery(), never from mock inventory.
 * VehicleCard owns media normalization, gallery, favorites and navigation.
 * A true 360-degree spin requires a separately supplied, ordered 360 frame set.
 */

type Filters = {
  q?: string;
  make?: string;
  model?: string;
  body?: string;
  fuel?: string;
  drivetrain?: string;
  color?: string;
  priceMin?: number;
  priceMax?: number;
  yearMin?: number;
  yearMax?: number;
  mileageMax?: number;
  mpgMin?: number;
  deal?: string;
  sort?: string;
  page?: number;
};
const parseString = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const parseNumber = (v: unknown) => {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
const PAGE_SIZE = 24;
const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const integer = (n: number) => new Intl.NumberFormat("en-US").format(n);
const dateMs = (value: unknown) => {
  if (!value) return 0;
  const time = Date.parse(String(value));
  return Number.isFinite(time) ? time : 0;
};
const textValue = (v: unknown) => (typeof v === "string" ? v : "");
const priceOf = (v: VehicleWithPhotos) => Number(v.price_cents || 0) / 100;
const previousPriceOf = (v: VehicleWithPhotos) => Number(v.prior_price_cents || 0) / 100;
const isDrop = (v: VehicleWithPhotos) => previousPriceOf(v) > priceOf(v) && priceOf(v) > 0;
const isRecent = (v: VehicleWithPhotos) => {
  const timestamp = dateMs(v.date_received);
  return timestamp > 0 && Date.now() - timestamp >= 0 && Date.now() - timestamp <= 7 * 86400000;
};
const vehicleTitle = (v: VehicleWithPhotos) => `${v.year} ${v.make} ${v.model}`;

export const Route = createFileRoute("/search")({
  validateSearch: (raw: Record<string, unknown>): Filters => ({
    q: parseString(raw.q),
    make: parseString(raw.make),
    model: parseString(raw.model),
    body: parseString(raw.body),
    fuel: parseString(raw.fuel),
    drivetrain: parseString(raw.drivetrain),
    color: parseString(raw.color),
    priceMin: parseNumber(raw.priceMin),
    priceMax: parseNumber(raw.priceMax),
    yearMin: parseNumber(raw.yearMin),
    yearMax: parseNumber(raw.yearMax),
    mileageMax: parseNumber(raw.mileageMax),
    mpgMin: parseNumber(raw.mpgMin),
    deal: parseString(raw.deal),
    sort: parseString(raw.sort),
    page: parseNumber(raw.page),
  }),
  head: () => ({
    meta: [
      { title: "Used Cars for Sale in Fredericksburg, VA | My Car" },
      {
        name: "description",
        content:
          "Shop used cars, trucks and SUVs in Fredericksburg, VA at My Car. Browse current inventory, compare prices and schedule a test drive.",
      },
      { property: "og:title", content: "Used Cars for Sale in Fredericksburg, VA | My Car" },
      { property: "og:description", content: "Explore available used vehicles, price drops and financing at My Car." },
      { property: "og:url", content: "https://mycarcorp.com/search" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://mycarcorp.com/search" }],
  }),
  component: SearchPage,
});

const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "recent", label: "Recently added" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "drop", label: "Biggest price drop" },
  { value: "mileage-asc", label: "Mileage: low to high" },
  { value: "newest", label: "Year: newest first" },
  { value: "oldest", label: "Year: oldest first" },
];
const MILEAGE = [10000, 30000, 50000, 75000, 100000, 150000];
const FILTER_FIELDS: (keyof Filters)[] = [
  "q",
  "make",
  "model",
  "body",
  "fuel",
  "drivetrain",
  "color",
  "priceMin",
  "priceMax",
  "yearMin",
  "yearMax",
  "mileageMax",
  "mpgMin",
  "deal",
];
function compactParams(value: Filters) {
  const out: Filters = {};
  for (const [k, v] of Object.entries(value)) {
    if (v != null && v !== "" && !(k === "page" && v === 1)) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
function Facet({
  title,
  options,
  value,
  change,
}: {
  title: string;
  options: string[];
  value?: string;
  change: (value?: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-foreground">{title}</label>
      <Select value={value || "any"} onValueChange={(v) => change(v === "any" ? undefined : v)}>
        <SelectTrigger className="h-9 w-full rounded-md bg-background text-xs">
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">All {title.toLowerCase()}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function FilterGroup({
  title,
  children,
  initiallyOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div className="border-b border-border/70 py-1">
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-center justify-between py-3 text-left text-xs font-semibold hover:text-primary"
        aria-expanded={open}
      >
        {title}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-3 pb-4">{children}</div>}
    </div>
  );
}
function Promotion({ type }: { type: "finance" | "trade" | "schedule" | "deals" }) {
  const config = {
    finance: {
      icon: BadgeDollarSign,
      title: "Financing with My Car",
      desc: "Explore available financing options for your next vehicle.",
      action: "Explore Financing",
      href: "/finance",
    },
    trade: {
      icon: CarFront,
      title: "Trade in your car",
      desc: "Tell us about your vehicle and request a trade-in offer.",
      action: "Get Your Offer",
      href: "/sell",
    },
    schedule: {
      icon: CalendarCheck,
      title: "Ready for a test drive?",
      desc: "Schedule a visit and see your favorite vehicles in person.",
      action: "Schedule a Visit",
      href: "/schedule",
    },
    deals: {
      icon: Tag,
      title: "Discover price drops",
      desc: "Explore available vehicles with verified reduced prices.",
      action: "Shop Price Drops",
      href: "/search?deal=price-drop",
    },
  }[type];
  const Icon = config.icon;
  return (
    <article className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-border bg-card px-5 py-8 text-center shadow-sm">
      <div className="mb-4 rounded-2xl bg-blue-50 p-4 text-blue-600">
        <Icon className="h-10 w-10" />
      </div>
      <h3 className="text-base font-bold">{config.title}</h3>
      <p className="mt-2 max-w-[230px] text-xs leading-5 text-muted-foreground">{config.desc}</p>
      <a
        href={config.href}
        className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
      >
        {config.action}
        <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </article>
  );
}
function SearchPage() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const { data: allVehicles = [], isLoading, isError } = useQuery(allVehiclesQuery());
  const { data: settings } = useQuery(siteSettingsQuery());
  const [filters, setFilters] = useState<Filters>(params);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [onlySaved, setOnlySaved] = useState(false);
  useEffect(() => {
    try {
      setSavedIds(JSON.parse(localStorage.getItem("mycar-saved-vehicles") || "[]"));
    } catch {
      setSavedIds([]);
    }
  }, []);
  useEffect(() => {
    const sync = () => {
      try {
        setSavedIds(JSON.parse(localStorage.getItem("mycar-saved-vehicles") || "[]"));
      } catch {
        setSavedIds([]);
      }
    };
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);
  // A single source of truth for shareable filters, back/forward, and pagination.
  useEffect(() => {
    setFilters(params);
  }, [JSON.stringify(params)]);
  const update = useCallback(
    (patch: Partial<Filters>) => {
      const next = compactParams({ ...filters, ...patch, page: undefined });
      setFilters(next);
      void navigate({ search: () => next, replace: true, resetScroll: false });
    },
    [filters, navigate],
  );
  const goPage = (page: number) => {
    const next = compactParams({ ...filters, page });
    setFilters(next);
    void navigate({ search: () => next, resetScroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const clear = () => {
    setFilters({});
    setOnlySaved(false);
    void navigate({ search: () => ({}), replace: true, resetScroll: false });
  };
  const vehicles = useMemo(
    () => allVehicles.filter((v) => v.status === "available" || v.status === "pending"),
    [allVehicles],
  );
  const unique = (select: (v: VehicleWithPhotos) => unknown, source = vehicles) =>
    [...new Set(source.map(select).filter((v): v is string => typeof v === "string" && !!v.trim()))].sort();
  const makes = useMemo(() => unique((v) => v.make), [vehicles]);
  const models = useMemo(
    () => unique((v) => v.model, filters.make ? vehicles.filter((v) => v.make === filters.make) : vehicles),
    [vehicles, filters.make],
  );
  const bodies = useMemo(() => unique((v) => v.body_style), [vehicles]);
  const fuels = useMemo(() => unique((v) => v.fuel_type), [vehicles]);
  const colors = useMemo(() => unique((v) => v.exterior_color), [vehicles]);
  const drivetrains = useMemo(() => unique((v) => (v as unknown as Record<string, unknown>).drivetrain), [vehicles]);
  const years = useMemo(
    () => [...new Set(vehicles.map((v) => Number(v.year)).filter(Boolean))].sort((a, b) => b - a),
    [vehicles],
  );
  const priceDrops = useMemo(() => vehicles.filter(isDrop).length, [vehicles]);
  const filtered = useMemo(() => {
    const eq = (a: unknown, b?: string) => !b || textValue(a).toLowerCase() === b.toLowerCase();
    const words = (filters.q || "").toLowerCase().split(/\s+/).filter(Boolean);
    const found = vehicles.filter((v) => {
      const fields = v as unknown as Record<string, unknown>;
      const searchable = [v.year, v.make, v.model, v.trim, v.vin, v.stock_number, v.body_style, v.exterior_color]
        .join(" ")
        .toLowerCase();
      if (words.some((word) => !searchable.includes(word))) return false;
      if (
        !eq(v.make, filters.make) ||
        !eq(v.model, filters.model) ||
        !eq(v.body_style, filters.body) ||
        !eq(v.fuel_type, filters.fuel) ||
        !eq(v.exterior_color, filters.color) ||
        !eq(fields.drivetrain, filters.drivetrain)
      )
        return false;
      const price = priceOf(v);
      if (filters.priceMin != null && price < filters.priceMin) return false;
      if (filters.priceMax != null && price > filters.priceMax) return false;
      if (filters.yearMin != null && Number(v.year) < filters.yearMin) return false;
      if (filters.yearMax != null && Number(v.year) > filters.yearMax) return false;
      if (filters.mileageMax != null && (v.mileage == null || Number(v.mileage) > filters.mileageMax)) return false;
      if (filters.mpgMin != null && (v.mpg_combined == null || Number(v.mpg_combined) < filters.mpgMin)) return false;
      if (filters.deal === "price-drop" && !isDrop(v)) return false;
      if (filters.deal === "recent" && !isRecent(v)) return false;
      if (onlySaved && !savedIds.includes(String(v.id))) return false;
      return true;
    });
    return found.sort((a, b) => {
      switch (filters.sort) {
        case "price-asc":
          return priceOf(a) - priceOf(b);
        case "price-desc":
          return priceOf(b) - priceOf(a);
        case "mileage-asc":
          return Number(a.mileage ?? Infinity) - Number(b.mileage ?? Infinity);
        case "newest":
          return Number(b.year) - Number(a.year);
        case "oldest":
          return Number(a.year) - Number(b.year);
        case "recent":
          return dateMs(b.date_received) - dateMs(a.date_received);
        case "drop":
          return previousPriceOf(b) - priceOf(b) - (previousPriceOf(a) - priceOf(a));
        default:
          return (
            Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)) ||
            dateMs(b.date_received) - dateMs(a.date_received)
          );
      }
    });
  }, [vehicles, filters, savedIds, onlySaved]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.max(1, Math.min(Number(filters.page) || 1, pages));
  const displayed = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const count =
    FILTER_FIELDS.filter((field) => filters[field] != null && filters[field] !== "").length + Number(onlySaved);
  const filterUI = (
    <>
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h2 className="font-bold">Filter vehicles {count ? `(${count})` : ""}</h2>
        {count > 0 && (
          <button type="button" onClick={clear} className="text-xs font-semibold text-primary hover:underline">
            Clear all
          </button>
        )}
      </div>
      <FilterGroup title="Deals & Recently Added" initiallyOpen>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={filters.deal === "price-drop"}
            onChange={(e) => update({ deal: e.target.checked ? "price-drop" : undefined })}
          />
          Price drops ({priceDrops})
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={filters.deal === "recent"}
            onChange={(e) => update({ deal: e.target.checked ? "recent" : undefined })}
          />
          Recently added
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input type="checkbox" checked={onlySaved} onChange={(e) => setOnlySaved(e.target.checked)} />
          Saved vehicles ({savedIds.length})
        </label>
      </FilterGroup>
      <FilterGroup title="Payment & Price" initiallyOpen>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">Minimum ($)</label>
            <Input
              className="h-9"
              type="number"
              min={0}
              placeholder="Any"
              value={filters.priceMin ?? ""}
              onChange={(e) => update({ priceMin: parseNumber(e.target.value) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">Maximum ($)</label>
            <Input
              className="h-9"
              type="number"
              min={0}
              placeholder="Any"
              value={filters.priceMax ?? ""}
              onChange={(e) => update({ priceMax: parseNumber(e.target.value) })}
            />
          </div>
        </div>
        <p className="text-[11px] leading-4 text-muted-foreground">
          Monthly payments depend on loan terms, taxes, fees and credit approval. No unverified payment estimates are
          displayed.
        </p>
      </FilterGroup>
      <FilterGroup title="Make & Model" initiallyOpen>
        <Facet
          title="Make"
          options={makes}
          value={filters.make}
          change={(v) => update({ make: v, model: undefined })}
        />
        <Facet title="Model" options={models} value={filters.model} change={(v) => update({ model: v })} />
      </FilterGroup>
      <FilterGroup title="Body Type">
        <Facet title="Body type" options={bodies} value={filters.body} change={(v) => update({ body: v })} />
      </FilterGroup>
      <FilterGroup title="Year & Mileage">
        <div className="grid grid-cols-2 gap-2">
          <Facet
            title="Year from"
            options={years.map(String)}
            value={filters.yearMin?.toString()}
            change={(v) => update({ yearMin: parseNumber(v) })}
          />
          <Facet
            title="Year to"
            options={years.map(String)}
            value={filters.yearMax?.toString()}
            change={(v) => update({ yearMax: parseNumber(v) })}
          />
        </div>
        <Facet
          title="Mileage"
          options={MILEAGE.map(String)}
          value={filters.mileageMax?.toString()}
          change={(v) => update({ mileageMax: parseNumber(v) })}
        />
      </FilterGroup>
      <FilterGroup title="Fuel Type">
        <Facet title="Fuel" options={fuels} value={filters.fuel} change={(v) => update({ fuel: v })} />
      </FilterGroup>
      <FilterGroup title="MPG">
        <label className="text-xs">Minimum combined MPG</label>
        <Input
          className="h-9"
          type="number"
          min={1}
          value={filters.mpgMin ?? ""}
          onChange={(e) => update({ mpgMin: parseNumber(e.target.value) })}
        />
      </FilterGroup>
      <FilterGroup title="Exterior Color">
        <Facet title="Exterior color" options={colors} value={filters.color} change={(v) => update({ color: v })} />
      </FilterGroup>
      {drivetrains.length > 0 && (
        <FilterGroup title="Drivetrain">
          <Facet
            title="Drivetrain"
            options={drivetrains}
            value={filters.drivetrain}
            change={(v) => update({ drivetrain: v })}
          />
        </FilterGroup>
      )}
    </>
  );
  return (
    <div className="mx-auto max-w-[1536px] px-3 pb-16 pt-5 sm:px-5 lg:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
            Used Cars for Sale in Fredericksburg, VA
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Shop current My Car inventory, compare prices and explore your next vehicle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/sell">
              Sell / Trade <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/finance">Financing</Link>
          </Button>
        </div>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden max-h-[calc(100vh-100px)] space-y-1 overflow-y-auto rounded-lg border border-border bg-card p-4 lg:sticky lg:top-20 lg:block">
          {filterUI}
        </aside>
        <main className="min-w-0">
          <div className="rounded-lg bg-blue-50 p-3 sm:p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search cars"
                value={filters.q || ""}
                onChange={(e) => update({ q: e.target.value || undefined })}
                placeholder="Search make, model, year, VIN or keyword"
                className="h-11 border-blue-100 bg-white pl-10"
              />
              {filters.q && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => update({ q: undefined })}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="my-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{isLoading ? "Loading vehicles…" : `${integer(filtered.length)} vehicles found`}</span>
            <div className="flex items-center gap-2">
              <Button className="lg:hidden" variant="outline" size="sm" onClick={() => setMobileFilters(true)}>
                <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                Filters {count ? `(${count})` : ""}
              </Button>
              <span className="hidden sm:inline">Sort by</span>
              <Select
                value={filters.sort || "recommended"}
                onValueChange={(value) => update({ sort: value === "recommended" ? undefined : value })}
              >
                <SelectTrigger className="h-9 w-[165px] bg-background text-xs sm:w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {priceDrops > 0 && (
            <button
              type="button"
              onClick={() => update({ deal: filters.deal === "price-drop" ? undefined : "price-drop" })}
              className="mb-4 flex w-full items-center justify-between overflow-hidden rounded-lg bg-[#f2f5f8] px-4 py-4 text-left hover:bg-blue-50 sm:px-5"
            >
              <div>
                <p className="text-sm font-extrabold text-slate-900 sm:text-base">
                  We've lowered prices to give you more savings!
                </p>
                <p className="mt-1 text-xs text-blue-600">
                  Shop {priceDrops} vehicles with verified price reductions <ArrowRight className="inline h-3 w-3" />
                </p>
              </div>
              <div className="ml-3 rounded-full bg-emerald-600 p-3 text-white">
                <ArrowDown className="h-6 w-6" />
              </div>
            </button>
          )}
          {count > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Active filters:</span>
              {FILTER_FIELDS.filter((k) => filters[k] != null && filters[k] !== "").map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => update({ [key]: undefined })}
                  className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[11px] text-blue-800"
                >
                  {key}: {String(filters[key])}
                  <X className="h-3 w-3" />
                </button>
              ))}
              {onlySaved && (
                <button onClick={() => setOnlySaved(false)} className="rounded-full border px-2 py-1 text-[11px]">
                  Saved <X className="inline h-3 w-3" />
                </button>
              )}
            </div>
          )}
          {isError ? (
            <div className="rounded-lg border border-destructive/30 bg-card p-10 text-center">
              <h2 className="font-bold">Unable to load inventory</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Please refresh the page or contact My Car for assistance.
              </p>
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-[320px] animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : displayed.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <CarFront className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h2 className="font-bold">No vehicles match your search</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Try changing your filters or ask us to help find a vehicle.
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
              {displayed.flatMap((vehicle, i) => {
                const absolute = (page - 1) * PAGE_SIZE + i + 1;
                const elements = [<VehicleCard key={`vehicle-${vehicle.id}`} vehicle={vehicle} settings={settings} />];
                // Insert a conversion card in one vehicle-sized grid slot, after selected vehicles.
                if (absolute === 6) elements.push(<Promotion key="promo-finance" type="finance" />);
                if (absolute === 15) elements.push(<Promotion key="promo-trade" type="trade" />);
                if (absolute === 23) elements.push(<Promotion key="promo-deals" type="deals" />);
                if (absolute === 31) elements.push(<Promotion key="promo-schedule" type="schedule" />);
                return elements;
              })}
            </div>
          )}
          {!isLoading && filtered.length > PAGE_SIZE && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => goPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: pages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2)
                .map((n) => (
                  <Button key={n} size="sm" variant={n === page ? "default" : "outline"} onClick={() => goPage(n)}>
                    {n}
                  </Button>
                ))}
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => goPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </main>
      </div>
      <section className="mt-16 rounded-xl bg-muted/50 px-5 py-8 sm:px-8">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <h2 className="text-lg font-bold">Used car shopping at My Car</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Browse available vehicles in Fredericksburg, VA. Compare vehicle pricing, mileage and photos, then contact
              our team or schedule your visit.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Link to="/finance" className="text-primary hover:underline">
              Financing options →
            </Link>
            <Link to="/sell" className="text-primary hover:underline">
              Sell or trade →
            </Link>
            <Link to="/schedule" className="text-primary hover:underline">
              Schedule a visit →
            </Link>
            <Link to="/contact" className="text-primary hover:underline">
              Contact My Car →
            </Link>
          </div>
        </div>
      </section>
      <section className="mt-10 text-center">
        <h2 className="font-bold">Browse available vehicles</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Explore vehicles by type or make using your current My Car inventory.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {bodies.slice(0, 6).map((body) => (
            <button
              key={body}
              className="rounded-full border px-4 py-2 text-xs hover:border-primary hover:text-primary"
              onClick={() => {
                update({ body });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              {body}
            </button>
          ))}
        </div>
      </section>
      {mobileFilters && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 lg:hidden"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMobileFilters(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Vehicle filters"
            className="absolute inset-y-0 left-0 flex w-[min(90vw,380px)] flex-col bg-background shadow-2xl"
          >
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="font-bold">Filters</h2>
              <button onClick={() => setMobileFilters(false)} aria-label="Close filters">
                <X />
              </button>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto p-4">{filterUI}</div>
            <div className="border-t p-4">
              <Button className="w-full" onClick={() => setMobileFilters(false)}>
                Show {integer(filtered.length)} Vehicles
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
