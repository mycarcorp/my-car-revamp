import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { trackLeaseEvent } from "@/lib/analytics";
import {
  COMPARISON_MONTHS,
  LEASE_TIERS,
  RIDESHARE_DAILY,
  buildComparisonSeries,
  estimatePackage,
  paymentLabel,
  rideshareSpend,
  usd,
  type LeaseTierKey,
} from "@/lib/lease-to-own";
import { CALCULATOR_ASSUMPTIONS, ESTIMATE_DISCLAIMER } from "@/lib/lease-to-own-content";
import { ctaButtonClass } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { LabeledSlider, ReviewNote, SectionHeading } from "./shared";

const chartConfig = {
  rideshareSpent: { label: "Rideshare spending", color: "var(--color-destructive)" },
  ownershipPaid: { label: "Paid toward your car", color: "var(--color-primary)" },
  vehicleValue: { label: "Est. vehicle value", color: "var(--color-chart-2)" },
  estimatedEquity: { label: "Est. equity", color: "var(--color-success)" },
} satisfies ChartConfig;

export function RideshareSimulator({
  vehicleValue,
  onTierChange,
}: {
  vehicleValue: number;
  /** Optional: lets the page reuse the package the visitor compared. */
  onTierChange?: (tier: LeaseTierKey) => void;
}) {
  const [daily, setDaily] = useState<number>(RIDESHARE_DAILY.default);
  const [tierKey, setTierKey] = useState<LeaseTierKey>("weekly-express");

  const spend = rideshareSpend(daily);
  const estimate = useMemo(() => estimatePackage(tierKey, vehicleValue), [tierKey, vehicleValue]);
  const series = useMemo(() => buildComparisonSeries(daily, estimate), [daily, estimate]);
  const end = series[series.length - 1]!;

  function onDailyChange(value: number) {
    setDaily(value);
    trackLeaseEvent("lease_to_own_calculator_interaction", { interaction: "rideshare_slider" });
  }

  return (
    <section
      id="uber-vs-own"
      aria-labelledby="uber-vs-own-title"
      className="scroll-mt-36 bg-surface py-16 md:py-20"
    >
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading
          id="uber-vs-own-title"
          eyebrow="Rideshare vs. ownership"
          title="What is rideshare costing you?"
          body="Slide your daily rideshare spending. Compare where that money goes with an illustrative path to owning your own vehicle."
        />

        <div className="mt-10 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-8">
          <div className="mx-auto max-w-xl text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              What do you spend on Uber / Lyft per day?
            </p>
            <p
              className="mt-2 font-display text-4xl font-black text-destructive sm:text-5xl"
              aria-live="polite"
            >
              {usd(spend.daily, true)}{" "}
              <span className="text-lg font-bold text-muted-foreground">/ day</span>
            </p>
            <LabeledSlider
              className="mt-4"
              label="Daily rideshare spending"
              valueText={`${usd(spend.daily)} per day`}
              value={daily}
              min={RIDESHARE_DAILY.min}
              max={RIDESHARE_DAILY.max}
              step={RIDESHARE_DAILY.step}
              onChange={onDailyChange}
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>$10/day (1 trip)</span>
              <span>$28/day (avg. commute)</span>
              <span>$70/day (multiple trips)</span>
            </div>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="space-y-4">
              <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-5">
                <p className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-destructive">
                  The rideshare money pit <TrendingDown className="size-5" aria-hidden="true" />
                </p>
                <dl className="mt-4 grid grid-cols-3 gap-3">
                  <Stat label="Monthly" value={usd(spend.monthly)} tone="text-destructive" />
                  <Stat label="12 months" value={usd(spend.yearly)} tone="text-destructive" />
                  <Stat
                    label={`${COMPARISON_MONTHS} months`}
                    value={usd(spend.fourteenMonth)}
                    tone="text-destructive"
                  />
                </dl>
                <p className="mt-3 border-t border-destructive/20 pt-3 text-xs text-muted-foreground">
                  Cash spent on rides. At the end, you don't own a vehicle.
                </p>
              </div>

              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    My Car Lease to Own
                  </p>
                  <TrendingUp className="size-5 text-positive-text" aria-hidden="true" />
                </div>
                <div
                  role="radiogroup"
                  aria-label="Package to compare"
                  className="mt-3 flex flex-wrap gap-1.5"
                >
                  {LEASE_TIERS.map((tier) => (
                    <button
                      key={tier.key}
                      type="button"
                      role="radio"
                      aria-checked={tier.key === tierKey}
                      onClick={() => {
                        setTierKey(tier.key);
                        onTierChange?.(tier.key);
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7941D]/40",
                        tier.key === tierKey
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:border-primary/50",
                      )}
                    >
                      {tier.name}
                    </button>
                  ))}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <Stat label="Down payment" value={usd(estimate.downPayment)} />
                  <Stat label="Payment" value={paymentLabel(estimate)} />
                  <Stat
                    label={`Paid by month ${COMPARISON_MONTHS}`}
                    value={usd(end.ownershipPaid)}
                  />
                  <Stat label="Remaining obligation" value={usd(end.remainingObligation)} />
                  <Stat label="Est. vehicle value" value={usd(end.vehicleValue)} />
                  <Stat
                    label="Est. equity"
                    value={usd(end.estimatedEquity)}
                    tone="text-positive-text"
                  />
                </dl>
                <p className="mt-3 border-t border-primary/15 pt-3 text-xs text-muted-foreground">
                  Based on a {usd(estimate.vehicleValue)} vehicle — change it in the package
                  calculator below.
                </p>
              </div>
            </div>

            <figure className="rounded-xl border border-border p-4">
              <figcaption className="text-xs font-bold uppercase tracking-wider text-foreground">
                Cumulative {COMPARISON_MONTHS}-month comparison
              </figcaption>
              <ChartContainer config={chartConfig} className="mt-3 aspect-auto h-72 w-full sm:h-80">
                <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(m: number) => `M${m}`}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) =>
                          `Month ${payload?.[0]?.payload?.month ?? ""}`
                        }
                        formatter={(value, name) => (
                          <span className="flex w-full justify-between gap-3">
                            <span className="text-muted-foreground">
                              {chartConfig[name as keyof typeof chartConfig]?.label ?? name}
                            </span>
                            <span className="font-mono font-semibold">{usd(Number(value))}</span>
                          </span>
                        )}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line
                    type="monotone"
                    dataKey="rideshareSpent"
                    stroke="var(--color-rideshareSpent)"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="ownershipPaid"
                    stroke="var(--color-ownershipPaid)"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="vehicleValue"
                    stroke="var(--color-vehicleValue)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="estimatedEquity"
                    stroke="var(--color-estimatedEquity)"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ChartContainer>
              <p className="sr-only">
                After {COMPARISON_MONTHS} months: rideshare spending {usd(end.rideshareSpent)}; paid
                toward the car {usd(end.ownershipPaid)}; estimated vehicle value{" "}
                {usd(end.vehicleValue)}; estimated equity {usd(end.estimatedEquity)}.
              </p>
            </figure>
          </div>

          <details className="mt-6 rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-semibold text-foreground">
              How these numbers are calculated
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {CALCULATOR_ASSUMPTIONS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-2">{ESTIMATE_DISCLAIMER}</p>
          </details>

          <ReviewNote ids={["uberHeadline", "equityAsset"]} className="mt-4" />

          <div className="mt-8 text-center">
            <Button asChild className={ctaButtonClass}>
              <Link
                to="/lease-to-own/apply"
                search={{ tier: tierKey, value: estimate.vehicleValue }}
              >
                Start your application — {usd(estimate.downPayment)} down{" "}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd
        className={cn("font-display text-lg font-extrabold sm:text-xl", tone ?? "text-foreground")}
      >
        {value}
      </dd>
    </div>
  );
}
