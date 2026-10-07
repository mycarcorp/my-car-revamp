import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Car,
  Handshake,
  Linkedin,
  MapPin,
  Search,
  ShieldCheck,
  Youtube,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LeadForm } from "@/components/LeadForm";
import { VehicleCard } from "@/components/VehicleCard";
import { useAuth } from "@/hooks/useAuth";
import { ctaButtonClass } from "@/lib/ui";
import {
  collectionsQuery,
  facetsQuery,
  featuredVehiclesQuery,
  serviceAreasQuery,
  siteSettingsQuery,
} from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { name: "google-site-verification", content: "Treiv8fZAqKhNjSJYJtOYmyeg951BzF57RSn7uXJoWs" },
      {
        title: "Used Car Dealership in Fredericksburg, VA | My Car",
      },
      {
        name: "description",
        content:
          "Shop quality used cars, trucks and SUVs in Fredericksburg, VA. Explore financing options, trade in your vehicle, sell your car, or schedule a test drive with My Car.",
      },
      {
        property: "og:title",
        content: "Used Car Dealership in Fredericksburg, VA | My Car",
      },
      {
        property: "og:description",
        content:
          "Shop quality used cars, trucks and SUVs in Fredericksburg, VA. Explore financing options, trade in your vehicle, sell your car, or schedule a test drive with My Car.",
      },
      {
        property: "og:url",
        content: "https://mycarcorp.com/",
      },
      {
        property: "og:type",
        content: "website",
      },
    ],

    links: [
      {
        rel: "canonical",
        href: "https://mycarcorp.com/",
      },
    ],
  }),

  component: Home,
});

const BODY_STYLES = ["SUV", "Sedan", "Truck", "Coupe", "Hatchback", "Convertible", "Minivan", "Wagon"];

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

const makeVehicleImages: Record<string, string> = {
  tesla: "https://assets.fastly.carvana.io/merchui/images/home/popular-models/tesla-model-3.png?format=auto&quality=90",
  chevrolet:
    "https://assets.fastly.carvana.io/merchui/images/home/popular-models/chevrolet-equinox.png?format=auto&quality=90",
  toyota: "https://assets.fastly.carvana.io/merchui/images/home/popular-models/toyota-camry.png?format=auto&quality=90",
  honda: "https://assets.fastly.carvana.io/merchui/images/home/popular-models/honda-accord.png?format=auto&quality=90",
  ford: "https://assets.fastly.carvana.io/merchui/images/home/popular-models/ford-f150.png?format=auto&quality=90",
  jeep: "https://assets.fastly.carvana.io/merchui/images/home/popular-models/jeep-grand-cherokee.png?format=auto&quality=90",
  nissan:
    "https://assets.fastly.carvana.io/merchui/images/home/popular-models/tesla-model-3.png?format=auto&quality=90",
  hyundai:
    "https://assets.fastly.carvana.io/merchui/images/home/popular-models/toyota-camry.png?format=auto&quality=90",
  kia: "https://assets.fastly.carvana.io/merchui/images/home/popular-models/chevrolet-equinox.png?format=auto&quality=90",
  subaru: "https://assets.fastly.carvana.io/merchui/images/home/popular-models/honda-accord.png?format=auto&quality=90",
  bmw: "https://assets.fastly.carvana.io/merchui/images/home/popular-models/ford-f150.png?format=auto&quality=90",
  mercedes:
    "https://assets.fastly.carvana.io/merchui/images/home/popular-models/jeep-grand-cherokee.png?format=auto&quality=90",
  lexus: "https://assets.fastly.carvana.io/merchui/images/home/popular-models/toyota-camry.png?format=auto&quality=90",
  acura: "https://assets.fastly.carvana.io/merchui/images/home/popular-models/honda-accord.png?format=auto&quality=90",
  mazda:
    "https://assets.fastly.carvana.io/merchui/images/home/popular-models/chevrolet-equinox.png?format=auto&quality=90",
  volkswagen:
    "https://assets.fastly.carvana.io/merchui/images/home/popular-models/tesla-model-3.png?format=auto&quality=90",
  chrysler:
    "https://assets.fastly.carvana.io/merchui/images/home/popular-models/jeep-grand-cherokee.png?format=auto&quality=90",
  gmc: "https://assets.fastly.carvana.io/merchui/images/home/popular-models/ford-f150.png?format=auto&quality=90",
  buick:
    "https://assets.fastly.carvana.io/merchui/images/home/popular-models/chevrolet-equinox.png?format=auto&quality=90",
  cadillac:
    "https://assets.fastly.carvana.io/merchui/images/home/popular-models/tesla-model-3.png?format=auto&quality=90",
  dodge:
    "https://assets.fastly.carvana.io/merchui/images/home/popular-models/jeep-grand-cherokee.png?format=auto&quality=90",
};

