import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatMiles, formatUsd, vehicleTitle } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type VehicleStatus = Database["public"]["Enums"]["vehicle_status"];
type VehicleUpdate = Database["public"]["Tables"]["vehicles"]["Update"];

export const Route = createFileRoute("/admin/inventory")({
  component: AdminInventory,
});

const STATUSES: VehicleStatus[] = ["available", "pending", "sold", "draft"];

function AdminInventory() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .order("date_received", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function update(id: string, patch: VehicleUpdate) {
    const { error } = await supabase.from("vehicles").update(patch).eq("id", id);
    if (error) { toast.error("Could not update this vehicle."); return; }
    void queryClient.invalidateQueries({ queryKey: ["admin", "vehicles"] });
    void queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    toast.success("Vehicle updated.");
  }

  return (
    <div className="p-6">
      <h1 className="font-display text-2xl font-bold">Inventory</h1>
      <p className="text-sm text-muted-foreground">
        Merchandising overrides for the live feed: status, featured placement and pricing.
      </p>

      {isLoading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : error ? (
        <p className="mt-6 rounded-lg border border-destructive/40 bg-background p-6 text-sm">
          Couldn't load inventory. Refresh to try again.
        </p>
      ) : data?.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-background p-10 text-center">
          <p className="font-medium">No vehicles yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Once the inventory feed is connected, every unit appears here for merchandising.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-background">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Vehicle</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Mileage</th>
                <th className="p-3">Price</th>
                <th className="p-3">Status</th>
                <th className="p-3">Featured</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.map((v) => (
                <tr key={v.id}>
                  <td className="p-3 font-medium">{vehicleTitle(v)}</td>
                  <td className="p-3 text-muted-foreground">{v.stock_number}</td>
                  <td className="p-3 text-muted-foreground">{formatMiles(v.mileage)}</td>
                  <td className="p-3">{formatUsd(Number(v.price_cents))}</td>
                  <td className="p-3">
                    <Select value={v.status} onValueChange={(s) => update(v.id, { status: s as VehicleStatus })}>
                      <SelectTrigger className="w-36">
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
                  <td className="p-3">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => update(v.id, { is_featured: !v.is_featured })}
                      aria-label="Toggle featured"
                    >
                      <Star className={v.is_featured ? "size-4 fill-accent text-accent" : "size-4"} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
