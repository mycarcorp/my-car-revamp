import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PURCHASE_SETUP_PENDING, progressPercent, statusLabel, type Purchase } from "@/lib/purchase-flow";

const TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/10 text-primary",
  in_review: "bg-primary/10 text-primary",
  approved: "bg-accent text-accent-foreground",
  docs_needed: "bg-destructive/10 text-destructive",
  ready_for_delivery: "bg-accent text-accent-foreground",
  completed: "bg-secondary text-secondary-foreground",
  cancelled: "bg-muted text-muted-foreground line-through",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={`border-0 ${TONE[status] ?? "bg-muted"}`}>{statusLabel(status)}</Badge>;
}

export function PurchaseProgress({ purchase }: { purchase: Partial<Purchase> }) {
  const pct = progressPercent(purchase);
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Progress</span>
        <span>{pct}%</span>
      </div>
      <Progress value={pct} className="mt-1 h-2" />
    </div>
  );
}

export function isSetupPending(error: unknown) {
  return error instanceof Error && error.message.includes(PURCHASE_SETUP_PENDING);
}

export function SetupPending() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
      <h2 className="font-display text-xl font-semibold">Setup pending</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Online purchases are almost ready. Please check back soon or call us to continue.
      </p>
    </div>
  );
}