function getMakeVehicleImage(make: string) {
  const key = make.trim().toLowerCase();
  return (
    makeVehicleImages[key] ??
    "https://assets.fastly.carvana.io/merchui/images/home/popular-models/tesla-model-3.png?format=auto&quality=90"
  );
}

function Home() {
  const { user } = useAuth();
  const { data: settings } = useQuery(siteSettingsQuery());
  const { data: featured, isLoading: featuredLoading } = useQuery(featuredVehiclesQuery());
  const { data: facets, isLoading: facetsLoading } = useQuery(facetsQuery());
  const { data: areas } = useQuery(serviceAreasQuery());
  const [term, setTerm] = useState("");
  const [carFinderOpen, setCarFinderOpen] = useState(false);
  const [carFinder, setCarFinder] = useState<CarFinderForm>(EMPTY_CAR_FINDER_FORM);
  const [marqueePaused, setMarqueePaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const badges = (settings?.trust_badges ?? []) as { label: string; enabled: boolean }[];
  const displayName =
    String(user?.user_metadata?.["full_name"] ?? user?.user_metadata?.["name"] ?? "")
      .trim()
      .split(/\s+/)[0] ||
    user?.email?.split("@")[0] ||
    "there";

  const updateCarFinder = (field: keyof CarFinderForm, value: string) => {
    setCarFinder((current) => ({ ...current, [field]: value }));
  };

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateReducedMotion = () => setReduceMotion(media.matches);

    updateReducedMotion();
    media.addEventListener("change", updateReducedMotion);

    return () => media.removeEventListener("change", updateReducedMotion);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        @keyframes marquee {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(calc(-50% - 0.5rem), 0, 0); }
        }

        .popular-models-marquee {
          display: flex;
          width: max-content;
          min-width: max-content;
          animation: marquee 38s linear infinite;
          animation-play-state: running;
          will-change: transform;
        }

        .popular-models-marquee:hover,
        .popular-models-marquee:focus-within,
        .popular-models-marquee:active {
          animation-play-state: paused;
        }

        @media (pointer: coarse) {
          .popular-models-marquee {
            animation-play-state: paused;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .popular-models-marquee {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* HERO */}
      <section className="relative isolate overflow-hidden bg-[#07111b]">
        <img
          src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1800&q=80"
          alt="Modern premium car highlighted on the MyCar dealership lot"
          width={1800}
          height={1100}
          className="absolute inset-0 z-0 h-full w-full object-cover object-center opacity-95"
          style={{ filter: "brightness(1.08) contrast(1.06) saturate(1.1)" }}
        />
        <div
          className="absolute inset-0 z-10"
          style={{
            background:
              "linear-gradient(90deg, rgba(4,9,15,0.94) 0%, rgba(7,17,27,0.85) 20%, rgba(7,17,27,0.68) 38%, rgba(7,17,27,0.3) 58%, rgba(7,17,27,0.06) 76%, rgba(7,17,27,0) 100%)",
          }}
        />
        <div className="absolute inset-y-0 right-0 z-10 hidden w-[28%] bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.18),_transparent_60%)] md:block" />
        <div className="relative z-20 mx-auto max-w-7xl px-4 py-20 md:py-28 lg:py-32">
          <div className="max-w-xl lg:max-w-[540px]">
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-200/80 backdrop-blur-sm">
              Trusted local dealership
            </div>
            <h1
              className="mt-5 text-base font-semibold tracking-wide text-white sm:text-lg"
              style={{ fontFamily: '"Inter", "Segoe UI", sans-serif' }}
            >
              Used Cars, Trucks & SUVs in Fredericksburg, VA
            </h1>

            <p
              className="mt-3 max-w-[520px] text-[3.4rem] font-black leading-[0.95] tracking-[-0.055em] text-white sm:text-[4.5rem] md:text-[5rem] lg:text-[5.4rem]"
              style={{ fontFamily: '"Inter", "Segoe UI", sans-serif' }}
            >
              Right car.
              <span className="block">Right price.</span>
            </p>

            <p className="mt-5 max-w-lg text-base leading-7 text-slate-200/90 md:text-lg">
              {user
                ? `Welcome back, ${displayName}! Pick up where you left off and find the right next step for your car journey.`
                : facets?.total
                  ? `Search ${facets.total.toLocaleString()} used vehicles with real monthly payment estimates.`
                  : "Browse inspected used cars, trucks and SUVs in Fredericksburg, VA with real monthly payment estimates on every listing."}
            </p>

            <form
              className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                window.location.href = `/search?q=${encodeURIComponent(term)}`;
              }}
            >
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search by make, model or trim"
                className="h-12 border-white/10 bg-white/10 text-white placeholder:text-slate-300/80 focus-visible:ring-[#F7941D]"
                aria-label="Search inventory"
              />
              <Button
                type="submit"
                size="lg"
                className="h-12 bg-[#F7941D] px-6 text-base font-semibold text-slate-950 shadow-[0_10px_24px_rgba(247,148,29,0.35)] transition hover:bg-[#ea8718]"
              >
                <Search className="size-4" /> Search
              </Button>
            </form>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className={ctaButtonClass}>
                <Link to="/search">Browse all vehicles</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/20 bg-white/5 px-6 text-base font-semibold text-white hover:bg-white/10"
              >
                <Link to="/finance">Get pre-qualified</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      {badges.some((b) => b.enabled) && (
        <section className="border-b border-border bg-surface">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
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
      <section className="mx-auto max-w-7xl px-4 pb-14 mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold">Popular vehicle styles</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Counts reflect vehicles currently available in our live inventory.
            </p>
          </div>
          <Link to="/search" className="text-sm font-semibold text-primary hover:underline">
            View all inventory
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {BODY_STYLES.map((style) => {
            const count = facets?.bodies.find((b) => b.value === style)?.count ?? 0;

            if (facetsLoading || !facets) {
              return (
                <div
                  key={style}
                  className="flex min-h-[126px] animate-pulse flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 text-center"
                  aria-label={`Checking ${style} inventory`}
                >
                  <div className="size-6 rounded bg-muted" />
                  <span className="text-sm font-semibold">{style}</span>
                  <span className="text-xs text-muted-foreground">Checking stock…</span>
                </div>
              );
            }

            if (count === 0) {
              return (
                <div
                  key={style}
                  className="flex min-h-[126px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center"
                >
                  <Car className="size-6 text-muted-foreground" />
                  <span className="text-sm font-semibold">{style}</span>
                  <span className="text-xs leading-4 text-muted-foreground">None currently</span>
                </div>
              );
            }

            return (
              <Link
                key={style}
                to="/search"
                search={{ body: style }}
                className="card-lift flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center"
              >
                <Car className="size-6 text-primary" />
                <span className="text-sm font-semibold">{style}</span>
                <span className="text-xs text-muted-foreground">
                  {count.toLocaleString()} {count === 1 ? "vehicle" : "vehicles"}
                </span>
              </Link>
            );
          })}
        </div>

        {!facetsLoading &&
          facets &&
          BODY_STYLES.some((style) => (facets.bodies.find((body) => body.value === style)?.count ?? 0) === 0) && (
            <div className="mt-5 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-display text-base font-bold">Don&apos;t see the vehicle style you need?</h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Inventory changes often. Browse everything currently available or tell us what you&apos;re looking for
                  and our team will help you find it.
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
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

      {/* DUAL CTA */}
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-14 md:grid-cols-2">
        <div className="card-lift rounded-xl border border-border bg-card p-8">
          <Banknote className="size-8 text-accent" />
          <h2 className="mt-4 font-display text-2xl font-bold">Financing made simple</h2>
          <p className="mt-2 text-muted-foreground">
            Tell us what works for your budget and our finance team lines up lenders for your situation. Submitting the
            form is a request, not a credit application — no bureau pull.
          </p>
          <Button asChild className={`${ctaButtonClass} mt-5`}>
            <Link to="/finance">
              Start a finance request <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="card-lift rounded-xl border border-border bg-card p-8">
          <Handshake className="size-8 text-accent" />
          <h2 className="mt-4 font-display text-2xl font-bold">Sell or trade your car</h2>
          <p className="mt-2 text-muted-foreground">
            Send us the VIN or plate plus mileage and condition. We review every vehicle by hand and respond with a real
            number, usually the same business day.
          </p>
          <Button asChild className={`${ctaButtonClass} mt-5`}>
            <Link to="/sell">
              Get your offer <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* INVENTORY */}
      <section className="mx-auto max-w-7xl px-4 pb-14">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl font-bold">Fresh on the lot</h2>
          <Link to="/search" className="text-sm font-semibold text-primary hover:underline">
            View all inventory
          </Link>
        </div>
        {featuredLoading ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading inventory">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-[340px] animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : featured && featured.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((v) => (
              <VehicleCard key={v.id} vehicle={v} settings={settings} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-border bg-surface/40 px-6 py-10 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
              <Car className="size-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold">
              {facets?.total === 0 ? "No vehicles currently available" : "Fresh arrivals are being updated"}
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Inventory changes frequently. Browse the complete inventory or use Car Finder to tell us exactly what
              you&apos;re looking for, and our team will help with the next step.
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

      {/* COLLECTIONS */}
      <section className="bg-surface py-14">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="font-display text-2xl font-bold">Explore cars you'll love</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <a
              href="https://mycarcorp.com/search"
              className="card-lift flex flex-col overflow-hidden rounded-xl border border-border bg-[#f5f5f5] p-4 text-left"
            >
              <div className="flex min-h-[220px] items-center justify-center rounded-lg bg-white px-3 py-4">
                <img
                  src="https://assets.fastly.carvana.io/home-assets/nba/sedan.png?width=200"
                  alt="Sedan"
                  className="h-28 w-auto object-contain"
                />
              </div>
              <div className="mt-4 flex-1">
                <h3 className="font-display text-xl font-bold text-foreground">Cars under $20K</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Great rides with quality you can count on — at a price you'll love.
                </p>
              </div>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                Explore budget options <ArrowRight className="size-4" />
              </span>
            </a>

            <a
              href="https://mycarcorp.com/search"
              className="card-lift flex flex-col overflow-hidden rounded-xl border border-border bg-[#f5f5f5] p-4 text-left"
            >
              <div className="flex min-h-[220px] items-center justify-center rounded-lg bg-white px-3 py-4">
                <img
                  src="https://assets.fastly.carvana.io/home-assets/nba/suv.png?width=200"
                  alt="SUV"
                  className="h-28 w-auto object-contain"
                />
              </div>
              <div className="mt-4 flex-1">
                <h3 className="font-display text-xl font-bold text-foreground">Discover great deals</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Cars priced $1,500+ below Kelley Blue Book® typical listing price.
                </p>
              </div>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                Find your deal <ArrowRight className="size-4" />
              </span>
            </a>

            <a
              href="https://mycarcorp.com/search"
              className="card-lift flex flex-col overflow-hidden rounded-xl border border-border bg-[#f5f5f5] p-4 text-left"
            >
              <div className="flex min-h-[220px] items-center justify-center rounded-lg bg-white px-3 py-4">
                <img
                  src="https://assets.fastly.carvana.io/home-assets/nba/suv.png?width=200"
                  alt="SUV availability"
                  className="h-28 w-auto object-contain"
                />
              </div>
              <div className="mt-4 flex-1">
                <h3 className="font-display text-xl font-bold text-foreground">Need it fast?</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Based on your location, we've got availability as soon as today!
                </p>
              </div>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                Shop by delivery date <ArrowRight className="size-4" />
              </span>
            </a>

            <a
              href="https://mycarcorp.com/search"
              className="card-lift flex flex-col overflow-hidden rounded-xl border border-border bg-[#f5f5f5] p-4 text-left"
            >
              <div className="flex min-h-[220px] items-center justify-center rounded-lg bg-white px-3 py-4">
                <img
                  src="https://assets.fastly.carvana.io/home-assets/nba/hybrid.png?width=200"
                  alt="Hybrid car"
                  className="h-28 w-auto object-contain"
                />
              </div>
              <div className="mt-4 flex-1">
                <h3 className="font-display text-xl font-bold text-foreground">Go the distance</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Vehicles with 40 MPG/MPGe or greater.</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                Shop fuel efficient <ArrowRight className="size-4" />
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* MAKES */}
      {facets && facets.makes.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14">
          <h2 className="font-display text-2xl font-bold">Shop popular models</h2>

          <div
            className="mt-6 overflow-hidden"
            onMouseEnter={() => setMarqueePaused(true)}
            onMouseLeave={() => setMarqueePaused(false)}
            onTouchStart={() => setMarqueePaused(true)}
            onTouchEnd={() => setMarqueePaused(false)}
          >
            <div className="relative">
              <div
                className="popular-models-marquee gap-4"
                style={{
                  animationPlayState: marqueePaused || reduceMotion ? "paused" : "running",
                }}
              >
                {[...facets.makes, ...facets.makes].map((m, index) => {
                  const model =
                    m.value === "Ford"
                      ? "F-150"
                      : m.value === "Chevrolet"
                        ? "Equinox"
                        : m.value === "Toyota"
                          ? "Camry"
                          : m.value === "Honda"
                            ? "Accord"
                            : m.value === "Tesla"
                              ? "Model 3"
                              : m.value === "Jeep"
                                ? "Grand Cherokee"
                                : m.value;

                  return (
                    <Link
                      key={`${m.value}-${index}`}
                      to="/search"
                      search={{ make: m.value }}
                      className="group block w-[200px] shrink-0 rounded-[20px] border border-border bg-white p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-[#F7941D] hover:shadow-md sm:w-[220px]"
                    >
                      <div className="text-left">
                        <div className="text-base font-semibold text-foreground">{m.value}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{model}</div>
                      </div>
                      <div className="mt-3 flex aspect-square items-center justify-center overflow-hidden rounded-[16px] bg-white p-2">
                        <img
                          src={getMakeVehicleImage(m.value)}
                          alt={`${m.value} ${model}`}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SERVICE AREAS */}
      <section className="mx-auto max-w-7xl px-4 pb-20">
        <h2 className="font-display text-2xl font-bold">Serving the Fredericksburg region</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(areas ?? []).map((a) => (
            <Link
              key={a.id}
              to="/locations/$slug"
              params={{ slug: a.slug }}
              className="card-lift rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-center gap-2 font-semibold">
                <MapPin className="size-4 text-accent" /> Used cars in {a.name}, {a.state}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{a.intro}</p>
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
