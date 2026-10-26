import type { ReactNode } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { FlagTriangleRight, PlugZap } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import {
  REVIEW_CLAIMS,
  REVIEW_REASON_LABELS,
  type ReviewClaimId,
} from "@/lib/lease-to-own-content";
import { cn } from "@/lib/utils";

/** Staff (and local development) see the original reference claims awaiting approval. */
function useReviewMode(): boolean {
  const { isStaff } = useAuth();
  return isStaff || import.meta.env.DEV;
}

export function ReviewNote({
  ids,
  className,
}: {
  ids: readonly ReviewClaimId[];
  className?: string;
}) {
  const reviewMode = useReviewMode();
  if (!reviewMode || !ids.length) return null;
  return (
    <aside
      aria-label="Claims pending legal or management review"
      className={cn(
        "rounded-lg border border-dashed border-[#F7941D] bg-[#F7941D]/10 p-3 text-left text-xs text-foreground",
        className,
      )}
    >
      <p className="flex items-center gap-1.5 font-semibold text-accent-text">
        <FlagTriangleRight className="size-3.5" aria-hidden="true" />
        Pending review — visible to staff only
      </p>
      <ul className="mt-2 space-y-1.5">
        {ids.map((id) => {
          const claim = REVIEW_CLAIMS[id];
          return (
            <li key={id}>
              <span className="font-semibold">{REVIEW_REASON_LABELS[claim.reason]}:</span> “
              {claim.reference}” <span className="text-muted-foreground">— {claim.note}</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  accent,
  body,
  align = "center",
}: {
  id?: string;
  eyebrow: string;
  title: string;
  accent?: string;
  body?: ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" ? "mx-auto text-center" : "")}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-text">{eyebrow}</p>
      <h2
        id={id}
        className="mt-2 font-display text-3xl font-extrabold tracking-tight text-primary sm:text-4xl"
      >
        {title}
        {accent && (
          <>
            {" "}
            <span className="text-foreground">{accent}</span>
          </>
        )}
      </h2>
      {body && <p className="mt-3 text-base text-muted-foreground">{body}</p>}
    </div>
  );
}

/** The site's slider styling with an accessible name on the thumb. */
export function LabeledSlider({
  label,
  valueText,
  value,
  min,
  max,
  step,
  onChange,
  className,
}: {
  label: string;
  valueText: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  return (
    <SliderPrimitive.Root
      className={cn("relative flex w-full touch-none select-none items-center py-2", className)}
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([next]) => onChange(next ?? value)}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-primary/20">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        aria-valuetext={valueText}
        className="block size-5 rounded-full border-2 border-[#F7941D] bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7941D]/40"
      />
    </SliderPrimitive.Root>
  );
}

export function PendingIntegration({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      role="note"
      className="rounded-lg border border-dashed border-border bg-muted/50 p-4 text-sm"
    >
      <p className="flex items-center gap-2 font-semibold text-foreground">
        <PlugZap className="size-4 text-accent-text" aria-hidden="true" />
        {title}
      </p>
      <div className="mt-1 text-muted-foreground">{children}</div>
    </div>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "neutral" | "info" | "success" | "warning" | "danger";
  children: ReactNode;
}) {
  const tones = {
    neutral: "border-border bg-muted text-muted-foreground",
    info: "border-primary/25 bg-primary/10 text-primary",
    success: "border-success/30 bg-success/10 text-positive-text",
    warning: "border-[#F7941D]/40 bg-[#F7941D]/10 text-accent-text",
    danger: "border-destructive/30 bg-destructive/10 text-destructive",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
