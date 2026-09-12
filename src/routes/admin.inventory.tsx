import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, SlidersHorizontal, Upload, X } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/app-client";
import { useAuth } from "@/hooks/useAuth";
import { formatMiles, formatUsd, vehicleTitle } from "@/lib/format";
import { type Vehicle } from "@/lib/admin-inventory";
import { CsvImportDialog } from "@/components/admin/CsvImportDialog";
import { VehicleFormDialog, BODY_STYLES, STATUSES } from "@/components/admin/VehicleFormDialog";
import { listLegacyInventoryRows } from "@/lib/legacy-inventory.functions";
import { deleteLegacyInventoryRow } from "@/lib/legacy-inventory.functions";
import type { Database } from "@/integrations/supabase/types";

type VehicleStatus = Database["public"]["Enums"]["vehicle_status"];
type Row = Vehicle & { vehicle_photos: { url: string; position: number }[] };

export const Route = createFileRoute("/admin/inventory")({
  component: AdminInventory,
});

const PAGE_SIZE = 25;

const SORTS = [
  { value: "newest", label: "Newest added" },
  { value: "oldest", label: "Oldest added" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "year-desc", label: "Year: newest" },
  { value: "mileage-asc", label: "Mileage: lowest" },
];

function AdminInventory() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [make, setMake] = useState("all");
  const [year, setYear] = useState("all");
  const [body, setBody] = useState("all");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Vehicle | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "vehicles"],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      const rows = await listLegacyInventoryRows({ data: { accessToken } });
      return rows as Row[];
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "vehicles"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard", "vehicles"] });
    void queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    void queryClient.invalidateQueries({ queryKey: ["facets"] });
  };

  const makes = useMemo(
    () => Array.from(new Set((data ?? []).map((v) => v.make))).sort(),
    [data],
  );
  const years = useMemo(
    () => Array.from(new Set((data ?? []).map((v) => v.year))).sort((a, b) => b - a),
    [data],
  );
  const priceBounds = useMemo(() => {
    const prices = (data ?? []).map((v) => Number(v.price_cents) / 100).filter((price) => price > 0);
    if (prices.length === 0) return { min: 0, max: 0 };
    return {
      min: Math.floor(Math.min(...prices) / 1000) * 1000,
      max: Math.ceil(Math.max(...prices) / 1000) * 1000,
    };
  }, [data]);

  useEffect(() => {
    setPriceRange([priceBounds.min, priceBounds.max]);
  }, [priceBounds.min, priceBounds.max]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = (data ?? []).filter((v) => {
      if (status !== "all" && v.status !== status) return false;
      if (make !== "all" && v.make !== make) return false;
      if (year !== "all" && String(v.year) !== year) return false;
      if (body !== "all" && v.body_style !== body) return false;
      const price = Number(v.price_cents) / 100;
      if (priceBounds.max > 0 && (price < priceRange[0] || price > priceRange[1])) return false;
      if (!needle) return true;
      return [v.vin, v.stock_number, v.make, v.model, v.trim ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return a.date_received.localeCompare(b.date_received);
        case "price-desc":
          return Number(b.price_cents) - Number(a.price_cents);
        case "price-asc":
          return Number(a.price_cents) - Number(b.price_cents);
        case "year-desc":
          return b.year - a.year;
        case "mileage-asc":
          return a.mileage - b.mileage;
        default:
          return b.date_received.localeCompare(a.date_received);
      }
    });
    return rows;
  }, [data, q, status, make, year, body, sort, priceBounds.max, priceRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const hasActiveFilters =
    Boolean(q.trim()) ||
    status !== "all" ||
    make !== "all" ||
    year !== "all" ||
    body !== "all" ||
    (priceBounds.max > 0 && (priceRange[0] !== priceBounds.min || priceRange[1] !== priceBounds.max));

  function resetFilters() {
    setQ("");
    setStatus("all");
    setMake("all");
    setYear("all");
    setBody("all");
    setPriceRange([priceBounds.min, priceBounds.max]);
    setPage(1);
  }

  async function update(id: string, patch: Partial<Vehicle>) {
    const { error } = await supabase.from("vehicles").update(patch).eq("id", id);
    if (error) {
      toast.error("Could not update this vehicle.");
      return;
    }
    refresh();
    toast.success("Vehicle updated.");
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const match = /^LEGACY-(\d+)$/i.exec(toDelete.stock_number);
      if (!match) throw new Error("This vehicle is not linked to a legacy inventory record.");
      if (!accessToken) throw new Error("Your session has expired. Please sign in again.");
      await deleteLegacyInventoryRow({
        data: { accessToken, legacyId: Number(match[1]), publicId: toDelete.id },
      });
      toast.success("Vehicle deleted.");
      setToDelete(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete this vehicle.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="w-full">
      <AdminPageHeader
        title="Car Listings"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" /> Import CSV
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" /> Add vehicle
            </Button>
          </>
        }
      />

      <div className="p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Inventory</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-foreground">All cars</h2>
            <p className="mt-1 text-sm text-muted-foreground">{filtered.length} matching vehicles</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="admin-search"
                className="h-10 rounded-lg bg-background pl-9"
                placeholder="Search make, model, VIN..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-10 w-full rounded-lg bg-background sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <details className="group rounded-xl border border-border bg-background lg:contents" open>
            <summary className="flex cursor-pointer list-none items-center justify-between p-4 font-semibold lg:hidden">
              <span className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-[#F7941D]" /> Filters</span>
              <span className="text-xs font-normal text-muted-foreground">{hasActiveFilters ? "Active" : "All vehicles"}</span>
            </summary>
            <aside className="space-y-5 rounded-xl border border-border bg-background p-4 group-open:block lg:block">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Filters</h3>
                {hasActiveFilters && <button type="button" onClick={resetFilters} className="text-xs font-semibold text-[#F7941D] hover:underline">Clear all</button>}
              </div>
              <div className="space-y-4">
                <Filter label="Status" value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={STATUSES} />
                <Filter label="Make" value={make} onChange={(value) => { setMake(value); setPage(1); }} options={makes} />
                <Filter label="Year" value={year} onChange={(value) => { setYear(value); setPage(1); }} options={years.map((y) => String(y))} />
                <Filter label="Body style" value={body} onChange={(value) => { setBody(value); setPage(1); }} options={BODY_STYLES} />
              </div>
              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="price-range">Price</Label>
                  <span className="text-xs font-medium text-muted-foreground">{formatUsd(priceRange[0] * 100)} - {formatUsd(priceRange[1] * 100)}</span>
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
                    setPage(1);
                  }}
                  disabled={priceBounds.max <= priceBounds.min}
                  aria-label="Filter by price range"
                  className="py-2 [&_[data-orientation=horizontal]]:bg-[#F7941D]/20 [&_[data-orientation=horizontal]_span]:bg-[#F7941D] [&_[role=slider]]:border-[#F7941D] [&_[role=slider]]:focus-visible:ring-[#F7941D]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input aria-label="Minimum price" type="number" min={priceBounds.min} max={priceRange[1]} step={1000} value={priceRange[0]} onChange={(e) => setPriceRange([Math.min(Number(e.target.value) || priceBounds.min, priceRange[1]), priceRange[1]])} className="h-9 rounded-lg text-xs" />
                  <Input aria-label="Maximum price" type="number" min={priceRange[0]} max={priceBounds.max} step={1000} value={priceRange[1]} onChange={(e) => setPriceRange([priceRange[0], Math.max(Number(e.target.value) || priceBounds.max, priceRange[0])])} className="h-9 rounded-lg text-xs" />
                </div>
              </div>
              {hasActiveFilters && <div className="flex flex-wrap gap-2 border-t border-border pt-4"><button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 rounded-full bg-[#F7941D]/10 px-2.5 py-1 text-xs font-semibold text-[#b76508]">Reset filters <X className="size-3" /></button></div>}
            </aside>
          </details>

          <div className="min-w-0">
        {isLoading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : error ? (
        <p className="mt-6 rounded-lg border border-destructive/40 bg-background p-6 text-sm">
          Couldn't load inventory. Refresh to try again.
        </p>
      ) : filtered.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-background p-10 text-center">
          <p className="font-medium">No vehicles match</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Adjust the filters, add a vehicle, or import your inventory file.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((v) => {
            const photo = [...(v.vehicle_photos ?? [])].sort((a, b) => a.position - b.position)[0];
            const title = vehicleTitle(v);
            const statusClasses = {
              available: "bg-emerald-100 text-emerald-700",
              sold: "bg-slate-200 text-slate-700",
              pending: "bg-amber-100 text-amber-700",
              reserved: "bg-blue-100 text-blue-700",
            } as const;

            return (
              <article key={v.id} className="group overflow-hidden rounded-xl border border-border bg-background shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#F7941D]/60 hover:shadow-md">
                <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                  {photo ? (
                    <img src={photo.url} alt={title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No photo available</div>
                  )}
                  <span className={`absolute left-3 top-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClasses[v.status as keyof typeof statusClasses] ?? "bg-muted text-muted-foreground"}`}>
                    {v.status}
                  </span>
                </div>
                <div className="space-y-4 p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{v.year} {v.make}</p>
                    <h3 className="mt-1 line-clamp-2 font-display text-lg font-bold text-foreground">{v.model}{v.trim ? ` ${v.trim}` : ""}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{v.body_style} · {formatMiles(v.mileage)}</p>
                  </div>
                  <div className="flex items-end justify-between gap-3 border-t border-border pt-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Price</p>
                      <p className="font-display text-xl font-bold text-foreground">{formatUsd(Number(v.price_cents))}</p>
                    </div>
                    <Button size="sm" className="rounded-md border border-[#F7941D] bg-[#F7941D] font-semibold text-slate-950 shadow-sm hover:border-[#ea8718] hover:bg-[#ea8718]" onClick={() => { setEditing(v); setFormOpen(true); }}>
                      Edit vehicle
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

        {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" disabled={current <= 1} onClick={() => setPage(current - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {current} of {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={current >= totalPages}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </div>
      )}

        <VehicleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        vehicle={editing}
        onSaved={refresh}
        onDelete={() => {
          if (editing) setToDelete(editing);
          setFormOpen(false);
        }}
      />
        <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={refresh} />

        <AlertDialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this vehicle?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this vehicle? This action cannot be undone.
              {toDelete && (
                <span className="mt-3 block font-medium text-foreground">
                  {toDelete.year} {toDelete.make} {toDelete.model}
                  <span className="block font-mono text-xs">{toDelete.vin}</span>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              Delete vehicle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>
      </div>
      </div>
    </div>
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o} className="capitalize">
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
