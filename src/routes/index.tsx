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
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LeadForm } from "@/components/LeadForm";
import { vehicleMedia } from "@/components/VehicleCard";
import { HomeRail } from "@/components/home/HomeRail";
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
import heroImage from "@/assets/home-hero-dealership-v3.jpg";
import greeterImage from "@/assets/explore-greeter.png";
import { CustomerGallery } from "@/components/home/CustomerGallery";
import { DealershipMap } from "@/components/home/DealershipMap";
import { ScrollReveal } from "@/components/home/ScrollReveal";
import { HeroMedia } from "@/components/home/HeroMedia";
import { getPublishedHeroFn, type HeroSettings } from "@/lib/home-gallery.functions";

import { formatUsd } from "@/lib/format";
import bodySuv from "@/assets/body-suv.png";
import bodySedan from "@/assets/body-sedan.png";
import bodyTruck from "@/assets/body-truck.png";
import bodyCoupe from "@/assets/body-coupe.png";
import bodyHatch from "@/assets/body-hatchback.png";
import bodyConv from "@/assets/body-convertible.png";
import bodyMinivan from "@/assets/body-minivan.png";
import bodyWagon from "@/assets/body-wagon.png";
import bodyVan from "@/assets/body-van.png";
import exploreBudget from "@/assets/explore-budget.png";
import exploreRecent from "@/assets/explore-recent.jpg";

