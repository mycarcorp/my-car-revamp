import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type LeadStatus = Database["public"]["Enums"]["lead_status"];

export const Route = createFileRoute("/admin/")({
  component: LeadInbox,
});

const STATUSES: LeadStatus[] = ["new", "contacted", "working", "won", "lost"];

function LeadInbox() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "leads", filter],
    queryFn: async () => {
      let q = supabase
        .from("leads")
        .select("*, vehicle:vehicles(slug, year, make, model)")
        .order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter as LeadStatus);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  async function update(id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from("leads").update(patch).eq("id", id);
    if (error) return toast.error("Could not update this lead.");
    void queryClient.invalidateQueries({ queryKey: ["admin", "leads"] });
    toast.success("Lead updated.");
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Lead inbox</h1>
          <p className="text-sm text-muted-foreground">
            Every finance, trade, appointment, contact and availability request.
          </p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : error ? (
        <p className="mt-6 rounded-lg border border-destructive/40 bg-background p-6 text-sm">
          Couldn't load leads. Refresh to try again.
        </p>
      ) : data?.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          No leads yet.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {data?.map((lead) => {
            const details = (lead.details ?? {}) as Record<string, unknown>;
            const vehicle = lead.vehicle as { year: number; make: string; model: string } | null;
            return (
              <li key={lead.id} className="rounded-lg border border-border bg-background p-4">
                <button
                  className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                  onClick={() => setOpenId(openId === lead.id ? null : lead.id)}
                >
                  <div>
                    <p className="font-semibold">
                      {lead.full_name}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        · {lead.email}
                        {lead.phone ? ` · ${lead.phone}` : ""}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lead.lead_type} · {formatDate(lead.created_at)}
                      {vehicle ? ` · ${vehicle.year} ${vehicle.make} ${vehicle.model}` : ""}
                    </p>
                  </div>
                  <Badge variant={lead.status === "new" ? "default" : "secondary"} className="capitalize">
                    {lead.status}
                  </Badge>
                </button>

                {openId === lead.id && (
                  <div className="mt-4 space-y-4 border-t border-border pt-4">
                    {lead.message && <p className="text-sm">{lead.message}</p>}
                    {Object.keys(details).length > 0 && (
                      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                        {Object.entries(details).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-4">
                            <dt className="capitalize text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                            <dd className="font-medium">{String(v) || "—"}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      <Select
                        value={lead.status}
                        onValueChange={(v) => update(lead.id, { status: v })}
                      >
                        <SelectTrigger className="w-44">
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
                      <a
                        href={`mailto:${lead.email}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Email this customer
                      </a>
                    </div>
                    <div>
                      <Textarea
                        defaultValue={lead.internal_notes ?? ""}
                        placeholder="Internal notes"
                        rows={3}
                        onBlur={(e) => {
                          if (e.target.value !== (lead.internal_notes ?? ""))
                            void update(lead.id, { internal_notes: e.target.value });
                        }}
                      />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
