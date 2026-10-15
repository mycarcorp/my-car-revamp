import type React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Banknote,
  Car,
  CarFront,
  Handshake,
  MapPin,
  Search,
  ShieldCheck,
  TrendingDown,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LeadForm } from "@/components/LeadForm";
import { vehicleMedia } from "@/components/VehicleCard";
import { HomeRail } from "@/components/home/HomeRail";
import { HomeVehicleCard } from "@/components/home/HomeVehicleCard";
import { BrandStory } from "@/components/home/BrandStory";
import { ReturningHero, ReturningSections, useVisitorState } from "@/components/ReturningVisitor";
import { useAuth } from "@/hooks/useAuth";
import { ctaButtonClass } from "@/lib/ui";
import {
  allVehiclesQuery,
  facetsQuery,
  featuredVehiclesQuery,
  serviceAreasQuery,
  siteSettingsQuery,
  type VehicleWithPhotos,
} from "@/lib/queries";
import heroImage from "@/assets/home-hero.jpg";
import trustImage from "@/assets/home-trust.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { name: "google-site-verification", content: "Treiv8fZAqKhNjSJYJtOYmyeg951BzF57RSn7uXJoWs" },
      { title: "Used Car Dealership in Fredericksburg, VA | My Car" },
      {
        name: "description",
        content:
          "Shop quality used cars, trucks and SUVs in Fredericksburg, VA. Explore financing options, trade in your vehicle, sell your car, or schedule a test drive with My Car.",
      },
      { property: "og:title", content: "Used Car Dealership in Fredericksburg, VA | My Car" },
      {
        property: "og:description",
        content:
          "Shop quality used cars, trucks and SUVs in Fredericksburg, VA. Explore financing options, trade in your vehicle, sell your car, or schedule a test drive with My Car.",
      },
      { property: "og:url", content: "https://mycarcorp.com/" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://mycarcorp.com/" }],
  }),
  component: Home,
});

const BODY_STYLES = ["SUV", "Sedan", "Truck", "Coupe", "Hatchback", "Convertible", "Minivan", "Wagon", "Van"];
const BODY_LABELS: Record<string, string> = {
  SUV: "SUVs",
  Sedan: "Sedans",
  Truck: "Trucks",
  Coupe: "Coupes",
  Hatchback: "Hatchbacks",
  Convertible: "Convertibles",
  Minivan: "Minivans",
  Wagon: "Wagons",
  Van: "Vans",
};

type CarFinderForm = {
  fullName: string;
  email: string;
  phone: string;
  make: string;
  model: string;
  minYear: string;
  maxYear: string;
  bodyStyle: string;
  maxBudget: string;
  financingNeeded: string;
  features: string;
  message: string;
};

const EMPTY_CAR_FINDER_FORM: CarFinderForm = {
  fullName: "",
  email: "",
  phone: "",
  make: "",
  model: "",
  minYear: "",
  maxYear: "",
  bodyStyle: "",
  maxBudget: "",
  financingNeeded: "unsure",
  features: "",
  message: "",
};

const priceOf = (v: VehicleWithPhotos) => Number(v.price_cents ?? 0) / 100;
const isDrop = (v: VehicleWithPhotos) =>
  Number(v.prior_price_cents ?? 0) > Number(v.price_cents ?? 0) && priceOf(v) > 0;
const coverOf = (v: VehicleWithPhotos) => vehicleMedia(v).find((m) => !m.video)?.url ?? "";
const firstCover = (list: VehicleWithPhotos[]) => {
  for (const v of list) {
    const url = coverOf(v);
    if (url) return url;
  }
  return "";
};

