import { useCallback, useEffect, useState, type ReactNode } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type HomeRailProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  /** Tailwind basis classes applied to each slide wrapper. */
  itemClassName?: string;
  className?: string;
};

/**
 * Horizontal homepage carousel: drag/swipe, keyboard arrows, ~500ms slides.
 */
export function HomeRail({ title, subtitle, action, children, itemClassName, className }: HomeRailProps) {
  const [ref, api] = useEmblaCarousel({ align: "start", duration: 28, containScroll: "trimSnaps", dragFree: false });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const sync = useCallback(() => {
    if (!api) return;
    setCanPrev(api.canScrollPrev());
    setCanNext(api.canScrollNext());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    sync();
    api.on("select", sync).on("reInit", sync);
    return () => {
      api.off("select", sync).off("reInit", sync);
    };
  }, [api, sync]);

  const slides = Array.isArray(children) ? children : [children];

  return (
    <section className={cn("mx-auto max-w-7xl px-4 py-12 md:py-16", className)} aria-roledescription="carousel" aria-label={title}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-black tracking-tight md:text-3xl">{title}</h2>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {action}
          <div className="flex gap-2">
            <RailButton label={`Previous ${title}`} disabled={!canPrev} onClick={() => api?.scrollPrev()}>
              <ChevronLeft className="size-5" />
            </RailButton>
            <RailButton label={`Next ${title}`} disabled={!canNext} onClick={() => api?.scrollNext()}>
              <ChevronRight className="size-5" />
            </RailButton>
          </div>
        </div>
      </div>
      <div
        className="mt-6 overflow-hidden"
        ref={ref}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            api?.scrollPrev();
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            api?.scrollNext();
          }
        }}
      >
        <div className="-ml-4 flex touch-pan-y py-2">
          {slides.map((child, i) => (
            <div key={i} role="group" aria-roledescription="slide" className={cn("min-w-0 shrink-0 grow-0 pl-4", itemClassName)}>
              {child}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RailButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}
