import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarCheck, Car, CreditCard, History, RefreshCcw, Search, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VehicleCard } from "@/components/VehicleCard";
import { ctaButtonClass } from "@/lib/ui";
import { allVehiclesQuery, type SiteSettings, type VehicleWithPhotos } from "@/lib/queries";
import { vehicleMedia } from "@/lib/vehicle-media";
import {
  beginVisit,
  clearProfile,
  readProfile,
  summarize,
  type InterestCategory,
  type InterestSummary,
} from "@/lib/visitor-personalization";

export type VisitorState = { returning: boolean; summary: InterestSummary | null; clear: () => void };

/** Loads on-device history after hydration so SSR markup always matches the first-visit page. */
export function useVisitorState(): VisitorState {
  const [state, setState] = useState<{ returning: boolean; summary: InterestSummary | null }>({
    returning: false,
    summary: null,
  });
  useEffect(() => {
    const prior = beginVisit();
    const profile = readProfile();
    if (prior && prior > 0 && profile) setState({ returning: true, summary: summarize(profile) });
  }, []);
  return {
    ...state,
    clear: () => {
      clearProfile();
      setState({ returning: false, summary: null });
    },
  };
}

type Cta = { to: "/finance" | "/sell" | "/search" | "/schedule"; label: string };

function titleOf(v: { year?: number | null; make?: string | null; model?: string | null }) {
  return [v.year, v.make, v.model].filter(Boolean).join(" ");
}

function bodyLabel(body: string) {
  const b = body.replace(/_/g, " ");
  return b.toUpperCase() === "SUV" ? "SUVs" : `${b.charAt(0).toUpperCase()}${b.slice(1)}s`;
}

const MESSAGES: Record<Exclude<InterestCategory, "vehicle">, { text: string; cta: Cta }> = {
  financing: {
    text: "Still exploring financing options? Pick up where you left off.",
    cta: { to: "/finance", label: "Continue Financing" },
  },
  selling: {
    text: "Thinking about selling your car? Let's continue your vehicle valuation request.",
    cta: { to: "/sell", label: "Get Your Vehicle Offer" },
  },
  trade: {
    text: "Ready to trade up? Continue exploring your trade-in options.",
    cta: { to: "/sell", label: "Continue Your Trade" },
  },
  schedule: {
    text: "Ready to see a car in person? Schedule a visit when it suits you.",
    cta: { to: "/schedule", label: "Schedule a Test Drive" },
  },
  shopping: {
    text: "Still searching for the perfect ride? We've saved your recent browsing activity on this device.",
    cta: { to: "/search", label: "Continue Shopping" },
  },
};

function useLiveVehicles(summary: InterestSummary | null) {
  const { data: all } = useQuery({ ...allVehiclesQuery(), enabled: !!summary });
  return useMemo(() => {
    const bySlug = new Map((all ?? []).map((v) => [v.slug, v]));
    const byId = new Map((all ?? []).map((v) => [String(v.id), v]));
    const recent = (summary?.recentVehicles ?? [])
      .map((r) => bySlug.get(r.slug) ?? byId.get(r.id))
      .filter((v): v is VehicleWithPhotos => !!v);
    const top = summary?.topVehicle
      ? (bySlug.get(summary.topVehicle.slug) ?? byId.get(summary.topVehicle.id) ?? null)
      : null;
    return { all: all ?? [], recent, top, loaded: !!all };
  }, [all, summary]);
}

