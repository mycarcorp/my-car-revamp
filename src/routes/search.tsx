import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Banknote, Handshake, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VehicleCard } from "@/components/VehicleCard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/app-client";
import { formatUsd } from "@/lib/format";
import { allVehiclesQuery, facetsQuery, siteSettingsQuery, type VehicleWithPhotos } from "@/lib/queries";

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
      { title: "Used Car Inventory — MyCar Fredericksburg, VA" },
      {
        name: "description",
        content:
          "Filter MyCar's live used vehicle inventory by price, monthly payment, make, body style, mileage, fuel type and drivetrain.",
      },
      { property: "og:title", content: "Used Car Inventory — MyCar Fredericksburg" },
      {
        property: "og:description",
        content: "Filter live used vehicle inventory by price, payment, make, body style and more.",
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

function SearchPage() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const { user } = useAuth();
  const { data: facets } = useQuery(facetsQuery());
  const { data: settings } = useQuery(siteSettingsQuery());
  const { data: allVehicles = [], isLoading } = useQuery(allVehiclesQuery());
  const { data: inventoryPrices = [] } = useQuery({
    queryKey: ["search", "price-bounds"],
    queryFn: async () => {
      const { data: rows, error } = await supabase.from("vehicles").select("price_cents").eq("status", "available");

      if (error) throw error;
      return rows ?? [];
    },
  });

  const priceBounds = useMemo(() => {
    const prices = inventoryPrices
      .map((vehicle) => Number(vehicle.price_cents) / 100)
      .filter((price) => Number.isFinite(price) && price > 0);

    if (prices.length === 0) return { min: 0, max: 0 };

    return {
      min: Math.floor(Math.min(...prices) / 1000) * 1000,
      max: Math.ceil(Math.max(...prices) / 1000) * 1000,
    };
  }, [inventoryPrices]);

  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const priceFilterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (priceBounds.max <= 0) return;

    const minimum = Math.max(priceBounds.min, Math.min(params.priceMin ?? priceBounds.min, priceBounds.max));
    const maximum = Math.max(minimum, Math.min(params.priceMax ?? priceBounds.max, priceBounds.max));
    setPriceRange([minimum, maximum]);
  }, [params.priceMax, params.priceMin, priceBounds.max, priceBounds.min]);

  const set = (patch: Partial<SearchParams>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, page: undefined }) });

  const commitPriceRange = (range: [number, number]) => {
    set({
      priceMin: range[0] === priceBounds.min ? undefined : range[0],
      priceMax: range[1] === priceBounds.max ? undefined : range[1],
    });
  };

  const schedulePriceRangeFilter = (range: [number, number]) => {
    if (priceFilterTimerRef.current) clearTimeout(priceFilterTimerRef.current);

    priceFilterTimerRef.current = setTimeout(() => {
      commitPriceRange(range);
      priceFilterTimerRef.current = null;
    }, 120);
  };

  useEffect(
    () => () => {
      if (priceFilterTimerRef.current) clearTimeout(priceFilterTimerRef.current);
    },
    [],
  );

  const activeCount = Object.entries(params).filter(([k, v]) => v !== undefined && k !== "sort" && k !== "page").length;

  const sortVehicles = (list: VehicleWithPhotos[]) => {
    const rows = [...list];
    switch (params.sort) {
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
          (a, b) => Number(b.is_featured) - Number(a.is_featured) || String(b.date_received).localeCompare(String(a.date_received)),
        );
    }
  };

  /** Every active filter must be satisfied. */
  const matchesFilters = (v: VehicleWithPhotos) => {
    const eq = (a?: string | null, b?: string) => !b || (!!a && a.toLowerCase() === b.toLowerCase());
    const price = Number(v.price_cents) / 100;
    if (params.q) {
      const haystack = `${v.year} ${v.make} ${v.model} ${v.trim ?? ""}`.toLowerCase();
      const words = params.q.toLowerCase().split(/\s+/).filter(Boolean);
      if (!words.every((word) => haystack.includes(word))) return false;
    }
    if (!eq(v.make, params.make)) return false;
    if (!eq(v.model, params.model)) return false;
    if (!eq(v.body_style, params.body)) return false;
    if (!eq(v.fuel_type, params.fuel)) return false;
    if (!eq(v.exterior_color, params.color)) return false;
    if (params.priceMin && price < params.priceMin) return false;
    if (params.priceMax && price > params.priceMax) return false;
    if (params.yearMin && v.year < params.yearMin) return false;
    if (params.yearMax && v.year > params.yearMax) return false;
    if (params.mileageMax && (v.mileage ?? 0) > params.mileageMax) return false;
    if (params.mpgMin && (v.mpg_combined ?? 0) < params.mpgMin) return false;
    if (params.deal === "price-drop" && v.prior_price_cents == null) return false;
    return true;
  };

  const liveVehicles = useMemo(
    () => allVehicles.filter((v) => v.status === "available" || v.status === "pending"),
    [allVehicles],
  );

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const v of liveVehicles) if (v.year) set.add(v.year);
    return [...set].sort((a, b) => b - a);
  }, [liveVehicles]);

  const allSorted = useMemo(
    () => sortVehicles(liveVehicles.filter(matchesFilters)),
    [liveVehicles, params],
  );

  const [shown, setShown] = useState(24);

  useEffect(() => {
    setShown(24);
  }, [params]);

  const visible = allSorted.slice(0, shown);
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
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome back, {displayName}!
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Here are a few ways to keep moving toward your next vehicle.
            </p>
          </div>
          <div className="grid gap-px bg-border md:grid-cols-3">
            <Link
              to="/search"
              search={{ deal: "price-drop" }}
              className="group bg-card p-5 transition-colors hover:bg-muted/50"
            >
              <Search className="size-5 text-primary" />
              <h2 className="mt-4 font-display text-lg font-semibold">Suggested deals</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">See vehicles with recent price drops.</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                Browse deals <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
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
          <h1 className="font-display text-3xl font-bold">Used vehicle inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? "Loading inventory…"
              : activeCount > 0
                ? `${matching.length} vehicles close to what you're looking for · ${allSorted.length} total in stock`
                : `${allSorted.length} vehicles in stock`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          <Select
            value={params.sort ?? "recommended"}
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
        <aside className="space-y-5 rounded-xl border border-border bg-card p-5 lg:sticky lg:top-24 lg:self-start">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Filters</h2>
            {activeCount > 0 && (
              <button
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary"
                onClick={() => navigate({ search: {} })}
              >
                <X className="size-3" /> Clear all
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="q">Keyword</Label>
            <Input
              id="q"
              defaultValue={params.q ?? ""}
              placeholder="Make, model or trim"
              onBlur={(e) => set({ q: e.target.value || undefined })}
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
                const ordered = next[0] <= next[1] ? next : ([next[1], next[1]] as [number, number]);
                setPriceRange(ordered);
                schedulePriceRangeFilter(ordered);
              }}
              onValueCommit={(value) => {
                const next = value as [number, number];
                const ordered = next[0] <= next[1] ? next : ([next[1], next[1]] as [number, number]);
                if (priceFilterTimerRef.current) clearTimeout(priceFilterTimerRef.current);
                priceFilterTimerRef.current = null;
                commitPriceRange(ordered);
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
                  onBlur={() => commitPriceRange(priceRange)}
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
                  onBlur={() => commitPriceRange(priceRange)}
                  className="h-9 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>

          <FacetSelect
            label="Make"
            value={params.make}
            options={facets?.makes ?? []}
            onChange={(v) => set({ make: v, model: undefined })}
          />
          <FacetSelect
            label="Model"
            value={params.model}
            options={facets?.models ?? []}
            onChange={(v) => set({ model: v })}
          />
          <FacetSelect
            label="Body type"
            value={params.body}
            options={facets?.bodies ?? []}
            onChange={(v) => set({ body: v })}
          />
          <FacetSelect
            label="Fuel type"
            value={params.fuel}
            options={facets?.fuels ?? []}
            onChange={(v) => set({ fuel: v })}
          />
          <FacetSelect
            label="Drivetrain"
            value={params.drivetrain}
            options={facets?.drivetrains ?? []}
            onChange={(v) => set({ drivetrain: v })}
          />
          <FacetSelect
            label="Exterior color"
            value={params.color}
            options={facets?.colors ?? []}
            onChange={(v) => set({ color: v })}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="yearMin">Year from</Label>
              <Input
                id="yearMin"
                type="number"
                defaultValue={params.yearMin ?? ""}
                onBlur={(e) => set({ yearMin: Number(e.target.value) || undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yearMax">Year to</Label>
              <Input
                id="yearMax"
                type="number"
                defaultValue={params.yearMax ?? ""}
                onBlur={(e) => set({ yearMax: Number(e.target.value) || undefined })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Max mileage</Label>
            <Select
              value={params.mileageMax ? String(params.mileageMax) : "any"}
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
                <Button variant="outline" onClick={() => navigate({ search: {} })}>
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
              {activeList.length > visible.length && (
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
