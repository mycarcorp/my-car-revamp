import { Link } from "@tanstack/react-router";
import { Check, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { trackLeaseEvent } from "@/lib/analytics";
import {
  LEASE_TIERS,
  TITLE_BUYOUT,
  VEHICLE_VALUE,
  equityProgress,
  estimatePackage,
  usd,
} from "@/lib/lease-to-own";
import { ESTIMATE_DISCLAIMER } from "@/lib/lease-to-own-content";
import { ctaButtonClass } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { LabeledSlider, ReviewNote, SectionHeading } from "./shared";

export function PackagesSection({
  vehicleValue,
  onVehicleValueChange,
}: {
  vehicleValue: number;
  onVehicleValueChange: (value: number) => void;
}) {
  return (
    <section
      id="packages"
      aria-labelledby="packages-title"
      className="scroll-mt-36 bg-surface py-16 md:py-20"
    >
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading
          id="packages-title"
          eyebrow="Choose your structure"
          title="The 3 Lease to Own packages"
          body="Every package includes the Cars Protection Plus powertrain warranty, free 90-day maintenance, and a $100 title buyout when your scheduled payments are complete."
        />

        <div className="mx-auto mt-8 max-w-xl rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Vehicle value
            </p>
            <p className="font-display text-3xl font-black text-primary" aria-live="polite">
              {usd(vehicleValue)}
            </p>
          </div>
          <LabeledSlider
            className="mt-3"
            label="Vehicle value"
            valueText={usd(vehicleValue)}
            value={vehicleValue}
            min={VEHICLE_VALUE.min}
            max={VEHICLE_VALUE.max}
            step={VEHICLE_VALUE.step}
            onChange={(value) => {
              onVehicleValueChange(value);
              trackLeaseEvent("lease_to_own_calculator_interaction", {
                interaction: "vehicle_value_slider",
              });
            }}
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>$6,000 (compact)</span>
            <span>$10,000 (standard)</span>
            <span>$25,000 (luxury SUV)</span>
          </div>
        </div>

        <div className="mt-10 grid items-stretch gap-6 lg:grid-cols-3">
          {LEASE_TIERS.map((tier) => {
            const estimate = estimatePackage(tier.key, vehicleValue);
            const startProgress = Math.round(equityProgress(estimate, 0) * 100);
            return (
              <article
                key={tier.key}
                aria-labelledby={`tier-${tier.key}`}
                className={cn(
                  "relative flex flex-col justify-between rounded-xl border bg-card p-6",
                  tier.featured
                    ? "border-2 border-[#F7941D] shadow-[var(--shadow-lift)]"
                    : "card-lift border-border",
                )}
              >
                {tier.featured && (
                  <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-[#F7941D] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-950">
                    <Star className="size-3" aria-hidden="true" /> Most popular • Paycheck sync
                  </span>
                )}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-secondary-foreground">
                      {tier.badge}
                    </span>
                    <span className="text-xs font-semibold text-accent-text">{tier.highlight}</span>
                  </div>
                  <h3 id={`tier-${tier.key}`} className="mt-4 text-2xl font-bold text-primary">
                    {tier.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{tier.audience}</p>

                  <div className="my-5 rounded-lg bg-surface p-5 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Down payment
                    </p>
                    <p className="font-display text-4xl font-black text-foreground">
                      {usd(estimate.downPayment)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{tier.downNote}</p>
                    <div className="mt-4 border-t border-border pt-4">
                      <p className="font-display text-3xl font-extrabold text-primary">
                        {usd(estimate.payment)}{" "}
                        <span className="text-sm font-medium text-muted-foreground">
                          / {tier.perLabel}
                        </span>
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-positive-text">
                        {tier.installmentsLabel}
                      </p>
                    </div>
                    <dl className="mt-4 space-y-1 border-t border-border pt-3 text-left text-xs">
                      <Row label="Total of installments" value={usd(estimate.totalOfPayments)} />
                      <Row
                        label="Remaining obligation after down"
                        value={usd(estimate.totalOfPayments + TITLE_BUYOUT)}
                      />
                      <Row
                        label={`Estimated total cost (incl. ${usd(TITLE_BUYOUT)} buyout)`}
                        value={usd(estimate.totalCost)}
                      />
                    </dl>
                    <div className="mt-3 text-left">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Paid at signing</span>
                        <span>{startProgress}% of total</span>
                      </div>
                      <div
                        className="mt-1 h-2 overflow-hidden rounded-full bg-primary/15"
                        role="img"
                        aria-label={`Down payment covers ${startProgress}% of the estimated total cost`}
                      >
                        <div
                          className="h-full rounded-full bg-[#F7941D]"
                          style={{ width: `${startProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <ul className="space-y-2.5 text-sm text-foreground">
                    {tier.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-2">
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-positive-text"
                          aria-hidden="true"
                        />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  asChild
                  className={cn("mt-6 w-full", tier.featured ? ctaButtonClass : "h-11")}
                  variant={tier.featured ? "default" : "outline"}
                >
                  <Link
                    to="/lease-to-own/apply"
                    search={{ tier: tier.key, value: estimate.vehicleValue }}
                    onClick={() =>
                      trackLeaseEvent("lease_to_own_tier_selected", { tier: tier.key }, false)
                    }
                  >
                    {tier.cta}
                  </Link>
                </Button>
              </article>
            );
          })}
        </div>

        <p className="mx-auto mt-6 max-w-4xl text-center text-xs text-muted-foreground">
          {ESTIMATE_DISCLAIMER}
        </p>
        <ReviewNote ids={["packageBadges", "bypassPin"]} className="mx-auto mt-4 max-w-4xl" />
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-foreground">{value}</dd>
    </div>
  );
}
