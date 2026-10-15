import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { listMyPurchases } from "@/lib/purchases.functions";
import { paymentLabel, type Purchase } from "@/lib/purchase-flow";
import { formatUsd, formatDate } from "@/lib/format";
import { isSetupPending, PurchaseProgress, SetupPending, StatusBadge } from "@/components/purchase/PurchaseBits";

export const Route = createFileRoute("/my/purchases/")({
  component: MyPurchasesPage,
});

function MyPurchasesPage() {
  const { user, session } = useAuth();
  const token = session?.access_token ?? "";
  const q = useQuery({
    queryKey: ["my-purchases", user?.id],
    enabled: !!token,
    retry: false,
    queryFn: () => listMyPurchases({ data: { accessToken: token } }),
  });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">My purchases</h1>
      {q.isError && isSetupPending(q.error) ? <SetupPending /> : <PurchaseList purchases={q.data ?? []} loading={q.isLoading} />}
    </div>
  );
}

export function PurchaseList({ purchases, loading }: { purchases: Purchase[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading your purchases…</p>;
  if (!purchases.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <Car className="mx-auto size-8 text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">No purchases yet.</p>
        <Button asChild className="mt-4">
          <Link to="/search">Browse inventory</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {purchases.map((p) => (
        <Link
          key={p.id}
          to="/my/purchases/$id"
          params={{ id: String(p.id) }}
          className="flex gap-4 rounded-xl border border-border bg-card p-4 transition hover:border-primary/50"
        >
          <div className="size-24 shrink-0 overflow-hidden rounded-lg bg-muted">
            {p.vehicle_photo && <img src={p.vehicle_photo} alt="" className="size-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate font-semibold">{p.vehicle_title}</p>
              <StatusBadge status={p.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatUsd(p.vehicle_price_cents)} · {paymentLabel(p.payment_method)} · Updated {formatDate(p.updated_at)}
            </p>
            <PurchaseProgress purchase={p} />
          </div>
        </Link>
      ))}
    </div>
  );
}
