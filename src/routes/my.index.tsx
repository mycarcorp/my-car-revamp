import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { listMyPurchases, startPurchase } from "@/lib/purchases.functions";
import { clearPendingPurchase, readPendingPurchase } from "@/components/GetStartedButton";
import { PurchaseList } from "@/components/purchase/PurchaseList";
import { isSetupPending, SetupPending } from "@/components/purchase/PurchaseBits";
import { isOpenStatus } from "@/lib/purchase-flow";

export const Route = createFileRoute("/my/")({
  component: MyOverview,
});

function MyOverview() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const token = session?.access_token ?? "";
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    const pending = readPendingPurchase();
    if (!pending) return;
    started.current = true;
    startPurchase({ data: { accessToken: token, vehicle: pending } })
      .then((r) => {
        clearPendingPurchase();
        if (r.resumed) toast.success("Welcome back — picking up where you left off.");
        void navigate({ to: "/my/purchases/$id", params: { id: String(r.id) } });
      })
      .catch((e: Error) => {
        clearPendingPurchase();
        toast.error(isSetupPending(e) ? "Online purchases are not available yet." : e.message);
      });
  }, [token, navigate]);

  const purchases = useQuery({
    queryKey: ["my-purchases", user?.id],
    enabled: !!token,
    retry: false,
    queryFn: () => listMyPurchases({ data: { accessToken: token } }),
  });

  const name = String(user?.user_metadata?.["full_name"] ?? "").split(/\s+/)[0] || user?.email?.split("@")[0];
  const open = (purchases.data ?? []).filter((p) => isOpenStatus(p.status));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Overview</p>
        <h1 className="mt-1 font-display text-3xl font-bold">Welcome, {name}.</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {open.length ? `You have ${open.length} purchase${open.length > 1 ? "s" : ""} in progress.` : "Find a car and press Get Started to begin."}
        </p>
      </div>
      {purchases.isError && isSetupPending(purchases.error) ? (
        <SetupPending />
      ) : (
        <PurchaseList purchases={purchases.data ?? []} loading={purchases.isLoading} />
      )}
    </div>
  );
}