export function ReturningHero({ summary }: { summary: InterestSummary }) {
  const { top } = useLiveVehicles(summary);
  const lead = summary.ranked[0];
  const vehicleFirst = lead === "vehicle" && top;
  const msg = MESSAGES[(lead && lead !== "vehicle" ? lead : "shopping") as keyof typeof MESSAGES];
  const photo = top ? vehicleMedia(top).find((m) => m.type !== "video")?.url : undefined;

  return (
    <section className="relative isolate overflow-hidden bg-[#07111b]">
      <div
        className="absolute inset-0 z-0"
        style={{ background: "linear-gradient(110deg, #04090f 0%, #0b1a2b 55%, #12263c 100%)" }}
      />
      <div className="absolute -right-24 top-1/2 z-0 hidden size-[38rem] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,_rgba(247,148,29,0.22),_transparent_65%)] md:block" />
      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 md:grid-cols-[1.1fr_1fr] md:py-24">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-200/80">
            <History className="size-3" /> Saved on this device
          </div>
          <h1 className="mt-5 font-display text-[3rem] font-black leading-[0.95] tracking-[-0.05em] text-white sm:text-[4.25rem] md:text-[5rem]">
            Welcome back!
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-200/90 md:text-lg">
            {vehicleFirst
              ? `Still interested in the ${titleOf(top)}? Take another look.`
              : summary.meaningful
                ? msg.text
                : "Good to see you again. Try a quick search below or browse what's new on the lot."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {vehicleFirst ? (
              <Button asChild size="lg" className={ctaButtonClass}>
                <Link to="/inventory/$slug" params={{ slug: top.slug }}>
                  View Your Recent Vehicle <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg" className={ctaButtonClass}>
                <Link to={msg.cta.to}>
                  {msg.cta.label} <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 bg-white/5 px-6 text-base font-semibold text-white hover:bg-white/10"
            >
              <Link to="/search">Browse all vehicles</Link>
            </Button>
          </div>
          {!summary.meaningful && (
            <div className="mt-6 flex flex-wrap gap-2">
              {["SUV", "Truck", "Sedan", "Toyota", "Honda"].map((q) => (
                <Link
                  key={q}
                  to="/search"
                  search={{ q } as never}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-white/10"
                >
                  {q}
                </Link>
              ))}
            </div>
          )}
        </div>
        {vehicleFirst && photo && (
          <Link
            to="/inventory/$slug"
            params={{ slug: top.slug }}
            className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl"
          >
            <img
              src={photo}
              alt={titleOf(top)}
              className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
              <div className="text-sm font-semibold">{titleOf(top)}</div>
              {top.status === "pending" && (
                <div className="mt-1 inline-block rounded bg-[#F7941D] px-2 py-0.5 text-[11px] font-bold text-slate-950">
                  Sale pending
                </div>
              )}
            </div>
          </Link>
        )}
      </div>
      <div className="accent-bar h-1 w-full" />
    </section>
  );
}

type Card = { key: string; title: string; text: string; icon: typeof Car; link: React.ReactNode };

export function ReturningSections({
  summary,
  settings,
  onClear,
}: {
  summary: InterestSummary;
  settings?: SiteSettings | null;
  onClear: () => void;
}) {
  const { all, recent, top, loaded } = useLiveVehicles(summary);
  const recentIds = new Set(recent.map((v) => String(v.id)));

  const cards: Card[] = [];
  const linkCls = "mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline";
  for (const cat of summary.ranked) {
    if (cards.length >= 3) break;
    if (cat === "vehicle" && top)
      cards.push({
        key: "vehicle",
        title: `View Your ${titleOf(top)}`,
        text: "You looked at this one more than once.",
        icon: Car,
        link: (
          <Link to="/inventory/$slug" params={{ slug: top.slug }} className={linkCls}>
            View vehicle <ArrowRight className="size-4" />
          </Link>
        ),
      });
    if (cat === "financing")
      cards.push({
        key: "fin",
        title: "Let's Find a Payment That Works for You",
        text: "Estimate payments and get pre-qualified online.",
        icon: CreditCard,
        link: (
          <Link to="/finance" className={linkCls}>
            Explore Financing <ArrowRight className="size-4" />
          </Link>
        ),
      });
    if ((cat === "selling" || cat === "trade") && !cards.some((c) => c.key === "sell"))
      cards.push({
        key: "sell",
        title: cat === "trade" ? "Resume Your Trade-In Journey" : "Still Thinking About Selling or Trading?",
        text: "Share your vehicle details and our team will follow up.",
        icon: RefreshCcw,
        link: (
          <Link to="/sell" className={linkCls}>
            Continue Sell/Trade <ArrowRight className="size-4" />
          </Link>
        ),
      });
    if (cat === "schedule")
      cards.push({
        key: "sched",
        title: "Schedule a Test Drive",
        text: "Pick a time to visit us in Fredericksburg.",
        icon: CalendarCheck,
        link: (
          <Link to="/schedule" className={linkCls}>
            Schedule a visit <ArrowRight className="size-4" />
          </Link>
        ),
      });
  }
  const body = summary.preferredBodies[0];
  if (cards.length < 3 && body)
    cards.push({
      key: "body",
      title: `Browse More ${bodyLabel(body)}`,
      text: "See every match currently on our lot.",
      icon: Search,
      link: (
        <Link to="/search" search={{ body } as never} className={linkCls}>
          Shop {bodyLabel(body)} <ArrowRight className="size-4" />
        </Link>
      ),
    });

  // Recommendations from real, available inventory only.
  const available = all.filter((v) => v.status === "available" && !recentIds.has(String(v.id)));
  const hasSignals = summary.preferredBodies.length > 0 || summary.preferredMakes.length > 0;
  const recommended = hasSignals
    ? available
        .map((v) => {
          let s = 0;
          const bi = summary.preferredBodies.indexOf(v.body_style);
          if (bi >= 0) s += 3 - Math.min(bi, 2);
          const mi = summary.preferredMakes.indexOf(v.make);
          if (mi >= 0) s += 2 - Math.min(mi, 1);
          if (summary.priceCents && Math.abs(v.price_cents - summary.priceCents) <= summary.priceCents * 0.25) s += 1;
          return { v, s };
        })
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 4)
        .map((x) => x.v)
    : [];
  const popular = recommended.length ? recommended : available.slice(0, 4);

  return (
    <>
      {cards.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-12">
          <h2 className="font-display text-2xl font-bold">Pick Up Where You Left Off</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {cards.map((c) => (
              <div key={c.key} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <c.icon className="size-6 text-accent" />
                <h3 className="mt-3 font-semibold">{c.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
                {c.link}
              </div>
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-2xl font-bold">Recently Viewed Cars</h2>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" /> Clear Recent Activity
            </button>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {recent.slice(0, 4).map((v) => (
              <div key={v.id} className="relative">
                {v.status !== "available" && (
                  <div className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded bg-[#F7941D] px-2 py-0.5 text-[11px] font-bold text-slate-950">
                    <Tag className="size-3" /> {v.status === "pending" ? "Sale pending" : "Unavailable"}
                  </div>
                )}
                <VehicleCard vehicle={v} settings={settings} />
              </div>
            ))}
          </div>
        </section>
      )}

      {loaded && popular.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-12">
          <h2 className="font-display text-2xl font-bold">
            {recommended.length ? "Recommended for You" : "Popular at My Car"}
          </h2>
          {recommended.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">Based on what you've browsed on this device.</p>
          )}
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {popular.map((v) => (
              <VehicleCard key={v.id} vehicle={v} settings={settings} />
            ))}
          </div>
        </section>
      )}

      {recent.length === 0 && (
        <div className="mx-auto max-w-7xl px-4 pt-6 text-right">
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Clear recent activity on this device
          </button>
        </div>
      )}
    </>
  );
}
