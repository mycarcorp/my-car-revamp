import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Camera, Check, Heart, Phone, Play } from "lucide-react";
import { isVideoUrl } from "@/lib/vehicle-media";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LeadForm } from "@/components/LeadForm";
import { VehicleCard } from "@/components/VehicleCard";
import { useAuth } from "@/hooks/useAuth";
import { mirrorSavedVehicleToLegacy } from "@/lib/legacy-mirror.functions";
import { supabase } from "@/integrations/supabase/app-client";
import { formatMiles, formatUsd, monthlyPayment, vehicleTitle } from "@/lib/format";
import {
  similarVehiclesQuery,
  siteSettingsQuery,
  vehicleBySlugQuery,
  type VehicleWithPhotos,
} from "@/lib/queries";

export const Route = createFileRoute("/inventory/$slug")({
  loader: async ({ context, params }) => {
    const vehicle = await context.queryClient.ensureQueryData(vehicleBySlugQuery(params.slug));
    if (!vehicle) throw notFound();
    return { vehicle };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Vehicle unavailable — MyCar" }, { name: "robots", content: "noindex" }],
      };
    }
    const v = loaderData.vehicle as VehicleWithPhotos;
    const title = `${vehicleTitle(v)} for sale in Fredericksburg, VA — MyCar`;
    const description = `${vehicleTitle(v)} with ${formatMiles(v.mileage)} at ${formatUsd(Number(v.price_cents))}. Stock #${v.stock_number}. VIN ${v.vin}.`;
    const image = [...(v.vehicle_photos ?? [])].sort((a, b) => a.position - b.position)[0]?.url;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
    ];
    if (image?.startsWith("https://")) {
      meta.push({ property: "og:image", content: image }, { name: "twitter:image", content: image });
    }
    return { meta };
  },
  component: VehicleDetail,
});

