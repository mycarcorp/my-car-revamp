import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Pencil, Plus, Search, Star, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatMiles, formatUsd, vehicleTitle } from "@/lib/format";
import { deleteVehicleDeep, type Vehicle } from "@/lib/admin-inventory";
import { CsvImportDialog } from "@/components/admin/CsvImportDialog";
import { VehicleFormDialog, BODY_STYLES, STATUSES } from "@/components/admin/VehicleFormDialog";
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
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [make, setMake] = useState("all");
  const [year, setYear] = useState("all");
  const [body, setBody] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Vehicle | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*, vehicle_photos(url, position)")
        .order("date_received", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "vehicles"] });
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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = (data ?? []).filter((v) => {
      if (status !== "all" && v.status !== status) return false;
      if (make !== "all" && v.make !== make) return false;
      if (year !== "all" && String(v.year) !== year) return false;
      if (body !== "all" && v.body_style !== body) return false;
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
  }, [data, q, status, make, year, body, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

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
      await deleteVehicleDeep(toDelete);
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
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Add, import, edit and remove vehicles. Changes appear on the public site right away.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" /> Import CSV
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" /> Add vehicle
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 rounded-lg border border-border bg-background p-4 md:grid-cols-6">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="admin-search">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="admin-search"
              className="pl-9"
              placeholder="VIN, stock #, make, model, trim"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <Filter label="Status" value={status} onChange={setStatus} options={STATUSES} />
        <Filter label="Make" value={make} onChange={setMake} options={makes} />
        <Filter
          label="Year"
          value={year}
          onChange={setYear}
          options={years.map((y) => String(y))}
        />
        <Filter label="Body" value={body} onChange={setBody} options={BODY_STYLES} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading…" : `${filtered.length} vehicles`}
        </p>
        <Select value={sort} onValueChange={setSort}>
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
        <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-background">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Photo</th>
                <th className="p-3">Stock #</th>
                <th className="p-3">VIN</th>
                <th className="p-3">Vehicle</th>
                <th className="p-3">Mileage</th>
                <th className="p-3">Price</th>
                <th className="p-3">Status</th>
                <th className="p-3">Updated</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((v) => {
                const photo = [...(v.vehicle_photos ?? [])].sort(
                  (a, b) => a.position - b.position,
                )[0];
                return (
                  <tr key={v.id}>
                    <td className="p-3">
                      {photo ? (
                        <img
                          src={photo.url}
                          alt={vehicleTitle(v)}
                          className="h-12 w-16 rounded object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-12 w-16 rounded bg-muted" />
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{v.stock_number}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{v.vin}</td>
                    <td className="p-3 font-medium">{vehicleTitle(v)}</td>
                    <td className="p-3 text-muted-foreground">{formatMiles(v.mileage)}</td>
                    <td className="p-3">{formatUsd(Number(v.price_cents))}</td>
                    <td className="p-3">
                      <Select
                        value={v.status}
                        onValueChange={(s) => void update(v.id, { status: s as VehicleStatus })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="capitalize">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {new Date(v.updated_at).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => void update(v.id, { is_featured: !v.is_featured })}
                          aria-label="Toggle featured"
                        >
                          <Star
                            className={v.is_featured ? "size-4 fill-accent text-accent" : "size-4"}
                          />
                        </Button>
                        <Button size="icon" variant="ghost" asChild aria-label="View vehicle">
                          <a href={`/inventory/${v.slug}`} target="_blank" rel="noreferrer">
                            <Eye className="size-4" />
                          </a>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Edit vehicle"
                          onClick={() => {
                            setEditing(v);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Delete vehicle"
                          onClick={() => setToDelete(v)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
