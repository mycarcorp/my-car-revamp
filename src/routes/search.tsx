import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VehicleCard } from "@/components/VehicleCard";
import { PAGE_SIZE, facetsQuery, siteSettingsQuery, vehicleSearchQuery, type SearchFilters } from "@/lib/queries";

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
  const { data: facets } = useQuery(facetsQuery());
  const { data: settings } = useQuery(siteSettingsQuery());
  const { data, isLoading } = useQuery(vehicleSearchQuery(params as SearchFilters));

  const set = (patch: Partial<SearchParams>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, page: undefined }) });

  const activeCount = Object.entries(params).filter(
    ([k, v]) => v !== undefined && k !== "sort" && k !== "page",
  ).length;

  const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;
  const page = params.page ?? 1;

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Used vehicle inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading ? "Loading inventory…" : `${data?.count ?? 0} vehicles match your filters`}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="priceMin">Min price</Label>
              <Input
                id="priceMin"
                type="number"
                defaultValue={params.priceMin ?? ""}
                onBlur={(e) => set({ priceMin: Number(e.target.value) || undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priceMax">Max price</Label>
              <Input
                id="priceMax"
                type="number"
                defaultValue={params.priceMax ?? ""}
                onBlur={(e) => set({ priceMax: Number(e.target.value) || undefined })}
              />
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

          <div className="space-y-2">
            <Label>Deals</Label>
            <Select
              value={params.deal ?? "any"}
              onValueChange={(v) => set({ deal: v === "any" ? undefined : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="price-drop">Recent price drops</SelectItem>
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
          ) : (data?.vehicles.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <h2 className="font-display text-xl font-semibold">No matches</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Nothing in stock fits every filter right now. Try widening the price or mileage
                range, or tell us what you're after and we'll source it.
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
                {data?.vehicles.map((v) => (
                  <VehicleCard key={v.id} vehicle={v} settings={settings} />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => navigate({ search: (p) => ({ ...p, page: page - 1 }) })}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => navigate({ search: (p) => ({ ...p, page: page + 1 }) })}
                  >
                    Next
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