function VehicleDetail() {
  const { vehicle } = Route.useLoaderData();
  const v = vehicle as VehicleWithPhotos;
  const { data: settings } = useQuery(siteSettingsQuery());
  const { data: similar } = useQuery(similarVehiclesQuery(v.body_style, v.id));
  const { user } = useAuth();
  const photos = [...(v.vehicle_photos ?? [])].sort((a, b) => a.position - b.position);
  const [active, setActive] = useState(0);
  const [failedPhotoIds, setFailedPhotoIds] = useState<string[]>([]);
  const markFailed = (id: string) =>
    setFailedPhotoIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const [saved, setSaved] = useState(false);
  const [savingBusy, setSavingBusy] = useState(false);

  const payment = settings
    ? monthlyPayment(Number(v.price_cents), {
        apr: Number(settings.finance_apr),
        termMonths: settings.finance_term_months,
        downPercent: Number(settings.finance_down_percent),
      })
    : null;

  useEffect(() => {
    let active = true;
    if (!user) {
      setSaved(false);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("saved_vehicles")
        .select("id")
        .eq("user_id", user.id)
        .eq("vehicle_id", v.id)
        .maybeSingle();
      if (active) setSaved(!!data);
    })();
    return () => {
      active = false;
    };
  }, [user, v.id]);

  async function mirrorSave(action: "save" | "unsave") {
    const { data: session } = await supabase.auth.getSession();
    const accessToken = session.session?.access_token;
    if (!accessToken) return;
    await mirrorSavedVehicleToLegacy({ data: { accessToken, vehicleId: v.id, action } }).catch(
      () => undefined,
    );
  }

  async function toggleSave() {
    if (!user) {
      toast.info("Sign in to save this vehicle to your account.");
      return;
    }
    setSavingBusy(true);
    if (saved) {
      const { error } = await supabase
        .from("saved_vehicles")
        .delete()
        .eq("user_id", user.id)
        .eq("vehicle_id", v.id);
      setSavingBusy(false);
      if (error) {
        toast.error("Could not remove this vehicle.");
        return;
      }
      setSaved(false);
      void mirrorSave("unsave");
      toast.success("Removed from your saved vehicles.");
      return;
    }
    const { error } = await supabase
      .from("saved_vehicles")
      .insert({ user_id: user.id, vehicle_id: v.id });
    setSavingBusy(false);
    if (error && !error.message.includes("duplicate")) {
      toast.error("Could not save this vehicle.");
      return;
    }
    setSaved(true);
    void mirrorSave("save");
    toast.success("Saved to your account.");
  }

  const specs: [string, string][] = [
    ["VIN", v.vin],
    ["Stock number", v.stock_number],
    ["Mileage", formatMiles(v.mileage)],
    ["Body style", v.body_style],
    ["Exterior color", v.exterior_color ?? "—"],
    ["Interior color", v.interior_color ?? "—"],
    ["Transmission", v.transmission ?? "—"],
    ["Drivetrain", v.drivetrain ?? "—"],
    ["Fuel type", v.fuel_type ?? "—"],
    ["Engine", v.engine ?? "—"],
    ["Combined MPG", v.mpg_combined ? String(v.mpg_combined) : "—"],
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: vehicleTitle(v),
    vehicleIdentificationNumber: v.vin,
    brand: { "@type": "Brand", name: v.make },
    model: v.model,
    vehicleModelDate: String(v.year),
    bodyType: v.body_style,
    mileageFromOdometer: { "@type": "QuantitativeValue", value: v.mileage, unitCode: "SMI" },
    offers: {
      "@type": "Offer",
      price: (Number(v.price_cents) / 100).toFixed(2),
      priceCurrency: v.currency,
      availability:
        v.status === "available"
          ? "https://schema.org/InStock"
          : "https://schema.org/LimitedAvailability",
      seller: { "@type": "AutoDealer", name: "MyCar", areaServed: "Fredericksburg, VA" },
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="text-sm text-muted-foreground">
        <Link to="/search" className="hover:text-primary">
          Inventory
        </Link>{" "}
        / <span className="text-foreground">{vehicleTitle(v)}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-muted">
            {photos[active] && !failedPhotoIds.includes(photos[active].id) ? (
              isVideoUrl(photos[active].url) ? (
                <video
                  key={photos[active].url}
                  src={photos[active].url}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  onError={() => markFailed(photos[active]!.id)}
                  className="max-h-[420px] w-full bg-black object-contain"
                />
              ) : (
                <img
                  src={photos[active].url}
                  alt={photos[active].alt ?? vehicleTitle(v)}
                  onError={() => markFailed(photos[active]!.id)}
                  className="max-h-[420px] w-full object-contain"
                />
              )
            ) : (
              <div className="flex h-[280px] w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <Camera className="size-8" />
                <span className="text-sm">Photos of this vehicle are being uploaded</span>
              </div>
            )}
          </div>
          {photos.length > 1 && (
            <div className="mx-auto mt-3 grid w-full max-w-2xl grid-cols-4 gap-2 sm:grid-cols-6">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setActive(i)}
                  className={`relative aspect-[4/3] overflow-hidden rounded-md border ${
                    i === active ? "border-primary" : "border-border"
                  }`}
                >
                  {isVideoUrl(p.url) ? (
                    <>
                      <video src={p.url} muted playsInline preload="metadata" className="size-full bg-black object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Play className="size-5 text-white" />
                      </span>
                    </>
                  ) : (
                    <img
                      src={p.url}
                      alt={p.alt ?? `${vehicleTitle(v)} photo ${i + 1}`}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          )}


          <section className="mt-10">
            <h2 className="font-display text-xl font-bold">Specifications</h2>
            <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {specs.map(([k, val]) => (
                <div key={k} className="flex justify-between border-b border-border py-2 text-sm">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{val}</dd>
                </div>
              ))}
            </dl>
          </section>

          {v.features.length > 0 && (
            <section className="mt-10">
              <h2 className="font-display text-xl font-bold">Equipment</h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {v.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="size-4 text-success" /> {f}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {v.description && (
            <section className="mt-10">
              <h2 className="font-display text-xl font-bold">About this vehicle</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {v.description}
              </p>
            </section>
          )}

          {v.history_report_url && (
            <a
              href={v.history_report_url}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-6 inline-block text-sm font-semibold text-primary hover:underline"
            >
              View the vehicle history report
            </a>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold">{vehicleTitle(v)}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatMiles(v.mileage)} · Stock #{v.stock_number}
                </p>
              </div>
              {v.status !== "available" && <Badge variant="secondary">Sale pending</Badge>}
            </div>

            <p className="mt-5 font-display text-3xl font-extrabold">
              {formatUsd(Number(v.price_cents))}
            </p>
            {payment != null && settings && (
              <div className="mt-2 rounded-lg bg-surface p-3 text-sm">
                <p className="font-semibold text-primary">Est. ${payment}/mo</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {settings.finance_term_months} months at {Number(settings.finance_apr)}% APR with{" "}
                  {Number(settings.finance_down_percent)}% down. {settings.finance_disclosure}
                </p>
              </div>
            )}

            <div className="mt-5 grid gap-2">
              <Button asChild size="lg">
                <a href="#availability">Check availability</a>
              </Button>
              <Button asChild variant="outline">
                <Link to="/finance">Get pre-qualified</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/schedule">Schedule a test drive</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/sell">Value my trade</Link>
              </Button>
              <Button variant="ghost" onClick={toggleSave} disabled={savingBusy}>
                <Heart className={saved ? "size-4 fill-accent text-accent" : "size-4"} />
                {saved ? "Saved — remove" : "Save this vehicle"}
              </Button>
              <a
                href={`tel:${(settings?.phone ?? "").replace(/\D/g, "")}`}
                className="mt-1 flex items-center justify-center gap-2 text-sm font-semibold"
              >
                <Phone className="size-4 text-accent" /> {settings?.phone}
              </a>
            </div>
          </div>

          <div id="availability" className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-lg font-bold">Check availability</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll confirm this vehicle is still on the lot and answer any questions.
            </p>
            <div className="mt-4">
              <LeadForm
                leadType="availability"
                vehicleId={v.id}
                vehicle={{
                  id: v.id,
                  vin: v.vin,
                  stock_number: v.stock_number,
                  year: v.year,
                  make: v.make,
                  model: v.model,
                  trim: v.trim,
                }}
                submitLabel="Check availability"
                messageLabel="Questions about this vehicle"
                successTitle="We're on it"
                successBody="We'll confirm availability and get back to you shortly."
              />
            </div>
          </div>
        </aside>
      </div>

      {similar && similar.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-2xl font-bold">Similar vehicles</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((s) => (
              <VehicleCard key={s.id} vehicle={s} settings={settings} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
