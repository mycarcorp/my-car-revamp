import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Car,
  Handshake,
  MapPin,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import heroLot from "@/assets/hero-lot.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VehicleCard } from "@/components/VehicleCard";
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
      { title: "MyCar — Used Cars, Trucks & SUVs in Fredericksburg, VA" },
      {
        name: "description",
        content:
          "Browse MyCar's current used vehicle inventory in Fredericksburg, Virginia. Real monthly payment estimates, financing for all credit types, and instant trade-in reviews.",
      },
      { property: "og:title", content: "MyCar — Used Cars in Fredericksburg, VA" },
      {
        property: "og:description",
        content:
          "Current used vehicle inventory, payment estimates and trade-in offers from an independent Fredericksburg dealership.",
      },
    ],
  }),
  component: Home,
});

const BODY_STYLES = ["SUV", "Sedan", "Truck", "Coupe", "Hatchback", "Convertible", "Minivan", "Wagon"];

function Home() {
  const { data: settings } = useQuery(siteSettingsQuery());
  const { data: featured } = useQuery(featuredVehiclesQuery());
  const { data: facets } = useQuery(facetsQuery());
  const { data: collections } = useQuery(collectionsQuery());
  const { data: areas } = useQuery(serviceAreasQuery());
  const [term, setTerm] = useState("");
  const badges = (settings?.trust_badges ?? []) as { label: string; enabled: boolean }[];

  return (
    <>
      {/* HERO */}
      <section className="relative isolate overflow-hidden">
        <img
          src={heroLot}
          alt="Used vehicles lined up on the MyCar dealership lot in Fredericksburg, Virginia"
          width={1920}
          height={1080}
          className="absolute inset-0 size-full object-cover"
        />
        <div className="hero-surface absolute inset-0 opacity-90" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 md:py-32">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            Fredericksburg, Virginia
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-tight text-primary-foreground md:text-6xl">
            Right car. Right price. No games.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-primary-foreground/85">
            {facets?.total
              ? `${facets.total} inspected used vehicles on the lot right now — each with a real monthly payment estimate.`
              : "Inspected used vehicles with a real monthly payment estimate on every listing."}
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
              className="h-12 bg-background text-foreground"
              aria-label="Search inventory"
            />
            <Button type="submit" size="lg" variant="secondary" className="h-12">
              <Search className="size-4" /> Search
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/search">Browse all vehicles</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-background/10 text-primary-foreground">
              <Link to="/finance">Get pre-qualified</Link>
            </Button>
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

      {/* DUAL CTA */}
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-14 md:grid-cols-2">
        <div className="card-lift rounded-xl border border-border bg-card p-8">
          <Banknote className="size-8 text-accent" />
          <h2 className="mt-4 font-display text-2xl font-bold">Financing made simple</h2>
          <p className="mt-2 text-muted-foreground">
            Tell us what works for your budget and our finance team lines up lenders for your
            situation. Submitting the form is a request, not a credit application — no bureau pull.
          </p>
          <Button asChild className="mt-5">
            <Link to="/finance">
              Start a finance request <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="card-lift rounded-xl border border-border bg-card p-8">
          <Handshake className="size-8 text-accent" />
          <h2 className="mt-4 font-display text-2xl font-bold">Sell or trade your car</h2>
          <p className="mt-2 text-muted-foreground">
            Send us the VIN or plate plus mileage and condition. We review every vehicle by hand and
            respond with a real number, usually the same business day.
          </p>
          <Button asChild className="mt-5">
            <Link to="/sell">
              Get your offer <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* BODY STYLES */}
      <section className="mx-auto max-w-7xl px-4 pb-14">
        <h2 className="font-display text-2xl font-bold">Popular vehicle styles</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {BODY_STYLES.map((style) => {
            const count = facets?.bodies.find((b) => b.value === style)?.count ?? 0;
            return (
              <Link
                key={style}
                to="/search"
                search={{ body: style }}
                className="card-lift flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center"
              >
                <Car className="size-6 text-primary" />
                <span className="text-sm font-semibold">{style}</span>
                <span className="text-xs text-muted-foreground">{count} available</span>
              </Link>
            );
          })}
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
        {featured && featured.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((v) => (
              <VehicleCard key={v.id} vehicle={v} settings={settings} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-border p-10 text-center">
            <p className="font-medium">Inventory is being loaded.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Our current stock list is being imported. Call {settings?.phone ?? "(540) 426-3322"} and
              we'll tell you exactly what's on the lot today.
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link to="/contact">Ask about a specific vehicle</Link>
            </Button>
          </div>
        )}
      </section>

      {/* COLLECTIONS */}
      {collections && collections.length > 0 && (
        <section className="bg-surface py-14">
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="font-display text-2xl font-bold">Explore cars you'll love</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {collections.map((c) => (
                <a
                  key={c.id}
                  href={`/search${c.filter_query}`}
                  className="card-lift flex flex-col rounded-xl border border-border bg-card p-6"
                >
                  <BadgeCheck className="size-6 text-accent" />
                  <h3 className="mt-3 font-display text-lg font-semibold">{c.title}</h3>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{c.description}</p>
                  <span className="mt-4 text-sm font-semibold text-primary">Shop now →</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* MAKES */}
      {facets && facets.makes.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14">
          <h2 className="font-display text-2xl font-bold">Shop by make</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {facets.makes.map((m) => (
              <Link
                key={m.value}
                to="/search"
                search={{ make: m.value }}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary"
              >
                {m.value} <span className="text-muted-foreground">({m.count})</span>
              </Link>
            ))}
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
    </>
  );
}
