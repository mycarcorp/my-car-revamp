import { useEffect, useMemo, useState } from "react";
import { descriptionToSafeHtml } from "@/lib/vehicle-description";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { isVideoUrl } from "@/lib/vehicle-media";

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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
type Row = Vehicle & {
  vehicle_photos: { url: string; position: number }[];
};

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
  const [viewing, setViewing] = useState<Row | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [failedPhotoUrls, setFailedPhotoUrls] = useState<string[]>([]);

  function openVehicleDetails(vehicle: Row) {
    setViewing(vehicle);
    setActivePhoto(0);
    setFailedPhotoUrls([]);
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "vehicles"],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      const rows = await listLegacyInventoryRows({
        data: { accessToken },
      });

      return rows as unknown as Row[];
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: ["admin", "vehicles"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["admin", "dashboard", "vehicles"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["vehicles"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["facets"],
    });
  };

  const makes = useMemo(() => Array.from(new Set((data ?? []).map((v) => v.make))).sort(), [data]);

  const years = useMemo(() => Array.from(new Set((data ?? []).map((v) => v.year))).sort((a, b) => b - a), [data]);

  const priceBounds = useMemo(() => {
    const prices = (data ?? []).map((v) => Number(v.price_cents) / 100).filter((price) => price > 0);

    if (prices.length === 0) {
      return { min: 0, max: 0 };
    }

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
      if (status !== "all" && v.status !== status) {
        return false;
      }

      if (make !== "all" && v.make !== make) {
        return false;
      }

      if (year !== "all" && String(v.year) !== year) {
        return false;
      }

      if (body !== "all" && v.body_style !== body) {
        return false;
      }

      const price = Number(v.price_cents) / 100;

      if (priceBounds.max > 0 && (price < priceRange[0] || price > priceRange[1])) {
        return false;
      }

      if (!needle) {
        return true;
      }

      /*
       * Main search now searches:
       * - Year
       * - VIN
       * - Stock number
       * - Make
       * - Model
       * - Trim
       */
      return [String(v.year), v.vin, v.stock_number, v.make, v.model, v.trim ?? ""]
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
    if (!toDelete) {
      return;
    }

    setDeleting(true);

    try {
      const match = /^LEGACY-(\d+)$/i.exec(toDelete.stock_number);

      if (!accessToken) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      await deleteLegacyInventoryRow({
        data: {
          accessToken,
          legacyId: match ? Number(match[1]) : null,
          publicId: toDelete.id,
          vin: toDelete.vin,
        },
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
              <Upload className="size-4" />
              Import CSV
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add vehicle
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
                placeholder="Search year, make, model, VIN..."
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
                {SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <details className="group rounded-xl border border-border bg-background lg:contents" open>
            <summary className="flex cursor-pointer list-none items-center justify-between p-4 font-semibold lg:hidden">
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-[#F7941D]" />
                Filters
              </span>

              <span className="text-xs font-normal text-muted-foreground">
                {hasActiveFilters ? "Active" : "All vehicles"}
              </span>
            </summary>

            <aside className="space-y-5 rounded-xl border border-border bg-background p-4 group-open:block lg:block">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Filters</h3>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-xs font-semibold text-[#F7941D] hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <Filter
                  label="Status"
                  value={status}
                  onChange={(value) => {
                    setStatus(value);
                    setPage(1);
                  }}
                  options={STATUSES}
                />

                <Filter
                  label="Make"
                  value={make}
                  onChange={(value) => {
                    setMake(value);
                    setPage(1);
                  }}
                  options={makes}
                />

                <Filter
                  label="Year"
                  value={year}
                  onChange={(value) => {
                    setYear(value);
                    setPage(1);
                  }}
                  options={years.map((y) => String(y))}
                />

                <Filter
                  label="Body style"
                  value={body}
                  onChange={(value) => {
                    setBody(value);
                    setPage(1);
                  }}

                  options={BODY_STYLES}
                />
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
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

                    setPage(1);
                  }}
                  disabled={priceBounds.max <= priceBounds.min}
                  aria-label="Filter by price range"
                  className="py-2 [&_[data-orientation=horizontal]]:bg-[#F7941D]/20 [&_[data-orientation=horizontal]_span]:bg-[#F7941D] [&_[role=slider]]:border-[#F7941D] [&_[role=slider]]:focus-visible:ring-[#F7941D]"
                />

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    aria-label="Minimum price"
                    type="number"
                    min={priceBounds.min}
                    max={priceRange[1]}
                    step={1000}
                    value={priceRange[0]}
                    onChange={(e) =>
                      setPriceRange([Math.min(Number(e.target.value) || priceBounds.min, priceRange[1]), priceRange[1]])
                    }
                    className="h-9 rounded-lg text-xs"
                  />

                  <Input
                    aria-label="Maximum price"
                    type="number"
                    min={priceRange[0]}
                    max={priceBounds.max}
                    step={1000}
                    value={priceRange[1]}
                    onChange={(e) =>
                      setPriceRange([priceRange[0], Math.max(Number(e.target.value) || priceBounds.max, priceRange[0])])
                    }
                    className="h-9 rounded-lg text-xs"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1 rounded-full bg-[#F7941D]/10 px-2.5 py-1 text-xs font-semibold text-[#b76508]"
                  >
                    Reset filters
                    <X className="size-3" />
                  </button>
                </div>
              )}
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
                {visible.map((v) => (
                  <AdminInventoryCard key={v.id} vehicle={v} onOpen={() => openVehicleDetails(v)} />
                ))}
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

                <Button variant="outline" disabled={current >= totalPages} onClick={() => setPage(current + 1)}>
                  Next
                </Button>
              </div>
            )}

            <AdminVehicleDetailsDialog
              vehicle={viewing}
              activePhoto={activePhoto}
              failedPhotoUrls={failedPhotoUrls}
              onActivePhotoChange={setActivePhoto}
              onPhotoError={(url) =>
                setFailedPhotoUrls((current) => (current.includes(url) ? current : [...current, url]))
              }

              onEdit={(vehicle) => {
                setViewing(null);
                setActivePhoto(0);
                setFailedPhotoUrls([]);
                setEditing(vehicle);
                setFormOpen(true);
              }}
              onDelete={(vehicle) => {
                setViewing(null);
                setActivePhoto(0);
                setFailedPhotoUrls([]);
                setToDelete(vehicle);
              }}
              onOpenChange={(open) => {
                if (!open) {
                  setViewing(null);
                  setActivePhoto(0);
                  setFailedPhotoUrls([]);
                }
              }}
            />

            <VehicleFormDialog open={formOpen} onOpenChange={setFormOpen} vehicle={editing} onSaved={refresh} />

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

/**
 * Admin card shares the public inventory's image-forward layout.
 * Image carousel controls never open the vehicle details dialog.
 * The carousel animates horizontally and wraps seamlessly via a cloned
 * first/last slide. It uses actual vehicle media, not sample photos.
 */
function AdminInventoryCard({ vehicle, onOpen }: { vehicle: Row; onOpen: () => void }) {
  const photos = useMemo(
    () =>
      [...(vehicle.vehicle_photos ?? [])]
        .sort((a, b) => a.position - b.position)
        .filter((media) => Boolean(media.url) && !isVideoUrl(media.url)),
    [vehicle.vehicle_photos],
  );
  const count = photos.length;
  const videoCount = (vehicle.vehicle_photos ?? []).filter((m) => isVideoUrl(m.url)).length;
  const hasCarousel = count > 1;
  const [slideIndex, setSlideIndex] = useState(1);
  const [animating, setAnimating] = useState(false);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);

  // Clone the edge slides so wraparound also slides in the expected direction.
  const slides = useMemo(() => {
    if (count <= 1) return photos;
    return [photos[count - 1]!, ...photos, photos[0]!];
  }, [photos, count]);
  const slidePosition = count <= 1 ? 0 : slideIndex;
  const activePhotoIndex = count <= 1 ? 0 : (slideIndex - 1 + count) % count;

  function movePhoto(direction: -1 | 1) {
    if (!hasCarousel || animating) return;
    setTransitionEnabled(true);
    setAnimating(true);
    setSlideIndex((position) => position + direction);
  }

  function finishSlide() {
    if (!animating || !hasCarousel) return;
    if (slideIndex === 0) {
      setTransitionEnabled(false);
      setSlideIndex(count);
    } else if (slideIndex === count + 1) {
      setTransitionEnabled(false);
      setSlideIndex(1);
    }
    setAnimating(false);
  }

  // After a clone-to-real snap, enable animation without animating the snap itself.
  useEffect(() => {
    if (transitionEnabled) return;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setTransitionEnabled(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [transitionEnabled]);

  const statusClasses: Record<string, string> = {
    available: "bg-emerald-100 text-emerald-700",
    sold: "bg-slate-200 text-slate-700",
    pending: "bg-amber-100 text-amber-700",
    reserved: "bg-blue-100 text-blue-700",
    draft: "bg-violet-100 text-violet-700",
  };
  const title = vehicleTitle(vehicle);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`View admin details for ${title}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#9ac1e6] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7941D] focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#f2f5f8]">
        {videoCount > 0 && (
          <span className="pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white">
            <Play className="size-3" /> {videoCount} video{videoCount === 1 ? "" : "s"}
          </span>
        )}
        {count > 0 ? (
          <div
            className="flex h-full w-full"
            style={{
              transform: `translate3d(-${slidePosition * 100}%, 0, 0)`,
              transition: transitionEnabled ? "transform 560ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
              willChange: "transform",
            }}
            onTransitionEnd={(event) => {
              if (event.target === event.currentTarget && event.propertyName === "transform") finishSlide();
            }}
          >
            {slides.map((photo, index) => (
              <div key={`${photo.url}-${index}`} className="flex h-full w-full shrink-0 items-center justify-center">
                {failed.includes(photo.url) ? (
                  <Camera className="size-12 text-slate-300" />
                ) : (
                  <img
                    src={photo.url}
                    alt={`${title} photo ${((index - (hasCarousel ? 1 : 0) + count) % count) + 1}`}
                    loading="lazy"
                    draggable={false}
                    onError={() => setFailed((old) => (old.includes(photo.url) ? old : [...old, photo.url]))}
                    className="h-full w-full select-none object-contain"
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-slate-400">
            <Camera className="size-6" /> No photo available
          </div>
        )}

        <span
          className={`absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 text-xs font-semibold capitalize shadow-sm ${statusClasses[vehicle.status] ?? "bg-slate-100 text-slate-700"}`}
        >
          {vehicle.status}
        </span>

        {hasCarousel && (
          <>
            <button
              type="button"
              aria-label={`Previous photo of ${title}`}
              onClick={(event) => {
                event.stopPropagation();
                movePhoto(-1);
              }}
              onKeyDown={(event) => event.stopPropagation()}
              disabled={animating}
              className="absolute left-2 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-800 shadow-md transition hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7941D] disabled:opacity-60"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label={`Next photo of ${title}`}
              onClick={(event) => {
                event.stopPropagation();
                movePhoto(1);
              }}
              onKeyDown={(event) => event.stopPropagation()}
              disabled={animating}
              className="absolute right-2 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-800 shadow-md transition hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7941D] disabled:opacity-60"
            >
              <ChevronRight className="size-5" />
            </button>
            <div
              aria-hidden="true"
              className="absolute bottom-2 left-1/2 z-10 flex max-w-[85%] -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1.5"
            >
              {Array.from({ length: Math.min(count, 7) }, (_, index) => (
                <span
                  key={index}
                  className={`size-1.5 rounded-full transition-colors ${activePhotoIndex === index ? "bg-[#F7941D]" : "bg-white/80"}`}
                />
              ))}
              {count > 7 && (
                <span className="text-[10px] text-white">
                  {activePhotoIndex + 1}/{count}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-sm font-bold text-[#173954] sm:text-[15px]">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">
          {vehicle.body_style} · {formatMiles(vehicle.mileage)}
        </p>
        <p className="mt-3 text-xl font-extrabold tracking-tight text-[#173954]">
          {formatUsd(Number(vehicle.price_cents))}
        </p>
        <div className="mt-auto pt-6">
          <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs">
            <span className="font-semibold capitalize text-slate-500">{vehicle.status}</span>
            <span className="font-semibold text-[#0969c5]">View / Edit details →</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function AdminVehicleDetailsDialog({
  vehicle,
  activePhoto,
  failedPhotoUrls,
  onActivePhotoChange,
  onPhotoError,
  onEdit,
  onDelete,
  onOpenChange,
}: {
  vehicle: Row | null;
  activePhoto: number;
  failedPhotoUrls: string[];
  onActivePhotoChange: (index: number) => void;
  onPhotoError: (url: string) => void;
  onEdit: (vehicle: Row) => void;
  onDelete: (vehicle: Row) => void;
  onOpenChange: (open: boolean) => void;
}) {
  if (!vehicle) {
    return null;
  }

  const photos = [...(vehicle.vehicle_photos ?? [])].sort((a, b) => a.position - b.position);
  const selectedPhoto = photos[activePhoto];
  const features = vehicle.features ?? [];
  const title = vehicleTitle(vehicle);

  const specs: [string, string][] = [
    ["VIN", vehicle.vin],
    ["Stock number", vehicle.stock_number],
    ["Mileage", formatMiles(vehicle.mileage)],
    ["Body style", vehicle.body_style],
    ["Exterior color", vehicle.exterior_color ?? "—"],
    ["Interior color", vehicle.interior_color ?? "—"],
    ["Transmission", vehicle.transmission ?? "—"],
    ["Drivetrain", vehicle.drivetrain ?? "—"],
    ["Fuel type", vehicle.fuel_type ?? "—"],
    ["Engine", vehicle.engine ?? "—"],
    [
      "Combined MPG",
      vehicle.mpg_combined === null || vehicle.mpg_combined === undefined ? "—" : String(vehicle.mpg_combined),
    ],
  ];

  const statusClasses = {
    available: "bg-emerald-100 text-emerald-700",
    sold: "bg-slate-200 text-slate-700",
    pending: "bg-amber-100 text-amber-700",
    reserved: "bg-blue-100 text-blue-700",
    draft: "bg-violet-100 text-violet-700",
  } as const;

  return (
    <Dialog open={vehicle !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto p-0">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <DialogTitle className="font-display text-2xl font-bold">{title}</DialogTitle>
              <DialogDescription className="mt-1">
                Admin inventory details · Stock #{vehicle.stock_number}
              </DialogDescription>
            </div>

            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                statusClasses[vehicle.status as keyof typeof statusClasses] ?? "bg-muted text-muted-foreground"
              }`}
            >
              {vehicle.status}
            </span>
          </div>
        </DialogHeader>

        <div className="grid gap-8 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <div className="min-w-0">
            <div className="flex min-h-[300px] items-center justify-center overflow-hidden rounded-xl border border-border bg-muted sm:min-h-[420px]">
              {selectedPhoto && !failedPhotoUrls.includes(selectedPhoto.url) ? (
                isVideoUrl(selectedPhoto.url) ? (
                  <video
                    key={selectedPhoto.url}
                    src={selectedPhoto.url}
                    controls
                    autoPlay
                    playsInline
                    preload="metadata"
                    onError={() => onPhotoError(selectedPhoto.url)}
                    className="max-h-[520px] w-full bg-black object-contain"
                  />
                ) : (
                  <img
                    src={selectedPhoto.url}
                    alt={`${title} photo ${activePhoto + 1}`}
                    onError={() => onPhotoError(selectedPhoto.url)}
                    className="max-h-[520px] w-full object-contain"
                  />
                )
              ) : (
                <div className="flex min-h-[300px] w-full flex-col items-center justify-center gap-2 text-muted-foreground sm:min-h-[420px]">
                  <Camera className="size-9" />
                  <span className="text-sm">No vehicle photo available</span>
                </div>
              )}
            </div>

            {photos.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {photos.map((photo, index) => (
                  <button
                    key={`${photo.url}-${index}`}
                    type="button"
                    onClick={() => onActivePhotoChange(index)}
                    aria-label={`View photo ${index + 1} of ${photos.length}`}
                    aria-pressed={index === activePhoto}
                    className={`relative aspect-[4/3] overflow-hidden rounded-md border-2 bg-muted transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7941D] ${
                      index === activePhoto ? "border-[#F7941D]" : "border-transparent"
                    }`}
                  >
                    {failedPhotoUrls.includes(photo.url) ? (
                      <span className="flex size-full items-center justify-center">
                        <Camera className="size-4 text-muted-foreground" />
                      </span>
                    ) : isVideoUrl(photo.url) ? (
                      <>
                        <video
                          src={photo.url}
                          muted
                          playsInline
                          preload="metadata"
                          className="size-full bg-black object-cover"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Play className="size-4 text-white" />
                        </span>
                      </>
                    ) : (
                      <img
                        src={photo.url}
                        alt={`${title} thumbnail ${index + 1}`}
                        onError={() => onPhotoError(photo.url)}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}

            <section className="mt-8">
              <h3 className="font-display text-lg font-bold text-foreground">Specifications</h3>
              <dl className="mt-3 grid gap-x-8 sm:grid-cols-2">
                {specs.map(([label, value]) => (
                  <div key={label} className="flex min-w-0 justify-between gap-4 border-b border-border py-2.5 text-sm">
                    <dt className="shrink-0 text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 break-words text-right font-medium text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {features.length > 0 && (
              <section className="mt-8">
                <h3 className="font-display text-lg font-bold text-foreground">Equipment</h3>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {descriptionToSafeHtml(vehicle.description) && (
              <section className="mt-8 rounded-xl border border-border bg-card p-5 sm:p-6">
                <h3 className="font-display text-lg font-bold text-foreground">About this vehicle</h3>
                <div
                  className="vehicle-description mt-3 text-sm text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: descriptionToSafeHtml(vehicle.description) }}
                />
              </section>
            )}
          </div>

          <aside className="h-fit space-y-5 rounded-xl border border-border bg-card p-5 lg:sticky lg:top-0">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Vehicle</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-foreground">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatMiles(vehicle.mileage)} · Stock #{vehicle.stock_number}
              </p>
            </div>

            <div className="border-t border-border pt-5">
              <p className="text-xs font-medium text-muted-foreground">Price</p>
              <p className="mt-1 font-display text-3xl font-extrabold text-foreground">
                {formatUsd(Number(vehicle.price_cents))}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-border pt-5 text-sm">
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">Year</p>
                <p className="mt-1 font-semibold text-foreground">{vehicle.year}</p>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">Body style</p>
                <p className="mt-1 font-semibold text-foreground">{vehicle.body_style}</p>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">Make</p>
                <p className="mt-1 font-semibold text-foreground">{vehicle.make}</p>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">Model</p>
                <p className="mt-1 font-semibold text-foreground">{vehicle.model}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="border-destructive/40 font-semibold text-destructive hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDelete(vehicle)}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>

              <Button
                type="button"
                className="rounded-md border border-[#F7941D] bg-[#F7941D] font-semibold text-slate-950 shadow-sm hover:border-[#ea8718] hover:bg-[#ea8718]"
                onClick={() => onEdit(vehicle)}
              >
                Edit vehicle
              </Button>
            </div>

            <p className="border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
              Review the vehicle details here, edit the listing, or delete it from inventory.
            </p>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
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
