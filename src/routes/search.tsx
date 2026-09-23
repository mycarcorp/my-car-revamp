import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Banknote, Handshake, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VehicleCard } from "@/components/VehicleCard";
import { useAuth } from "@/hooks/useAuth";
import { formatUsd } from "@/lib/format";
import { allVehiclesQuery, siteSettingsQuery, type VehicleWithPhotos } from "@/lib/queries";

type SearchParams = {
  q?: string | undefined;
  make?: string | undefined;
  model?: string | undefined;
  body?: string | undefined;
  fuel?: string | undefined;
  drivetrain?: string | undefined;
  color?: string | undefined;
  priceMin?: number | undefined;
  priceMax?: number | undefined;
  yearMin?: number | undefined;
  yearMax?: number | undefined;
  mileageMax?: number | undefined;
  mpgMin?: number | undefined;
  deal?: string | undefined;
  sort?: string | undefined;
  page?: number | undefined;
};

const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : undefined);
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export const Route = createFileRoute("/search")({
  validateSearch: (raw: Record<string, unknown>): SearchParams => ({
    q: str(raw["q"]),
    make: str(raw["make"]),
    model: str(raw["model"]),
    body: str(raw["body"]),
    fuel: str(raw["fuel"]),
    drivetrain: str(raw["drivetrain"]),
    color: str(raw["color"]),
    priceMin: num(raw["priceMin"]),
    priceMax: num(raw["priceMax"]),
    yearMin: num(raw["yearMin"]),
    yearMax: num(raw["yearMax"]),
    mileageMax: num(raw["mileageMax"]),
    mpgMin: num(raw["mpgMin"]),
    deal: str(raw["deal"]),
    sort: str(raw["sort"]),
    page: num(raw["page"]),
  }),
  head: () => ({
    meta: [
      {
        title: "Used Cars for Sale in Fredericksburg, VA | My Car",
      },
      {
        name: "description",
        content:
          "Shop used cars, trucks and SUVs for sale in Fredericksburg, VA at My Car. Browse current inventory, compare vehicles, estimate payments and schedule a test drive.",
      },
      {
        property: "og:title",
        content: "Used Cars for Sale in Fredericksburg, VA | My Car",
      },
      {
        property: "og:description",
        content:
          "Shop used cars, trucks and SUVs for sale in Fredericksburg, VA at My Car. Browse current inventory, compare vehicles, estimate payments and schedule a test drive.",
      },
      {
        property: "og:url",
        content: "https://mycarcorp.com/search",
      },
      {
        property: "og:type",
        content: "website",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://mycarcorp.com/search",
      },
    ],
  }),
  component: SearchPage,
});

const MILEAGE_BUCKETS = [10000, 30000, 50000, 75000, 100000];
const SORTS = [
  { value: "recommended", label: "Recommended" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "mileage-asc", label: "Mileage: low to high" },
  { value: "newest", label: "Year: newest first" },
  { value: "oldest", label: "Year: oldest first" },
];

const FILTER_KEYS = [
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
] as const;

const clean = (f: SearchParams): SearchParams => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    if (v !== undefined && v !== "" && k !== "page") out[k] = v;
  }
  return out as SearchParams;
};

const signature = (f: SearchParams) => JSON.stringify(clean(f), Object.keys(clean(f)).sort());

