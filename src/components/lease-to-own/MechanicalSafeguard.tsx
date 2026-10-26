import { useState } from "react";
import { CircleDot, Cog, SatelliteDish } from "lucide-react";

import { trackLeaseEvent } from "@/lib/analytics";
import {
  MECHANICAL_COMPONENTS,
  MECHANICAL_INTRO,
  type MechanicalComponent,
} from "@/lib/lease-to-own-content";
import { cn } from "@/lib/utils";
import { ReviewNote, SectionHeading } from "./shared";

const ICONS: Record<MechanicalComponent["key"], typeof Cog> = {
  powertrain: Cog,
  brakes: CircleDot,
  telematics: SatelliteDish,
};

export function MechanicalSafeguard() {
  const [active, setActive] = useState<MechanicalComponent["key"]>("powertrain");
  const selected = MECHANICAL_COMPONENTS.find((c) => c.key === active) ?? MECHANICAL_COMPONENTS[0]!;

  return (
    <section
      id="interactive-safeguard"
      aria-labelledby="mechanical-title"
      className="scroll-mt-36 py-16 md:py-20"
    >
      <div className="mx-auto max-w-7xl px-4">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-10">
          <SectionHeading
            id="mechanical-title"
            align="left"
            eyebrow={MECHANICAL_INTRO.eyebrow}
            title={MECHANICAL_INTRO.title}
            body={MECHANICAL_INTRO.body}
          />

          <div
            role="tablist"
            aria-label="Protected components"
            className="mt-8 grid gap-4 md:grid-cols-3"
          >
            {MECHANICAL_COMPONENTS.map((component) => {
              const Icon = ICONS[component.key];
              const isActive = component.key === active;
              return (
                <button
                  key={component.key}
                  type="button"
                  role="tab"
                  id={`mech-tab-${component.key}`}
                  aria-selected={isActive}
                  aria-controls="mech-panel"
                  onClick={() => {
                    setActive(component.key);
                    trackLeaseEvent("lease_to_own_calculator_interaction", {
                      interaction: "mechanical_component",
                    });
                  }}
                  className={cn(
                    "rounded-xl border p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7941D]/40",
                    isActive
                      ? "border-primary bg-primary/5 shadow-[var(--shadow-card)]"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-lg",
                      isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-primary",
                    )}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="mt-3 block font-display text-base font-bold text-foreground">
                    {component.title}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {component.summary}
                  </span>
                  <span className="mt-2 block text-[11px] font-semibold uppercase tracking-wider text-accent-text">
                    • {component.tag}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            id="mech-panel"
            role="tabpanel"
            aria-labelledby={`mech-tab-${selected.key}`}
            className="mt-6 rounded-xl bg-surface p-5"
          >
            <h3 className="text-lg font-bold text-primary">{selected.title}</h3>
            <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
              <Detail label="Protection" value={selected.protection} />
              <Detail label="Inspection coverage" value={selected.inspection} />
              <Detail label="Maintenance" value={selected.maintenance} />
              <Detail label="Warranty information" value={selected.warranty} />
            </dl>
            <ReviewNote ids={selected.claims} className="mt-4" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-foreground">{value}</dd>
    </div>
  );
}