function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: settings } = useQuery(siteSettingsQuery());
  const { data: featured, isLoading: featuredLoading } = useQuery(featuredVehiclesQuery());
  const { data: facets } = useQuery(facetsQuery());
  const { data: all } = useQuery(allVehiclesQuery());
  const { data: areas } = useQuery(serviceAreasQuery());
  const visitor = useVisitorState();
  const [term, setTerm] = useState("");
  const [carFinderOpen, setCarFinderOpen] = useState(false);
  const [carFinder, setCarFinder] = useState<CarFinderForm>(EMPTY_CAR_FINDER_FORM);
  const badges = (settings?.trust_badges ?? []) as { label: string; enabled: boolean }[];
  const displayName =
    String(user?.user_metadata?.["full_name"] ?? user?.user_metadata?.["name"] ?? "")
      .trim()
      .split(/\s+/)[0] ||
    user?.email?.split("@")[0] ||
    "";

  const updateCarFinder = (field: keyof CarFinderForm, value: string) => {
    setCarFinder((current) => ({ ...current, [field]: value }));
  };

  const live = useMemo(
    () => (all ?? []).filter((v) => v.status === "available" || v.status === "pending" || !v.status),
    [all],
  );

  const styles = useMemo(
    () =>
      BODY_STYLES.map((style) => {
        const list = live.filter((v) => v.body_style === style);
        const count = facets?.bodies.find((b) => b.value === style)?.count ?? list.length;
        return { style, count, image: firstCover(list) };
      }).filter((s) => s.count > 0),
    [live, facets],
  );

  const discovery = useMemo(() => {
    const under = live.filter((v) => priceOf(v) > 0 && priceOf(v) < 20000);
    const recent = [...live].sort((a, b) => Date.parse(b.date_received ?? "") - Date.parse(a.date_received ?? ""));
    const drops = live.filter(isDrop);
    const family = live.filter((v) => v.body_style === "SUV" || v.body_style === "Minivan");
    return [
      {
        key: "under",
        title: "Cars under $20K",
        body: "Quality picks that keep your budget in check.",
        cta: "Explore Budget Options",
        count: under.length,
        image: firstCover(under),
        search: { priceMax: 20000 },
        tone: "bg-secondary",
      },
      {
        key: "recent",
        title: "Recently added",
        body: "The newest arrivals on our lot.",
        cta: "Shop New Arrivals",
        count: recent.length,
        image: firstCover(recent),
        search: { sort: "newest" },
        tone: "bg-accent/20",
      },
      {
        key: "deals",
        title: "Discover great deals",
        body: "Vehicles with recently reduced prices.",
        cta: "Find Your Deal",
        count: drops.length,
        image: firstCover(drops),
        search: { deal: "price-drop" },
        tone: "bg-success/15",
      },
      {
        key: "family",
        title: "Family-friendly",
        body: "SUVs and minivans with room for everyone.",
        cta: "Shop Family Cars",
        count: family.length,
        image: firstCover(family),
        search: { body: "SUV|Minivan" },
        tone: "bg-primary/10",
      },
    ].filter((c) => c.count > 0);
  }, [live]);

  const models = useMemo(() => {
    const map = new Map<string, { make: string; model: string; count: number; image: string }>();
    for (const v of live) {
      if (!v.make || !v.model) continue;
      const key = `${v.make}|${v.model}`;
      const entry = map.get(key) ?? { make: v.make, model: v.model, count: 0, image: "" };
      entry.count += 1;
      if (!entry.image) entry.image = coverOf(v);
      map.set(key, entry);
    }
    return [...map.values()]
      .filter((m) => m.image)
      .sort((a, b) => b.count - a.count)
      .slice(0, 14);
  }, [live]);

  const dropCount = useMemo(() => live.filter(isDrop).length, [live]);
  const dropImage = useMemo(() => firstCover(live.filter(isDrop)), [live]);

  return (
    <>
      {visitor.returning && visitor.summary && <ReturningHero summary={visitor.summary} />}

      {/* HERO */}
      <section className={visitor.returning ? "hidden" : "relative isolate overflow-hidden bg-primary"}>
        <img
          src={heroImage}
          alt="Smiling shopper beside an SUV on a dealership lot at golden hour"
          width={1920}
          height={1088}
          fetchPriority="high"
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[70%_center]"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-primary via-primary/80 to-primary/0 md:via-primary/55" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-primary/90 to-transparent" />

        <div className="mx-auto max-w-7xl px-4 pb-10 pt-16 md:pb-14 md:pt-24 lg:pt-28">
          <div className="max-w-xl">
            <h1 className="text-xs font-bold uppercase tracking-[0.22em] text-primary-foreground/80">
              Used cars, trucks &amp; SUVs in Fredericksburg, VA
            </h1>
            <p className="mt-4 font-display text-[3.2rem] font-black leading-[0.92] tracking-[-0.05em] text-primary-foreground sm:text-7xl lg:text-[5.6rem]">
              Right car.
              <span className="block text-accent">Right price.</span>
            </p>

            <form
              role="search"
              className="mt-8 flex items-center gap-2 rounded-full bg-card p-1.5 pl-5 shadow-[var(--shadow-lift)]"
              onSubmit={(e) => {
                e.preventDefault();
                void navigate({ to: "/search", search: term.trim() ? { q: term.trim() } : {} });
              }}
            >
              <Search className="size-5 shrink-0 text-muted-foreground" />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search make, model, or keyword"
                aria-label="Search inventory"
                className="h-11 border-0 bg-transparent px-1 text-base text-card-foreground shadow-none focus-visible:ring-0"
              />
              <Button type="submit" className={`${ctaButtonClass} rounded-full`}>
                Search
              </Button>
            </form>
            <Link
              to="/search"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-foreground/90 hover:text-accent"
            >
              {facets?.total ? `Browse all ${facets.total.toLocaleString()} vehicles` : "Browse all vehicles"}
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="mt-12 grid gap-4 md:mt-20 md:grid-cols-2">
            <HeroCard
              icon={<Banknote className="size-6" />}
              title="Financing made simple"
              body="Explore financing options for your next vehicle."
              cta="Explore Financing"
              to="/finance"
            />
            <HeroCard
              icon={<Handshake className="size-6" />}
              title="Sell or trade your car"
              body="Ready for something new? Tell us about your current vehicle."
              cta="Get Your Offer"
              to="/sell"
            />
          </div>
        </div>
      </section>

      {visitor.returning && visitor.summary && (
        <ReturningSections summary={visitor.summary} settings={settings} onClear={visitor.clear} />
      )}

      {/* TRUST BAR */}
      {badges.some((b) => b.enabled) && (
        <section className="border-b border-border bg-surface">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:grid-cols-2 lg:grid-cols-4">
            {badges
              .filter((b) => b.enabled)
              .map((b) => (
                <div key={b.label} className="flex items-center gap-3 text-sm font-medium">
                  <ShieldCheck className="size-5 shrink-0 text-accent" />
                  {b.label}
                </div>
              ))}
          </div>
        </section>
      )}

      {/* BODY STYLES */}
      {styles.length > 0 && (
        <HomeRail
          title="Popular vehicle styles"
          subtitle="Counts reflect vehicles in our live inventory."
          itemClassName="basis-[62%] sm:basis-1/3 lg:basis-1/5"
          action={
            <button
              type="button"
              onClick={() => setCarFinderOpen(true)}
              className="hidden text-sm font-semibold text-primary hover:underline sm:inline"
            >
              Can&apos;t find it? Use Car Finder
            </button>
          }
        >
          {styles.map((s) => (
            <Link
              key={s.style}
              to="/search"
              search={{ body: s.style }}
              className="group block overflow-hidden rounded-2xl bg-surface transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
            >
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                {s.image ? (
                  <img
                    src={s.image}
                    alt={`${s.style} in stock`}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Car className="size-10" />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="font-display text-lg font-bold">{BODY_LABELS[s.style] ?? s.style}</span>
                <span className="text-xs font-semibold text-muted-foreground">{s.count.toLocaleString()}</span>
              </div>
            </Link>
          ))}
        </HomeRail>
      )}

      {/* EXPLORE CARS YOU'LL LOVE */}
      {discovery.length > 0 && (
        <div className="bg-surface">
          <HomeRail title="Explore cars you'll love" itemClassName="basis-[85%] sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
            {discovery.map((c) => (
              <Link
                key={c.key}
                to="/search"
                search={c.search}
                className={`group flex h-full flex-col overflow-hidden rounded-3xl ${c.tone} p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]`}
              >
                <h3 className="font-display text-2xl font-black tracking-tight">{c.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{c.body}</p>
                <div className="mt-5 aspect-[16/10] overflow-hidden rounded-2xl bg-card">
                  {c.image ? (
                    <img
                      src={c.image}
                      alt={c.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <CarFront className="size-10" />
                    </div>
                  )}
                </div>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">
                  {c.cta} <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </HomeRail>
        </div>
      )}

      {/* FRESH ON THE LOT */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:py-16">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl font-black tracking-tight md:text-3xl">Fresh on the lot</h2>
          <Link to="/search" className="text-sm font-semibold text-primary hover:underline">
            View all inventory
          </Link>
        </div>
        {featuredLoading ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading inventory">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-[320px] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : featured && featured.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((v) => (
              <HomeVehicleCard key={v.id} vehicle={v} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-10 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
              <Car className="size-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold">
              {facets?.total === 0 ? "No vehicles currently available" : "Fresh arrivals are being updated"}
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Inventory changes often. Browse everything or tell us what you&apos;re looking for.
            </p>
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <Button asChild variant="outline">
                <Link to="/search">View all inventory</Link>
              </Button>
              <Button type="button" className={ctaButtonClass} onClick={() => setCarFinderOpen(true)}>
                Use Car Finder
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* POPULAR MODELS */}
      {models.length > 0 && (
        <HomeRail title="Shop popular models" itemClassName="basis-[55%] sm:basis-1/3 lg:basis-1/5">
          {models.map((m) => (
            <Link
              key={`${m.make}-${m.model}`}
              to="/search"
              search={{ make: m.make, model: m.model }}
              className="group block rounded-2xl border border-border bg-card p-3 transition duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-[var(--shadow-lift)]"
            >
              <div className="aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                <img
                  src={m.image}
                  alt={`${m.make} ${m.model}`}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="px-1 pb-1 pt-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{m.make}</div>
                <div className="font-display text-base font-bold">{m.model}</div>
              </div>
            </Link>
          ))}
        </HomeRail>
      )}

      {/* BRAND STORY */}
      <BrandStory />

      {/* TRUST */}
      <section className="bg-surface">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <img
            src={trustImage}
            alt="A dealership representative reviewing vehicle details with a shopper"
            width={1280}
            height={1024}
            loading="lazy"
            className="aspect-[5/4] w-full rounded-3xl object-cover shadow-[var(--shadow-card)]"
          />
          <div>
            <h2 className="font-display text-3xl font-black leading-tight tracking-tight md:text-5xl">
              Real people. Real cars. A better buying experience.
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
              My Car is a local Fredericksburg dealership. Browse our real inventory online, ask questions, and start
              your purchase when you&apos;re ready — our team is here to help along the way.
            </p>
            <ol className="mt-8 space-y-4">
              {[
                ["Find your car", "Search live inventory with real photos and prices."],
                ["Choose how to pay", "Cash, My Car financing, or your own lender."],
                ["Finish with our team", "We confirm details and help you take it home."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-black text-primary-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-semibold">{t}</div>
                    <div className="text-sm text-muted-foreground">{d}</div>
                  </div>
                </li>
              ))}
            </ol>
            <Button asChild size="lg" className={`${ctaButtonClass} mt-8`}>
              <Link to="/search">
                Explore vehicles <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* PRICE DROPS */}
      {dropCount > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12 md:py-16">
          <div className="relative isolate overflow-hidden rounded-3xl bg-primary px-6 py-10 text-primary-foreground md:px-12 md:py-14">
            {dropImage && (
              <img
                src={dropImage}
                alt=""
                loading="lazy"
                className="absolute inset-y-0 right-0 -z-10 hidden h-full w-1/2 object-cover opacity-60 md:block"
              />
            )}
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-primary via-primary/90 to-primary/20" />
            <div className="max-w-lg">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success px-3 py-1 text-xs font-bold text-success-foreground">
                <TrendingDown className="size-3.5" /> {dropCount} price {dropCount === 1 ? "drop" : "drops"}
              </span>
              <h2 className="mt-4 font-display text-3xl font-black tracking-tight md:text-5xl">
                Fresh prices. More possibilities.
              </h2>
              <p className="mt-3 text-primary-foreground/80">Explore vehicles with recently reduced prices.</p>
              <Button asChild size="lg" className={`${ctaButtonClass} mt-6`}>
                <Link to="/search" search={{ deal: "price-drop" }}>
                  Shop Price Drops
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* SERVICE AREAS */}
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-8">
        <h2 className="font-display text-2xl font-black tracking-tight">Serving the Fredericksburg region</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(areas ?? []).map((a) => (
            <Link
              key={a.id}
              to="/locations/$slug"
              params={{ slug: a.slug }}
              className="group rounded-2xl border border-border bg-card p-5 transition hover:border-accent"
            >
              <div className="flex items-center gap-2 font-semibold">
                <MapPin className="size-4 text-accent" /> Used cars in {a.name}, {a.state}
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{a.intro}</p>
            </Link>
          ))}
        </div>
      </section>

      <Dialog open={carFinderOpen} onOpenChange={setCarFinderOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-border px-5 py-5 text-left sm:px-6">
            <div className="flex size-11 items-center justify-center rounded-full bg-[#F7941D]/15">
              <Search className="size-5 text-[#D96F00]" />
            </div>
            <DialogTitle className="pt-2 font-display text-2xl">Let us find your next vehicle</DialogTitle>
            <DialogDescription className="max-w-2xl leading-6">
              Tell us what you&apos;re looking for. Inventory changes often, and our team can contact you when we find a
              suitable match.
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 pb-6 sm:px-6">
            <LeadForm
              leadType="contact"
              submitLabel="Send My Car Finder Request"
              successTitle="Your Car Finder request was received"
              successBody="Our team will review your preferences and contact you when we find a suitable match."
              messageLabel="Anything else we should know?"
              collectDetails={() => ({
                request_type: "car_finder",
                source: "MyCar homepage — Car Finder",
                full_name: carFinder.fullName,
                customer_name: carFinder.fullName,
                email: carFinder.email,
                customer_email: carFinder.email,
                phone: carFinder.phone,
                customer_phone: carFinder.phone,
                preferred_make: carFinder.make,
                preferred_model: carFinder.model,
                preferred_year_min: carFinder.minYear,
                preferred_year_max: carFinder.maxYear,
                preferred_body_style: carFinder.bodyStyle,
                maximum_budget: carFinder.maxBudget,
                financing_needed: carFinder.financingNeeded,
                must_have_features: carFinder.features,
                message: carFinder.message,
              })}
            >
              <div className="space-y-6 pt-5">
                <section>
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-foreground">Your contact information</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      We&apos;ll only use this to follow up about your request.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="car-finder-name">Full name</Label>
                      <Input
                        id="car-finder-name"
                        value={carFinder.fullName}
                        onChange={(event) => updateCarFinder("fullName", event.target.value)}
                        placeholder="First and last name"
                        autoComplete="name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="car-finder-email">Email</Label>
                      <Input
                        id="car-finder-email"
                        type="email"
                        value={carFinder.email}
                        onChange={(event) => updateCarFinder("email", event.target.value)}
                        placeholder="name@example.com"
                        autoComplete="email"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="car-finder-phone">Phone</Label>
                      <Input
                        id="car-finder-phone"
                        type="tel"
                        value={carFinder.phone}
                        onChange={(event) => updateCarFinder("phone", event.target.value)}
                        placeholder="(540) 000-0000"
                        autoComplete="tel"
                        required
                      />
                    </div>
                  </div>
                </section>

                <section className="border-t border-border pt-5">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-foreground">Vehicle preferences</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Provide what you know—you can leave optional fields blank.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="car-finder-make">Preferred make</Label>
                      <Input
                        id="car-finder-make"
                        value={carFinder.make}
                        onChange={(event) => updateCarFinder("make", event.target.value)}
                        placeholder="Example: Toyota"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="car-finder-model">Preferred model</Label>
                      <Input
                        id="car-finder-model"
                        value={carFinder.model}
                        onChange={(event) => updateCarFinder("model", event.target.value)}
                        placeholder="Example: RAV4"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="car-finder-min-year">Minimum year</Label>
                        <Input
                          id="car-finder-min-year"
                          type="number"
                          inputMode="numeric"
                          min="1980"
                          max="2030"
                          value={carFinder.minYear}
                          onChange={(event) => updateCarFinder("minYear", event.target.value)}
                          placeholder="2018"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="car-finder-max-year">Maximum year</Label>
                        <Input
                          id="car-finder-max-year"
                          type="number"
                          inputMode="numeric"
                          min="1980"
                          max="2030"
                          value={carFinder.maxYear}
                          onChange={(event) => updateCarFinder("maxYear", event.target.value)}
                          placeholder="2026"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Body style</Label>
                      <Select
                        value={carFinder.bodyStyle}
                        onValueChange={(value) => updateCarFinder("bodyStyle", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a body style" />
                        </SelectTrigger>
                        <SelectContent>
                          {BODY_STYLES.map((style) => (
                            <SelectItem key={style} value={style}>
                              {style}
                            </SelectItem>
                          ))}
                          <SelectItem value="Other">Other / Not sure</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="car-finder-budget">Maximum budget</Label>
                      <Input
                        id="car-finder-budget"
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={carFinder.maxBudget}
                        onChange={(event) => updateCarFinder("maxBudget", event.target.value)}
                        placeholder="Example: 25000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Do you need financing?</Label>
                      <Select
                        value={carFinder.financingNeeded}
                        onValueChange={(value) => updateCarFinder("financingNeeded", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                          <SelectItem value="unsure">Not sure yet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="car-finder-features">Must-have features</Label>
                      <Input
                        id="car-finder-features"
                        value={carFinder.features}
                        onChange={(event) => updateCarFinder("features", event.target.value)}
                        placeholder="Example: AWD, third-row seating, backup camera"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="car-finder-message">Additional notes</Label>
                      <Textarea
                        id="car-finder-message"
                        value={carFinder.message}
                        onChange={(event) => updateCarFinder("message", event.target.value)}
                        placeholder="Tell us about mileage, color, monthly payment, or anything else that matters."
                        rows={4}
                      />
                    </div>
                  </div>
                </section>
              </div>
            </LeadForm>
          </div>
        </DialogContent>
      </Dialog>

      {/* FOOTER */}
    </>
  );
}

function HeroCard({
  icon,
  title,
  body,
  cta,
  to,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  to: "/finance" | "/sell";
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 p-5 text-primary-foreground backdrop-blur-md transition hover:bg-primary-foreground/15 md:p-6"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-lg font-bold">{title}</div>
        <div className="text-sm text-primary-foreground/80">{body}</div>
      </div>
      <span className="hidden shrink-0 items-center gap-1 rounded-full bg-card px-4 py-2 text-sm font-bold text-card-foreground transition group-hover:bg-accent group-hover:text-accent-foreground sm:inline-flex">
        {cta} <ArrowRight className="size-4" />
      </span>
    </Link>
  );
}