function SearchPage() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const { user } = useAuth();
  const { data: settings } = useQuery(siteSettingsQuery());
  const { data: allVehicles = [], isLoading } = useQuery(allVehiclesQuery());

  /* Filters live in local state so every change is applied instantly; the URL is
     synced afterwards (debounced, replace) purely so links stay shareable. */
  const [filters, setFilters] = useState<SearchParams>(params);
  const lastPushed = useRef(signature(params));
  const urlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adopt external URL changes (shared links, in-app links like deal=price-drop).
  useEffect(() => {
    const incoming = signature(params);
    if (incoming !== lastPushed.current) {
      lastPushed.current = incoming;
      setFilters(params);
    }
  }, [params]);

  useEffect(() => {
    const next = signature(filters);
    if (next === lastPushed.current) return;
    if (urlTimer.current) clearTimeout(urlTimer.current);
    urlTimer.current = setTimeout(() => {
      lastPushed.current = next;
      void navigate({ search: () => clean(filters), replace: true, resetScroll: false });
    }, 350);
    return () => {
      if (urlTimer.current) clearTimeout(urlTimer.current);
    };
  }, [filters, navigate]);

  const set = useCallback((patch: Partial<SearchParams>) => {
    setFilters((prev) => ({ ...prev, ...patch, page: undefined }));
  }, []);

  const clearAll = useCallback(() => setFilters({}), []);

  const liveVehicles = useMemo(
    () => allVehicles.filter((v) => v.status === "available" || v.status === "pending"),
    [allVehicles],
  );

  /* Facets and price bounds come from the inventory already in memory — no extra
     network round trips while filtering. */
  const facets = useMemo(() => {
    const tally = (pick: (v: VehicleWithPhotos) => unknown) => {
      const map = new Map<string, number>();
      for (const v of liveVehicles) {
        const value = pick(v);
        if (typeof value === "string" && value) map.set(value, (map.get(value) ?? 0) + 1);
      }
      return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
    };
    return {
      makes: tally((v) => v.make),
      models: tally((v) => v.model),
      bodies: tally((v) => v.body_style),
      fuels: tally((v) => v.fuel_type),
      colors: tally((v) => v.exterior_color),
    };
  }, [liveVehicles]);

  const priceBounds = useMemo(() => {
    const prices = liveVehicles.map((v) => Number(v.price_cents) / 100).filter((p) => Number.isFinite(p) && p > 0);
    if (prices.length === 0) return { min: 0, max: 0 };
    return {
      min: Math.floor(Math.min(...prices) / 1000) * 1000,
      max: Math.ceil(Math.max(...prices) / 1000) * 1000,
    };
  }, [liveVehicles]);

  const priceRange = useMemo<[number, number]>(() => {
    if (priceBounds.max <= 0) return [0, 0];
    const minimum = Math.max(priceBounds.min, Math.min(filters.priceMin ?? priceBounds.min, priceBounds.max));
    const maximum = Math.max(minimum, Math.min(filters.priceMax ?? priceBounds.max, priceBounds.max));
    return [minimum, maximum];
  }, [filters.priceMax, filters.priceMin, priceBounds.max, priceBounds.min]);

  const setPriceRange = (range: [number, number]) =>
    set({
      priceMin: range[0] <= priceBounds.min ? undefined : range[0],
      priceMax: range[1] >= priceBounds.max ? undefined : range[1],
    });

  const activeCount = FILTER_KEYS.filter((k) => filters[k] !== undefined && filters[k] !== "").length;

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const v of liveVehicles) if (v.year) set.add(v.year);
    return [...set].sort((a, b) => b - a);
  }, [liveVehicles]);

  const allSorted = useMemo(() => {
    const eq = (a?: string | null, b?: string) => !b || (!!a && a.toLowerCase() === b.toLowerCase());
    const words = (filters.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);

    const matches = (v: VehicleWithPhotos) => {
      const price = Number(v.price_cents) / 100;
      if (words.length > 0) {
        const haystack = `${v.year} ${v.make} ${v.model} ${v.trim ?? ""} ${v.exterior_color ?? ""} ${
          v.body_style ?? ""
        } ${v.fuel_type ?? ""} ${v.vin ?? ""} ${v.stock_number ?? ""}`.toLowerCase();
        if (!words.every((w) => haystack.includes(w))) return false;
      }
      if (!eq(v.make, filters.make)) return false;
      if (!eq(v.model, filters.model)) return false;
      if (!eq(v.body_style, filters.body)) return false;
      if (!eq(v.fuel_type, filters.fuel)) return false;
      if (!eq(v.exterior_color, filters.color)) return false;
      if (filters.priceMin && price < filters.priceMin) return false;
      if (filters.priceMax && price > filters.priceMax) return false;
      if (filters.yearMin && v.year < filters.yearMin) return false;
      if (filters.yearMax && v.year > filters.yearMax) return false;
      if (filters.mileageMax && (v.mileage ?? 0) > filters.mileageMax) return false;
      if (filters.mpgMin && (v.mpg_combined ?? 0) < filters.mpgMin) return false;
      if (filters.deal === "price-drop" && v.prior_price_cents == null) return false;
      return true;
    };

    const rows = liveVehicles.filter(matches);
    switch (filters.sort) {
      case "price-asc":
        return rows.sort((a, b) => Number(a.price_cents) - Number(b.price_cents));
      case "price-desc":
        return rows.sort((a, b) => Number(b.price_cents) - Number(a.price_cents));
      case "mileage-asc":
        return rows.sort((a, b) => (a.mileage ?? 0) - (b.mileage ?? 0));
      case "newest":
        return rows.sort((a, b) => b.year - a.year);
      case "oldest":
        return rows.sort((a, b) => a.year - b.year);
      default:
        return rows.sort(
          (a, b) =>
            Number(b.is_featured) - Number(a.is_featured) ||
            String(b.date_received).localeCompare(String(a.date_received)),
        );
    }
  }, [liveVehicles, filters]);

  const [shown, setShown] = useState(24);
  const filterSignature = signature(filters);

  useEffect(() => {
    setShown(24);
  }, [filterSignature]);

  const visible = useMemo(() => allSorted.slice(0, shown), [allSorted, shown]);

  const displayName =
    String(user?.user_metadata?.["full_name"] ?? user?.user_metadata?.["name"] ?? "")
      .trim()
      .split(/\s+/)[0] ||
    user?.email?.split("@")[0] ||
    "there";

  const FacetSelect = ({
    label,
    value,
    options,
    onChange,
  }: {
    label: string;
    value?: string | undefined;
    options: { value: string; count: number }[];
    onChange: (v?: string) => void;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value ?? "any"} onValueChange={(v) => onChange(v === "any" ? undefined : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Any" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.value} ({o.count})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {user && (
        <section className="mb-10 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-surface px-5 py-6 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Your MyCar dashboard</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome back, {displayName}!
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Here are a few ways to keep moving toward your next vehicle.
            </p>
          </div>
          <div className="grid gap-px bg-border md:grid-cols-3">
            <button
              type="button"
              onClick={() => setFilters({ deal: "price-drop" })}
              className="group bg-card p-5 text-left transition-colors hover:bg-muted/50"
            >
              <Search className="size-5 text-primary" />
              <h2 className="mt-4 font-display text-lg font-semibold">Suggested deals</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">See vehicles with recent price drops.</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                Browse deals <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
            <Link to="/finance" className="group bg-card p-5 transition-colors hover:bg-muted/50">
              <Banknote className="size-5 text-primary" />
              <h2 className="mt-4 font-display text-lg font-semibold">Plan your payment</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Explore financing options for your budget.</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                Start a finance request <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
            <Link to="/sell" className="group bg-card p-5 transition-colors hover:bg-muted/50">
              <Handshake className="size-5 text-primary" />
              <h2 className="mt-4 font-display text-lg font-semibold">Sell or trade</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Get a real offer for your current vehicle.</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                Get your offer <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Used Cars for Sale in Fredericksburg, VA</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? "Loading inventory…"
              : activeCount > 0
                ? `${allSorted.length} vehicles match your filters`
                : `${allSorted.length} vehicles in stock`}
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            Shop My Car&apos;s current selection of used cars, trucks and SUVs in Fredericksburg, Virginia. Compare
            available vehicles, pricing, mileage and estimated monthly payments, then schedule a test drive or start a
            financing request online.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          <Select
            value={filters.sort ?? "recommended"}
            onValueChange={(v) => set({ sort: v === "recommended" ? undefined : v })}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-5 rounded-xl border border-border bg-card p-5 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Filters</h2>
            {activeCount > 0 && (
              <button
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary"
                onClick={clearAll}
              >
                <X className="size-3" /> Clear all
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="q">Keyword</Label>
            <Input
              id="q"
              value={filters.q ?? ""}
              placeholder="Make, model or trim"
              onChange={(e) => set({ q: e.target.value || undefined })}
            />
          </div>

          <div className="space-y-3 border-y border-border py-4">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="price-range">Price</Label>
              <span className="text-xs font-medium text-muted-foreground">
                {formatUsd(priceRange[0] * 100)} - {formatUsd(priceRange[1] * 100)}
              </span>
            </div>

            <Slider
              id="price-range"
              min={priceBounds.min}
              max={priceBounds.max || 1}
              step={1000}
              value={priceRange}
              onValueChange={(value) => {
                const next = value as [number, number];
                setPriceRange(next[0] <= next[1] ? next : [next[1], next[1]]);
              }}
              disabled={priceBounds.max <= priceBounds.min}
              aria-label="Filter by price range"
              className="py-2 [&_[data-orientation=horizontal]]:bg-[#F7941D]/20 [&_[data-orientation=horizontal]_span]:bg-[#F7941D] [&_[role=slider]]:border-[#F7941D] [&_[role=slider]]:focus-visible:ring-[#F7941D]"
            />

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="priceMin" className="text-xs text-muted-foreground">
                  Minimum
                </Label>
                <Input
                  id="priceMin"
                  aria-label="Minimum price"
                  type="number"
                  min={priceBounds.min}
                  max={priceRange[1]}
                  step={1000}
                  value={priceRange[0]}
                  onChange={(event) => {
                    const minimum = Math.min(
                      Math.max(Number(event.target.value) || priceBounds.min, priceBounds.min),
                      priceRange[1],
                    );
                    setPriceRange([minimum, priceRange[1]]);
                  }}
                  className="h-9 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="priceMax" className="text-xs text-muted-foreground">
                  Maximum
                </Label>
                <Input
                  id="priceMax"
                  aria-label="Maximum price"
                  type="number"
                  min={priceRange[0]}
                  max={priceBounds.max}
                  step={1000}
                  value={priceRange[1]}
                  onChange={(event) => {
                    const maximum = Math.max(
                      Math.min(Number(event.target.value) || priceBounds.max, priceBounds.max),
                      priceRange[0],
                    );
                    setPriceRange([priceRange[0], maximum]);
                  }}
                  className="h-9 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>

          <FacetSelect
            label="Make"
            value={filters.make}
            options={facets.makes}
            onChange={(v) => set({ make: v, model: undefined })}
          />
          <FacetSelect
            label="Model"
            value={filters.model}
            options={facets.models}
            onChange={(v) => set({ model: v })}
          />
          <FacetSelect
            label="Body type"
            value={filters.body}
            options={facets.bodies}
            onChange={(v) => set({ body: v })}
          />
          <FacetSelect
            label="Fuel type"
            value={filters.fuel}
            options={facets.fuels}
            onChange={(v) => set({ fuel: v })}
          />
          <FacetSelect
            label="Exterior color"
            value={filters.color}
            options={facets.colors}
            onChange={(v) => set({ color: v })}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Year from</Label>
              <Select
                value={filters.yearMin ? String(filters.yearMin) : "any"}
                onValueChange={(v) => set({ yearMin: v === "any" ? undefined : Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year to</Label>
              <Select
                value={filters.yearMax ? String(filters.yearMax) : "any"}
                onValueChange={(v) => set({ yearMax: v === "any" ? undefined : Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Max mileage</Label>
            <Select
              value={filters.mileageMax ? String(filters.mileageMax) : "any"}
              onValueChange={(v) => set({ mileageMax: v === "any" ? undefined : Number(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                {MILEAGE_BUCKETS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    Under {m.toLocaleString()} mi
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </aside>

        <section>
          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-72 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <h2 className="font-display text-xl font-semibold">No vehicles match those filters</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Try widening the price, year or mileage range — or tell us what you're after.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Button variant="outline" onClick={clearAll}>
                  Clear filters
                </Button>
                <Button asChild>
                  <Link to="/contact">Request a vehicle</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((v) => (
                  <VehicleCard key={v.id} vehicle={v} settings={settings} />
                ))}
              </div>
              {allSorted.length > visible.length && (
                <div className="mt-10 flex justify-center">
                  <Button variant="outline" onClick={() => setShown((n) => n + 24)}>
                    Show more vehicles
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
