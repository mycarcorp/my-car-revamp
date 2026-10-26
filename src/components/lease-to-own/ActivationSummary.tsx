import { CreditCard, KeyRound } from "lucide-react";

import {
  TITLE_BUYOUT,
  getLeaseTier,
  paymentLabel,
  usd,
  type PackageEstimate,
} from "@/lib/lease-to-own";
import { PendingIntegration } from "./shared";

/**
 * Step 4 content: deal summary, deposit and activation. There is deliberately
 * no card form — payment must run through an approved processor's hosted
 * checkout, and the account is activated by staff only after the processor
 * confirms the deposit.
 */
export function ActivationSummary({
  customerName,
  vehicleTitle,
  vehicleVin,
  estimate,
  preview,
}: {
  customerName: string;
  vehicleTitle: string | null;
  vehicleVin: string | null;
  estimate: PackageEstimate;
  preview?: boolean;
}) {
  const tier = getLeaseTier(estimate.tier);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section
        aria-labelledby="lto-deal-terms"
        className="rounded-xl border border-border bg-card p-5"
      >
        <h3
          id="lto-deal-terms"
          className="text-xs font-bold uppercase tracking-wider text-accent-text"
        >
          {preview ? "Next: deposit & activation" : "Deal terms summary"}
        </h3>
        <dl className="mt-3 divide-y divide-border text-sm">
          <Row label="Customer" value={customerName} />
          <Row
            label="Vehicle"
            value={
              vehicleTitle
                ? `${vehicleTitle}${vehicleVin ? ` • VIN ${vehicleVin}` : ""}`
                : "To be assigned by My Car"
            }
          />
          <Row label="Package" value={tier.name} />
          <Row
            label="Installments"
            value={`${estimate.installments} × ${paymentLabel(estimate)}`}
          />
          <Row label="Title buyout" value={usd(TITLE_BUYOUT)} />
        </dl>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-surface px-4 py-3">
          <span className="font-semibold text-foreground">Down payment due</span>
          <span className="font-display text-2xl font-black text-primary">
            {usd(estimate.downPayment, true)}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Reference estimate. Your first payment date and final amounts are set in your executed
          agreement.
        </p>
      </section>

      <section aria-labelledby="lto-checkout" className="space-y-4">
        <h3
          id="lto-checkout"
          className="flex items-center gap-2 text-base font-bold text-foreground"
        >
          <CreditCard className="size-4 text-[#F7941D]" aria-hidden="true" /> Secure deposit
          checkout
        </h3>
        <PendingIntegration title="Online deposit payments are not available yet">
          Deposits will be collected through an approved payment processor's secure checkout. Card
          numbers and bank details are never entered into or stored by this website. For now, our
          team will arrange your deposit with you directly.
        </PendingIntegration>
        <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
          <KeyRound className="size-4 text-[#F7941D]" aria-hidden="true" /> Account activation
        </h3>
        <p className="text-sm text-muted-foreground">
          Your Lease to Own account and portal are activated by My Car staff after the deposit is
          confirmed and your agreements are executed. You'll see your account details in the portal
          at that point.
        </p>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold text-foreground">{value}</dd>
    </div>
  );
}
