import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Pencil, Plus, Search, Star, Trash2, Upload } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
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

      <div className="p-6">
        <div className="rounded-lg border border-border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">All Cars ({filtered.length})</p>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="admin-search"
              className="pl-9"
              placeholder="Search make, model..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

      </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div className="grid flex-1 gap-3 md:grid-cols-4">
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
            <thead className="border-b border-border text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Photo</th>
                <th className="p-3">Year / Make / Model</th>
                <th className="p-3">Price</th>
                <th className="p-3">Miles</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((v) => {
                const photo = [...(v.vehicle_photos ?? [])].sort(
                  (a, b) => a.position - b.position,
                )[0];
                const title = vehicleTitle(v);
                const subtitle = [v.trim, v.body_style].filter(Boolean).join(" ");
                const statusClasses = {
                  available: "bg-emerald-100 text-emerald-700",
                  sold: "bg-slate-200 text-slate-700",
                  pending: "bg-amber-100 text-amber-700",
                  reserved: "bg-blue-100 text-blue-700",
                } as const;

                return (
                  <tr key={v.id} className="align-middle">
                    <td className="p-3">
                      {photo ? (
                        <img
                          src={photo.url}
                          alt={title}
                          className="h-12 w-16 rounded-md border border-border object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-12 w-16 rounded-md border border-border bg-muted" />
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-foreground">{title}</div>
                      {subtitle ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
                    </td>
                    <td className="p-3 font-medium text-foreground">{formatUsd(Number(v.price_cents))}</td>
                    <td className="p-3 text-muted-foreground">{formatMiles(v.mileage)}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusClasses[v.status as keyof typeof statusClasses] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditing(v);
                            setFormOpen(true);
                          }}
                        >
                          Edit
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
