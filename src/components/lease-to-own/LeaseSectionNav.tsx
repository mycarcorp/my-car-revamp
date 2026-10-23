import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LeaseTierKey } from "@/lib/lease-to-own";
import { ctaButtonClass } from "@/lib/ui";
import { cn } from "@/lib/utils";

/** Section links, in the reference prototype's order. IDs live on the sections. */
const LEASE_SECTIONS = [
  { id: "why-smart-shield", label: "Why Smart Shield" },
  { id: "uber-vs-own", label: "Uber vs. Own" },
  { id: "packages", label: "The 3 Packages" },
  { id: "how-it-works", label: "How It Works" },
  { id: "interactive-safeguard", label: "Warranty Safeguard" },
] as const;

/** Global header height (progress bar + 64px bar + border) until it is measured. */
const FALLBACK_HEADER_PX = 69;

/**
 * Secondary, page-only navigation that sticks directly below the shared MyCar
 * header. Links are native in-page anchors (hash updates, Back/Forward work, no
 * route change). Smooth scrolling is CSS-only and scoped to this page; sections
 * carry a scroll-margin so headings clear both sticky bars.
 */
export function LeaseSectionNav({
  tier,
  vehicleValue,
}: {
  tier: LeaseTierKey;
  vehicleValue: number;
}) {
  const [headerPx, setHeaderPx] = useState(FALLBACK_HEADER_PX);
  const [active, setActive] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Stick exactly below the shared header, whatever its rendered height.
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("body header");
    if (!header) return;
    const update = () => setHeaderPx(Math.round(header.getBoundingClientRect().height));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  // Highlight the section crossing a 1px "reading line" just below where an
  // anchor jump places a section's top (its scroll-margin). Sections don't
  // overlap, so at most one crosses the line; above the first section, none.
  const [viewportH, setViewportH] = useState(0);
  useEffect(() => {
    const update = () => setViewportH(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!viewportH || !("IntersectionObserver" in window)) return;
    const els = LEASE_SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (e): e is HTMLElement => Boolean(e),
    );
    if (!els.length) return;
    const margin = parseFloat(getComputedStyle(els[0]!).scrollMarginTop) || headerPx + 75;
    const line = Math.min(viewportH - 2, Math.round(margin + 8));
    const crossing = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) crossing.add(entry.target.id);
          else crossing.delete(entry.target.id);
        }
        setActive(LEASE_SECTIONS.find((s) => crossing.has(s.id))?.id ?? null);
      },
      { rootMargin: `-${line}px 0px -${viewportH - line - 1}px 0px` },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headerPx, viewportH]);

  // Keep the active link visible in the horizontally scrolling list (mobile).
  useEffect(() => {
    const list = listRef.current;
    const link = active ? list?.querySelector<HTMLElement>(`a[href="#${active}"]`) : null;
    if (!list || !link) return;
    const left = link.offsetLeft - list.clientWidth / 2 + link.clientWidth / 2;
    list.scrollTo({ left: Math.max(0, left), behavior: "auto" });
  }, [active]);

  return (
    <>
      {/* Smooth in-page scrolling only while this page is mounted, and never for reduced motion. */}
      <style>{`@media (prefers-reduced-motion: no-preference) { html:has(#lto-section-nav) { scroll-behavior: smooth; } }`}</style>
      <nav
        id="lto-section-nav"
        aria-label="Lease to Own sections"
        className="sticky z-40 border-b border-border bg-background/95 shadow-[0_4px_14px_rgba(15,23,42,0.05)] backdrop-blur-xl"
        style={{ top: headerPx }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4">
          <ul
            ref={listRef}
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-2 [scrollbar-width:none] max-md:[mask-image:linear-gradient(to_right,black_80%,transparent)] [&::-webkit-scrollbar]:hidden"
          >
            {LEASE_SECTIONS.map((section) => {
              const isActive = active === section.id;
              return (
                <li key={section.id} className="shrink-0">
                  <a
                    href={`#${section.id}`}
                    aria-current={isActive ? "location" : undefined}
                    className={cn(
                      "inline-flex items-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7941D]/40 sm:text-sm",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground/75 hover:bg-[#F7941D]/10 hover:text-accent-text",
                    )}
                  >
                    {section.label}
                  </a>
                </li>
              );
            })}
          </ul>
          <div className="flex shrink-0 items-center gap-1.5 py-2">
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs font-semibold sm:px-3 sm:text-sm"
            >
              <Link to="/lease-to-own/portal" aria-label="My Portal">
                <UserRound className="size-4" aria-hidden="true" />
                <span className="hidden md:inline">My Portal</span>
              </Link>
            </Button>
            <Button asChild className={cn(ctaButtonClass, "h-8 px-3 text-xs sm:text-sm")}>
              <Link to="/lease-to-own/apply" search={{ tier, value: vehicleValue }}>
                Get Pre-Approved
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </nav>
    </>
  );
}
