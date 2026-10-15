import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { adminAddPurchaseNote, adminGetPurchase, adminListPurchases, adminUpdatePurchase } from "@/lib/admin-purchases.functions";
import { PAYMENT_METHODS, PURCHASE_STATUSES, paymentLabel, statusLabel, type Purchase } from "@/lib/purchase-flow";
import { formatDate, formatMiles, formatUsd } from "@/lib/format";
import { isSetupPending, PurchaseProgress, SetupPending, StatusBadge } from "@/components/purchase/PurchaseBits";

export const Route = createFileRoute("/admin/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — MyCar Admin" },
      { name: "description", content: "Manage customer vehicle purchases and their status." },
      { property: "og:title", content: "Transactions — MyCar Admin" },
      { property: "og:description", content: "Manage customer vehicle purchases." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [payment, setPayment] = useState("all");
  const [openId, setOpenId] = useState<number | null>(null);

  const q = useQuery({
    queryKey: ["admin-purchases"],
    enabled: !!token,
    retry: false,
    queryFn: () => adminListPurchases({ data: { accessToken: token } }),
  });

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter(
      (p) =>
        (status === "all" || p.status === status) &&
        (payment === "all" || p.payment_method === payment) &&
        (!s || [p.full_name, p.email, p.phone, p.vehicle_title, p.vehicle_vin].some((v) => v?.toLowerCase().includes(s))),
    );
  }, [q.data, search, status, payment]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of q.data ?? []) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [q.data]);

  if (q.isError && isSetupPending(q.error)) {
    return (
      <div className="p-6">
        <SetupPending />
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Run supabase/migrations_legacy/2026_mc_purchases.sql in the SQL editor to enable transactions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Transactions</h1>
        <p className="text-sm text-muted-foreground">Customer vehicle purchases started from Get Started.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PURCHASE_STATUSES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStatus(status === s.key ? "all" : s.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${status === s.key ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"}`}
          >
            {s.label} · {counts[s.key] ?? 0}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search name, email, vehicle, VIN" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={payment} onValueChange={setPayment}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payment methods</SelectItem>
            {PAYMENT_METHODS.map((m) => (
              <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Customer</th>
              <th className="p-3">Vehicle</th>
              <th className="p-3">Payment</th>
              <th className="p-3">Trade-in</th>
              <th className="p-3">Status</th>
              <th className="p-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!q.isLoading && !rows.length && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No transactions.</td></tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} onClick={() => setOpenId(p.id)} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40">
                <td className="p-3">
                  <p className="font-medium">{p.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </td>
                <td className="p-3">
                  <p>{p.vehicle_title}</p>
                  <p className="text-xs text-muted-foreground">{formatUsd(p.vehicle_price_cents)}</p>
                </td>
                <td className="p-3">{paymentLabel(p.payment_method)}</td>
                <td className="p-3">{p.has_trade_in ? "Yes" : p.has_trade_in === false ? "No" : "—"}</td>
                <td className="p-3"><StatusBadge status={p.status} /></td>
                <td className="p-3 text-xs text-muted-foreground">{formatDate(p.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={openId != null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {openId != null && <TransactionDetail id={openId} token={token} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TransactionDetail({ id, token }: { id: number; token: string }) {
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-purchase", id],
    queryFn: () => adminGetPurchase({ data: { accessToken: token, id } }),
  });
  const [note, setNote] = useState("");
  const [visible, setVisible] = useState(false);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin-purchase", id] });
    await queryClient.invalidateQueries({ queryKey: ["admin-purchases"] });
  }

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!q.data) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
  const p: Purchase = q.data.purchase;

  return (
    <div className="space-y-5">
      <SheetHeader>
        <SheetTitle>{p.vehicle_title}</SheetTitle>
      </SheetHeader>
      <div className="flex items-center gap-3"><StatusBadge status={p.status} /><span className="text-xs text-muted-foreground">#{p.id}</span></div>
      <PurchaseProgress purchase={p} />

      <section className="space-y-1 text-sm">
        <h3 className="font-semibold">Customer</h3>
        <p>{p.full_name} · {p.email} · {p.phone}</p>
        <p className="text-muted-foreground">{[p.address, p.city, p.state, p.zip].filter(Boolean).join(", ")}</p>
        {p.date_of_birth && <p className="text-muted-foreground">DOB {p.date_of_birth}</p>}
      </section>
      <section className="space-y-1 text-sm">
        <h3 className="font-semibold">Vehicle & deal</h3>
        <p>{formatUsd(p.vehicle_price_cents)} · {formatMiles(p.vehicle_mileage)} · VIN {p.vehicle_vin ?? "—"}</p>
        <p>Payment: {paymentLabel(p.payment_method)}{p.lender_name ? ` — ${p.lender_name}` : ""}{p.preapproval_amount ? ` (pre-approved ${formatUsd(p.preapproval_amount * 100)})` : ""}</p>
        <p>
          Trade-in: {p.has_trade_in ? `${p.trade_year_make_model ?? ""}, ${p.trade_mileage ?? "?"} mi${p.trade_vin ? `, VIN ${p.trade_vin}` : ""}${p.trade_payoff ? `, owes ${formatUsd(p.trade_payoff * 100)}` : ""}` : p.has_trade_in === false ? "None" : "—"}
        </p>
      </section>

      <section className="space-y-3 rounded-lg border border-border p-3">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select
            value={p.status}
            onValueChange={(s) => void run(() => adminUpdatePurchase({ data: { accessToken: token, id, status: s } }), `Status set to ${statusLabel(s)}.`)}
            disabled={busy}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PURCHASE_STATUSES.map((s) => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="assignee">Assigned to</Label>
          <div className="flex gap-2">
            <Input id="assignee" placeholder="Staff name or email" value={assignee ?? p.assigned_to ?? ""} onChange={(e) => setAssignee(e.target.value)} />
            <Button
              variant="outline"
              disabled={busy || assignee === null}
              onClick={() => void run(() => adminUpdatePurchase({ data: { accessToken: token, id, assignedTo: assignee } }), "Assignment saved.").then(() => setAssignee(null))}
            >
              Save
            </Button>
          </div>
        </div>
        {p.status !== "cancelled" && (
          <Button
            variant="ghost"
            className="text-destructive"
            disabled={busy}
            onClick={() => {
              if (confirm("Cancel this purchase?")) void run(() => adminUpdatePurchase({ data: { accessToken: token, id, status: "cancelled" } }), "Purchase cancelled.");
            }}
          >
            Cancel purchase
          </Button>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Add note</h3>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={visible} onCheckedChange={(v) => setVisible(v === true)} /> Visible to customer
        </label>
        <Button
          size="sm"
          disabled={busy || !note.trim()}
          onClick={() => void run(() => adminAddPurchaseNote({ data: { accessToken: token, id, message: note, visibleToCustomer: visible } }), "Note added.").then(() => setNote(""))}
        >
          Add note
        </Button>
      </section>

      <section>
        <h3 className="text-sm font-semibold">Activity</h3>
        <ul className="mt-2 space-y-2">
          {q.data.events.map((e) => (
            <li key={e.id} className="border-l-2 border-primary/40 pl-3 text-xs">
              <p>{e.message}</p>
              <p className="text-muted-foreground">
                {formatDate(e.created_at)} {e.author ? `· ${e.author}` : ""} {e.visible_to_customer ? "· customer sees this" : "· internal"}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
