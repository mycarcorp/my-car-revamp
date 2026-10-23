import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DEFAULT_TIER, VEHICLE_VALUE } from "@/lib/lease-to-own";
import { HOW_IT_WORKS } from "@/lib/lease-to-own-content";
import { ctaButtonClass } from "@/lib/ui";
import { ReviewNote, SectionHeading } from "./shared";

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="scroll-mt-36 bg-surface py-16 md:py-20"
    >
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading
          id="how-it-works-title"
          eyebrow={HOW_IT_WORKS.eyebrow}
          title={HOW_IT_WORKS.title}
          body={HOW_IT_WORKS.body}
        />
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-xl border border-border bg-card p-6 text-center"
            >
              <span className="mx-auto flex size-12 items-center justify-center rounded-lg bg-primary font-display text-lg font-black text-primary-foreground">
                {index + 1}
              </span>
              <h3 className="mt-4 text-base font-bold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
        <ReviewNote ids={HOW_IT_WORKS.claims} className="mx-auto mt-6 max-w-3xl" />
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button asChild className={ctaButtonClass}>
            <Link
              to="/lease-to-own/apply"
              search={{ tier: DEFAULT_TIER, value: VEHICLE_VALUE.default }}
            >
              Start your application <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link to="/search">Browse inventory</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
