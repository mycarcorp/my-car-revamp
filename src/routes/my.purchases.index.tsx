import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { listMyPurchases } from "@/lib/purchases.functions";
import { PurchaseList } from "@/components/purchase/PurchaseList";
import { isSetupPending, SetupPending } from "@/components/purchase/PurchaseBits";

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