const BODY_ART: Record<string, string> = {
  SUV: bodySuv,
  Sedan: bodySedan,
  Truck: bodyTruck,
  Coupe: bodyCoupe,
  Hatchback: bodyHatch,
  Convertible: bodyConv,
  Minivan: bodyMinivan,
  Wagon: bodyWagon,
  Van: bodyVan,
};

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
  const { data: publishedHero } = useQuery({ queryKey: ["home-hero"], queryFn: () => getPublishedHeroFn(), staleTime: 60_000 });
  const { data: facets } = useQuery(facetsQuery());
  const { data: all } = useQuery(allVehiclesQuery());
  // Admin hero editor loads this page in a frame (?heroPreview=1) and streams draft settings in.
  const [draftHero, setDraftHero] = useState<HeroSettings | null>(null);
  const [isHeroPreview, setIsHeroPreview] = useState(false);
  useEffect(() => {
    if (!window.location.search.includes("heroPreview=1") || window.parent === window) return;
    setIsHeroPreview(true);
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== "mycar-hero-preview") return;
      setDraftHero(e.data.settings as HeroSettings);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "mycar-hero-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  const hero = draftHero ?? publishedHero;
  const realVisitor = useVisitorState();
  const visitor = isHeroPreview ? { ...realVisitor, returning: false, summary: null } : realVisitor;
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
        body: "Great rides with quality you can count on — at a price you'll love.",
        cta: "Explore Budget Options",
        count: under.length,
        image: firstCover(under),
        search: { priceMax: 20000 },
        tone: "light",
        art: exploreBudget,
        artClass: "absolute bottom-0 right-0 h-[78%] w-auto object-contain",
      },
      {
        key: "recent",
        title: "Fresh arrivals",
        body: "The newest arrivals on our lot.",
        cta: "Shop New Arrivals",
        count: recent.length,
        image: firstCover(recent),
        search: { sort: "newest" },
        tone: "navy",
        art: exploreRecent,
        artClass: "absolute inset-x-0 bottom-0 h-[70%] w-full object-cover opacity-90",
      },
      {
        key: "deals",
        title: "Discover Great Deals!",
        body: "Our team is ready to help you find a great car at a great price.",
        cta: "Find Your Deal",
        count: drops.length,
        image: firstCover(drops),
        search: drops.length ? { deal: "price-drop" } : {},
        tone: "muted",
        art: greeterImage,
        artClass: "absolute bottom-0 left-1/2 h-[66%] w-auto -translate-x-1/2 object-contain",
      },
      {
        key: "family",
        title: "Room for everyone",
        body: "SUVs and minivans with room for everyone.",
        cta: "Shop Family Cars",
        count: family.length,
        image: firstCover(family),
        search: { body: "SUV|Minivan" },
        tone: "dark",
        art: bodyMinivan,
        artClass: "",
      },
    ].filter((c) => c.count > 0 || c.key === "deals");
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
  const dropVehicle = useMemo(() => live.find((v) => isDrop(v) && coverOf(v)), [live]);

  return (
    <>
      {visitor.returning && visitor.summary && <ReturningHero summary={visitor.summary} />}

      {/* HERO */}
      <section className={visitor.returning ? "hidden" : "relative isolate overflow-hidden bg-primary"}>
        <HeroMedia
          src={hero?.imageUrl ?? heroImage}
          alt="Smiling My Car team member handing over car keys in front of the My Car dealership"
          frames={hero?.frames}
          overlay={hero?.overlay ?? { left: 70, bottom: 40, shadow: 0, direction: "both" }}
        />

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

          itemClassName="basis-1/3 sm:basis-1/5 lg:basis-[14.28%]"
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
              className="group flex flex-col items-center gap-2 py-2 text-center"
            >
              <span className="text-sm font-medium text-foreground transition group-hover:text-primary group-hover:font-bold">
                {BODY_LABELS[s.style] ?? s.style}
              </span>
              <img
                src={BODY_ART[s.style]}
                alt={`${s.style} in stock`}
                loading="lazy"
                width={992}
                height={672}
                className="h-20 w-auto object-contain drop-shadow-[0_8px_6px_rgba(0,0,0,0.12)] transition duration-500 ease-out group-hover:-translate-y-1 group-hover:translate-x-2 group-hover:scale-110"
              />
            </Link>
          ))}
        </HomeRail>
      )}

      {/* EXPLORE CARS YOU'LL LOVE */}
      {discovery.length > 0 && (
        <div className="bg-surface">
          <HomeRail title="Explore cars you'll love" itemClassName="basis-[85%] sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
            {discovery.map((c) => {
              const dark = c.tone === "navy" || c.tone === "dark";
              const bg = {
                light: "bg-[oklch(0.86_0.08_235)]",
                navy: "bg-primary",
                muted: "bg-secondary",
                dark: "bg-foreground",
              }[c.tone];
              return (
                <Link
                  key={c.key}
                  to="/search"
                  search={c.search}
                  className={`group relative flex h-[22rem] flex-col overflow-hidden rounded-2xl ${bg} p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]`}
                >
                  <h3
                    className={`relative z-10 font-display text-2xl font-black tracking-tight ${dark ? "text-background" : "text-foreground"}`}
                  >
                    {c.title}
                  </h3>
                  <p
                    className={`relative z-10 mt-2 max-w-[17rem] text-sm leading-6 ${dark ? "text-background/85" : "text-muted-foreground"}`}
                  >
                    {c.body}
                  </p>
                  {c.tone === "dark" ? (
                    <div className="relative z-10 mt-auto mb-20 flex items-center gap-2 rounded-lg bg-card p-3 shadow">
                      <div className="min-w-0 flex-1 text-xs text-card-foreground">
                        <p className="font-bold">SUVs &amp; minivans</p>
                        <p className="text-muted-foreground">{c.count} in stock</p>
                      </div>
                      <img
                        src={c.art}
                        alt=""
                        loading="lazy"
                        className="h-14 w-auto object-contain transition duration-500 group-hover:translate-x-1"
                      />
                    </div>
                  ) : (
                    <img
                      src={c.art}
                      alt=""
                      loading="lazy"
                      className={`${c.artClass} transition duration-500 group-hover:scale-105`}
                    />
                  )}
                  <span
                    className={`absolute inset-x-6 bottom-6 z-10 flex h-12 items-center justify-center rounded-full text-sm font-bold shadow transition ${
                      c.tone === "light" || c.tone === "muted"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-primary"
                    }`}
                  >
                    {c.cta}
                  </span>
                </Link>
              );
            })}
          </HomeRail>
        </div>
      )}

      {/* PRICE DROPS (dynamic) */}
      {dropCount > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-10">
          <div className="relative grid items-center gap-8 overflow-hidden rounded-3xl bg-gradient-to-r from-primary via-primary/90 to-primary px-8 py-12 text-primary-foreground md:grid-cols-2 md:px-16">
            <div>
              <h2 className="font-display text-2xl font-bold leading-snug md:text-3xl">
                We&apos;re always repricing inventory to make room for more vehicles.
              </h2>
              <Link
                to="/search"
                search={{ deal: "price-drop" }}
                className="mt-4 inline-block font-semibold underline underline-offset-4 hover:text-accent"
              >
                Shop All {dropCount} Price {dropCount === 1 ? "Drop" : "Drops"}
              </Link>
            </div>
            {dropVehicle && (
              <Link
                to="/inventory/$slug"
                params={{ slug: dropVehicle.slug }}
                className="relative mx-auto h-48 w-full max-w-md"
              >
                <div className="absolute left-[18%] top-0 w-52 rounded-xl bg-card p-3 shadow-xl">
                  <img
                    src={coverOf(dropVehicle)}
                    alt={`${dropVehicle.year} ${dropVehicle.make} ${dropVehicle.model}`}
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-lg object-cover"
                  />
                  <div className="mt-3 h-2.5 w-3/4 rounded bg-muted" />
                  <div className="mt-2 h-2.5 w-1/2 rounded bg-muted" />
                </div>
                <span className="absolute left-0 top-3 -rotate-3 rounded-full bg-success px-4 py-2 text-sm font-bold text-success-foreground shadow-lg">
                  Price Drop
                </span>
                <div className="absolute right-0 top-14 flex rotate-3 items-center gap-3 rounded-xl bg-card px-4 py-3 text-card-foreground shadow-xl">
                  <span className="flex size-9 items-center justify-center rounded-full bg-success text-success-foreground">
                    <TrendingDown className="size-5" />
                  </span>
                  <div>
                    <div className="font-display text-2xl font-black">{formatUsd(dropVehicle.price_cents)}</div>
                    <div className="text-xs text-muted-foreground">
                      was <s>{formatUsd(dropVehicle.prior_price_cents)}</s>
                    </div>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}
      {/* POPULAR MODELS */}
      {/* POPULAR MODELS */}
      {models.length > 0 && (
        <HomeRail title="Shop popular models" itemClassName="basis-[62%] sm:basis-1/3 lg:basis-1/5">
          {models.map((m) => (
            <Link
              key={`${m.make}-${m.model}`}
              to="/search"
              search={{ make: m.make, model: m.model }}
              className="group flex h-full flex-col rounded-2xl bg-surface p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
            >
              <div className="text-sm text-muted-foreground">{m.make}</div>
              <div className="font-display text-lg font-bold">{m.model}</div>
              <div className="mt-6 aspect-[4/3] overflow-hidden rounded-xl">
                <img
                  src={m.image}
                  alt={`${m.make} ${m.model}`}
                  loading="lazy"
                  className="h-full w-full object-cover mix-blend-multiply transition duration-500 group-hover:scale-105"
                />
              </div>
            </Link>
          ))}
        </HomeRail>
      )}

      {/* BRAND STORY */}
      <BrandStory />

      <CustomerGallery />

      <DealershipMap phone={(settings as { phone?: string | null } | null | undefined)?.phone ?? null} />

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
