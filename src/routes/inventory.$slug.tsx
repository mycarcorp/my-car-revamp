import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Heart,
  Phone,
  Play,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  Images,
  Gauge,
  Fuel,
  ShieldCheck,
  Calculator,
  Copy,
  Info,
  Clock,
  ExternalLink,
  CalendarDays,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { isVideoUrl } from "@/lib/vehicle-media";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LeadForm } from "@/components/LeadForm";
import { VehicleCard } from "@/components/VehicleCard";
import { useAuth } from "@/hooks/useAuth";
import { mirrorSavedVehicleToLegacy } from "@/lib/legacy-mirror.functions";
import { supabase } from "@/integrations/supabase/app-client";
import { formatMiles, formatUsd, monthlyPayment, vehicleTitle } from "@/lib/format";
import {
  allVehiclesQuery,
  similarVehiclesQuery,
  siteSettingsQuery,
  vehicleBySlugQuery,
  type VehicleWithPhotos,
} from "@/lib/queries";

const SITE_URL = "https://mycarcorp.com";

/**
 * Build the canonical public URL for a vehicle detail page.
 */
function getVehicleUrl(slug: string) {
  return `${SITE_URL}/inventory/${encodeURIComponent(slug)}`;
}

/**
 * Converts relative MyCar URLs into absolute public URLs.
 *
 * Examples:
 * /api/public/vehicle-photos/example/photo-1.jpg
 * becomes:
 * https://mycarcorp.com/api/public/vehicle-photos/example/photo-1.jpg
 *
 * Existing absolute URLs remain unchanged.
 */
function toAbsoluteUrl(url: string) {
  const cleanUrl = url.trim();

  if (!cleanUrl) {
    return null;
  }

  if (cleanUrl.startsWith("https://") || cleanUrl.startsWith("http://")) {
    return cleanUrl;
  }

  if (cleanUrl.startsWith("//")) {
    return `https:${cleanUrl}`;
  }

  if (cleanUrl.startsWith("/")) {
    return `${SITE_URL}${cleanUrl}`;
  }

  return `${SITE_URL}/${cleanUrl}`;
}

/**
 * Returns actual vehicle image URLs for SEO/schema.
 *
 * Video URLs are excluded because Product.image should contain
 * vehicle images rather than video files.
 *
 * Relative vehicle image URLs are converted to absolute URLs so
 * Google can crawl them correctly.
 */
function getVehicleImages(vehicle: VehicleWithPhotos) {
  return [...(vehicle.vehicle_photos ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((photo) => {
      if (typeof photo.url !== "string") {
        return null;
      }

      const absoluteUrl = toAbsoluteUrl(photo.url);

      if (!absoluteUrl) {
        return null;
      }

      if (isVideoUrl(absoluteUrl)) {
        return null;
      }

      return absoluteUrl;
    })
    .filter((url): url is string => Boolean(url));
}

/**
 * Use the inventory description when one exists.
 * Otherwise provide a factual fallback based only on vehicle data.
 */
function getVehicleDescription(vehicle: VehicleWithPhotos) {
  const customDescription = typeof vehicle.description === "string" ? vehicle.description.trim() : "";

  if (customDescription) {
    return customDescription;
  }

  const mileage = vehicle.mileage != null ? formatMiles(vehicle.mileage) : null;

  const parts = [
    `Used ${vehicleTitle(vehicle)}`,
    mileage ? `with ${mileage}` : null,
    "available at MyCar in Fredericksburg, VA.",
  ].filter(Boolean);

  return parts.join(" ");
}

/**
 * Ensure Google always receives a valid ISO currency code.
 * MyCar inventory is priced in USD, so USD is the fallback.
 */
function getPriceCurrency(vehicle: VehicleWithPhotos) {
  const currency = typeof vehicle.currency === "string" ? vehicle.currency.trim().toUpperCase() : "";

  return /^[A-Z]{3}$/.test(currency) ? currency : "USD";
}

export const Route = createFileRoute("/inventory/$slug")({
  loader: async ({ context, params }) => {
    const vehicle = await context.queryClient.ensureQueryData(vehicleBySlugQuery(params.slug));

    if (!vehicle) {
      throw notFound();
    }

    return {
      vehicle,
      slug: params.slug,
    };
  },

  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          {
            title: "Vehicle unavailable — MyCar",
          },
          {
            name: "robots",
            content: "noindex",
          },
        ],
      };
    }

    const v = loaderData.vehicle as VehicleWithPhotos;

    const title = `${vehicleTitle(v)} for sale in Fredericksburg, VA — MyCar`;

    const description = `${vehicleTitle(v)} with ${formatMiles(v.mileage)} at ${formatUsd(
      Number(v.price_cents),
    )}. Stock #${v.stock_number}. VIN ${v.vin}.`;

    const canonicalUrl = getVehicleUrl(loaderData.slug);

    const images = getVehicleImages(v);

    const image = images[0];

    const meta: Array<Record<string, string>> = [
      {
        title,
      },
      {
        name: "description",
        content: description,
      },
      {
        name: "robots",
        content: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
      },
      {
        property: "og:title",
        content: title,
      },
      {
        property: "og:description",
        content: description,
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:url",
        content: canonicalUrl,
      },
      {
        name: "twitter:card",
        content: image ? "summary_large_image" : "summary",
      },
      {
        name: "twitter:title",
        content: title,
      },
      {
        name: "twitter:description",
        content: description,
      },
    ];

    if (image) {
      meta.push(
        {
          property: "og:image",
          content: image,
        },
        {
          name: "twitter:image",
          content: image,
        },
      );
    }

    return {
      meta,
      links: [
        {
          rel: "canonical",
          href: canonicalUrl,
        },
      ],
    };
  },

  component: VehicleDetail,
});

function VehicleDetail() {
  const { vehicle, slug } = Route.useLoaderData();

  const v = vehicle as VehicleWithPhotos;

  const { data: settings } = useQuery(siteSettingsQuery());

  const { data: allVehicles } = useQuery(allVehiclesQuery());

  const { data: similar } = useQuery(similarVehiclesQuery(v.body_style, v.id));

  const { user } = useAuth();

  const photos = [...(v.vehicle_photos ?? [])].sort((a, b) => a.position - b.position);

  /*
   * These are absolute, crawlable image URLs used by
   * Product/Vehicle structured data.
   */
  const schemaImages = getVehicleImages(v);

  const canonicalUrl = getVehicleUrl(slug);

  const schemaDescription = getVehicleDescription(v);

  const priceCurrency = getPriceCurrency(v);

  const numericPrice = Number(v.price_cents) / 100;

  const [selectedSection, setSelectedSection] = useState("overview");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryFilter, setGalleryFilter] = useState<"all" | "exterior" | "interior">("all");
  const [downPayment, setDownPayment] = useState(0);
  const [financeMonths, setFinanceMonths] = useState(72);
  const [aprOverride, setAprOverride] = useState<number | null>(null);
  const sectionNavRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const [failedPhotoIds, setFailedPhotoIds] = useState<string[]>([]);

  const markFailed = (id: string) => setFailedPhotoIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

  const [saved, setSaved] = useState(false);

  const [savingBusy, setSavingBusy] = useState(false);

  const currentVehicleIndex = allVehicles?.findIndex((vehicle) => vehicle.id === v.id) ?? -1;

  const previousVehicle = currentVehicleIndex > 0 && allVehicles ? allVehicles[currentVehicleIndex - 1] : null;

  const nextVehicle =
    currentVehicleIndex >= 0 && allVehicles && currentVehicleIndex < allVehicles.length - 1
      ? allVehicles[currentVehicleIndex + 1]
      : null;

  const previousVehicleSlug =
    previousVehicle && typeof previousVehicle.slug === "string" && previousVehicle.slug.trim()
      ? previousVehicle.slug
      : null;

  const nextVehicleSlug =
    nextVehicle && typeof nextVehicle.slug === "string" && nextVehicle.slug.trim() ? nextVehicle.slug : null;

  const payment = settings
    ? monthlyPayment(Number(v.price_cents), {
        apr: Number(settings.finance_apr),
        termMonths: settings.finance_term_months,
        downPercent: Number(settings.finance_down_percent),
      })
    : null;

  useEffect(() => {
    setDownPayment(Math.round((Number(v.price_cents) / 100) * (Number(settings?.finance_down_percent ?? 10) / 100)));
    setFinanceMonths(Number(settings?.finance_term_months ?? 72) || 72);
  }, [v.id, settings?.finance_down_percent, settings?.finance_term_months]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((item) => item.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setSelectedSection(visible[0].target.id.replace("vehicle-", ""));
      },
      { rootMargin: "-125px 0px -45% 0px", threshold: [0, 0.1, 0.3, 0.6] },
    );
    document.querySelectorAll('[data-vehicle-section="true"]').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [v.id]);

  useEffect(() => {
    if (!galleryOpen) return;
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGalleryOpen(false);
      if (event.key === "ArrowRight") setActive((index) => (index + 1) % Math.max(photos.length, 1));
      if (event.key === "ArrowLeft")
        setActive((index) => (index - 1 + Math.max(photos.length, 1)) % Math.max(photos.length, 1));
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [galleryOpen, photos.length]);

  useEffect(() => {
    setActive(0);
    setFailedPhotoIds([]);
  }, [v.id]);

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

      if (active) {
        setSaved(!!data);
      }
    })();

    return () => {
      active = false;
    };
  }, [user, v.id]);

  async function mirrorSave(action: "save" | "unsave") {
    const { data: session } = await supabase.auth.getSession();

    const accessToken = session.session?.access_token;

    if (!accessToken) {
      return;
    }

    await mirrorSavedVehicleToLegacy({
      data: {
        accessToken,
        vehicleId: v.id,
        action,
      },
    }).catch(() => undefined);
  }

  async function toggleSave() {
    if (!user) {
      toast.info("Sign in to save this vehicle to your account.");

      return;
    }

    setSavingBusy(true);

    if (saved) {
      const { error } = await supabase.from("saved_vehicles").delete().eq("user_id", user.id).eq("vehicle_id", v.id);

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

    const { error } = await supabase.from("saved_vehicles").insert({
      user_id: user.id,
      vehicle_id: v.id,
    });

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

  /*
   * Vehicle + Product structured data.
   *
   * Important:
   * - Uses actual vehicle inventory data.
   * - Uses absolute vehicle image URLs.
   * - Excludes videos from Product.image.
   * - Includes USD fallback for priceCurrency.
   * - Does not fabricate shipping or return policies.
   */
  const jsonLd = {
    "@context": "https://schema.org",

    "@type": ["Product", "Vehicle"],

    "@id": `${canonicalUrl}#vehicle`,

    url: canonicalUrl,

    name: vehicleTitle(v),

    description: schemaDescription,

    /*
     * Google Merchant/Product structured data needs actual
     * product images. These URLs are now always absolute.
     */
    ...(schemaImages.length > 0
      ? {
          image: schemaImages,
        }
      : {}),

    sku: v.stock_number,

    vehicleIdentificationNumber: v.vin,

    brand: {
      "@type": "Brand",
      name: v.make,
    },
    model: v.model,

    vehicleModelDate: String(v.year),

    bodyType: v.body_style,

    mileageFromOdometer: {
      "@type": "QuantitativeValue",
      value: Number(v.mileage),
      unitCode: "SMI",
    },

    ...(v.exterior_color
      ? {
          color: v.exterior_color,
        }
      : {}),

    ...(v.fuel_type
      ? {
          fuelType: v.fuel_type,
        }
      : {}),

    ...(v.transmission
      ? {
          vehicleTransmission: v.transmission,
        }
      : {}),

    offers: {
      "@type": "Offer",

      url: canonicalUrl,

      price: Number.isFinite(numericPrice) ? numericPrice.toFixed(2) : undefined,

      priceCurrency,

      availability: v.status === "available" ? "https://schema.org/InStock" : "https://schema.org/LimitedAvailability",

      itemCondition: "https://schema.org/UsedCondition",

      seller: {
        "@type": "AutoDealer",

        name: "MyCar",

        url: SITE_URL,

        areaServed: {
          "@type": "City",
          name: "Fredericksburg",
          addressRegion: "VA",
        },
      },
    },
  };

  const navSections = [
    { id: "overview", label: "Overview" },
    { id: "features", label: "Features" },
    { id: "details", label: "Vehicle Details" },
    { id: "pricing", label: "Pricing" },
    { id: "reviews", label: "Reviews" },
    { id: "inspection", label: "Inspection" },
    { id: "more", label: "More Cars" },
  ];
  const photoIndexes = photos.map((_, index) => index);
  const displayedIndexes = photoIndexes.filter((index) => {
    if (galleryFilter === "all") return true;
    const alt = (photos[index]?.alt ?? "").toLowerCase();
    // Never infer interior/exterior from an arbitrary photo position.
    return galleryFilter === "interior"
      ? /interior|dashboard|seat|cabin|console|steering/.test(alt)
      : /exterior|front|rear|side|outside|wheel/.test(alt);
  });
  const currentMedia = photos[active];
  const actualApr = aprOverride ?? Number(settings?.finance_apr ?? 9.99);
  const vehiclePrice = Number(v.price_cents) / 100;
  const principal = Math.max(0, vehiclePrice - downPayment);
  const monthlyRate = actualApr / 1200;
  const calculatedPayment =
    financeMonths > 0
      ? monthlyRate > 0
        ? (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -financeMonths))
        : principal / financeMonths
      : 0;
  const jumpTo = (id: string) => {
    setSelectedSection(id);
    document.getElementById(`vehicle-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const movePhoto = (amount: number) =>
    setActive((index) => (index + amount + photos.length) % Math.max(photos.length, 1));
  const pricingDisclosure =
    settings?.finance_disclosure ||
    "Illustrative estimate only; actual financing terms are subject to lender approval. Taxes and fees are not included.";
  const safeHistoryUrl =
    v.history_report_url && /^https?:\/\//i.test(v.history_report_url) ? v.history_report_url : null;

  return (
    <div className="min-h-screen bg-white text-[#142d46]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5 text-xs">
          <nav aria-label="Breadcrumb" className="min-w-0 text-slate-500">
            <Link to="/search" className="hover:text-[#0969c5]">
              Shop Inventory
            </Link>
            <span className="px-2">/</span>
            <span className="font-medium text-[#193a58]">{vehicleTitle(v)}</span>
          </nav>
          <div className="flex gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 rounded-full text-xs"
              disabled={!previousVehicleSlug}
            >
              {previousVehicleSlug ? (
                <Link to="/inventory/$slug" params={{ slug: previousVehicleSlug }}>
                  <ArrowLeft className="mr-1 size-3.5" /> Previous
                </Link>
              ) : (
                <span>
                  <ArrowLeft className="mr-1 inline size-3.5" /> Previous
                </span>
              )}
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 rounded-full text-xs"
              disabled={!nextVehicleSlug}
            >
              {nextVehicleSlug ? (
                <Link to="/inventory/$slug" params={{ slug: nextVehicleSlug }}>
                  Next <ArrowRight className="ml-1 size-3.5" />
                </Link>
              ) : (
                <span>
                  Next <ArrowRight className="ml-1 inline size-3.5" />
                </span>
              )}
            </Button>
          </div>
        </div>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 lg:hidden">
          <div>
            <h1 className="font-display text-2xl font-extrabold">{vehicleTitle(v)}</h1>
            <p className="mt-1 text-xs text-slate-500">
              {formatMiles(v.mileage)} · Stock #{v.stock_number}
            </p>
          </div>
          <div className="text-2xl font-extrabold">{formatUsd(Number(v.price_cents))}</div>
        </div>
      </div>

      <div
        ref={sectionNavRef}
        className="sticky top-0 z-30 border-y border-slate-200 bg-white/95 shadow-sm backdrop-blur-md"
      >
        <nav
          aria-label="Vehicle detail sections"
          className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4 sm:px-6 lg:px-10 [scrollbar-width:none]"
        >
          {navSections.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => jumpTo(id)}
              className={`shrink-0 border-b-[3px] py-4 text-xs font-semibold transition-colors sm:text-sm ${selectedSection === id ? "border-[#1375ca] text-[#0969c5]" : "border-transparent text-slate-600 hover:text-[#0969c5]"}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mx-auto grid max-w-7xl gap-7 px-4 py-7 sm:px-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.8fr)] lg:px-10">
        <main className="min-w-0">
          <section id="vehicle-overview" data-vehicle-section="true" className="scroll-mt-28">
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[#f2f5f8]">
              <button
                type="button"
                onClick={() => setGalleryOpen(true)}
                aria-label="Open fullscreen vehicle photos"
                className="group relative flex h-[260px] w-full items-center justify-center sm:h-[430px] lg:h-[470px]"
              >
                {currentMedia && !failedPhotoIds.includes(currentMedia.id) ? (
                  isVideoUrl(currentMedia.url) ? (
                    <video
                      key={currentMedia.url}
                      src={currentMedia.url}
                      controls
                      playsInline
                      preload="metadata"
                      onError={() => markFailed(currentMedia.id)}
                      className="h-full w-full bg-black object-contain"
                    />
                  ) : (
                    <img
                      key={currentMedia.url}
                      src={currentMedia.url}
                      alt={currentMedia.alt ?? `${vehicleTitle(v)} photo ${active + 1}`}
                      onError={() => markFailed(currentMedia.id)}
                      className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.015]"
                    />
                  )
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-400">
                    <Camera className="size-12" />
                    <span className="text-sm">Photos for this vehicle are being uploaded</span>
                  </div>
                )}
                {photos.length > 0 && (
                  <span className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-xs font-semibold shadow">
                    <Maximize2 className="size-4" /> View gallery · {active + 1}/{photos.length}
                  </span>
                )}
              </button>
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous vehicle photo"
                    onClick={() => movePhoto(-1)}
                    className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-md transition hover:scale-105"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next vehicle photo"
                    onClick={() => movePhoto(1)}
                    className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-md transition hover:scale-105"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </>
              )}
            </div>
            {photos.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
                {photos.map((photo, index) => (
                  <button
                    type="button"
                    key={photo.id}
                    onClick={() => setActive(index)}
                    aria-label={`View vehicle photo ${index + 1}`}
                    aria-pressed={index === active}
                    className={`relative h-[74px] w-[104px] shrink-0 overflow-hidden rounded-lg border-2 transition sm:h-[83px] sm:w-[120px] ${active === index ? "border-[#1375ca] shadow-md" : "border-transparent opacity-80 hover:opacity-100"}`}
                  >
                    {isVideoUrl(photo.url) ? (
                      <span className="flex size-full items-center justify-center bg-slate-800 text-white">
                        <Play className="size-6" />
                      </span>
                    ) : (
                      <img
                        src={photo.url}
                        alt={photo.alt ?? `Photo ${index + 1}`}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-7 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-4">
              <div>
                <Gauge className="mb-2 size-5 text-[#147ace]" />
                <p className="text-xs text-slate-500">Mileage</p>
                <p className="mt-1 text-sm font-bold">{formatMiles(v.mileage)}</p>
              </div>
              <div>
                <Camera className="mb-2 size-5 text-[#147ace]" />
                <p className="text-xs text-slate-500">Photos & videos</p>
                <p className="mt-1 text-sm font-bold">{photos.length} media items</p>
              </div>
              <div>
                <Fuel className="mb-2 size-5 text-[#147ace]" />
                <p className="text-xs text-slate-500">Fuel type</p>
                <p className="mt-1 text-sm font-bold">{v.fuel_type || "Not listed"}</p>
              </div>
              <div>
                <CheckCircle2 className="mb-2 size-5 text-[#147ace]" />
                <p className="text-xs text-slate-500">Status</p>
                <p className="mt-1 text-sm font-bold">
                  {v.status === "available" ? "Available" : "Contact for status"}
                </p>
              </div>
            </div>
            <div className="mt-8">
              <h2 className="text-2xl font-extrabold">
                Meet your {v.year} {v.make} {v.model}
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{schemaDescription}</p>
            </div>
          </section>

          <section
            id="vehicle-features"
            data-vehicle-section="true"
            className="scroll-mt-28 border-b border-slate-200 py-12"
          >
            <h2 className="text-2xl font-extrabold">Features & equipment</h2>
            <p className="mt-2 text-sm text-slate-500">Equipment listed in this vehicle's inventory record.</p>
            {v.features?.length ? (
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {v.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 rounded-lg bg-slate-50 p-5 text-sm text-slate-600">
                A detailed equipment list is not currently available for this unit. Contact our team for specific
                features.
              </p>
            )}
          </section>

          <section
            id="vehicle-details"
            data-vehicle-section="true"
            className="scroll-mt-28 border-b border-slate-200 py-12"
          >
            <h2 className="text-2xl font-extrabold">Vehicle details</h2>
            <dl className="mt-6 grid gap-x-8 sm:grid-cols-2">
              {specs.map(([name, value]) => (
                <div key={name} className="flex min-w-0 justify-between gap-4 border-b border-slate-200 py-3 text-sm">
                  <dt className="text-slate-500">{name}</dt>
                  <dd className="break-all text-right font-semibold">{value || "—"}</dd>
                </div>
              ))}
            </dl>
            {v.description && (
              <div className="mt-8">
                <h3 className="font-bold">About this car</h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{v.description}</p>
              </div>
            )}
          </section>

          <section
            id="vehicle-pricing"
            data-vehicle-section="true"
            className="scroll-mt-28 border-b border-slate-200 py-12"
          >
            <h2 className="text-2xl font-extrabold">Pricing & payment estimate</h2>
            <p className="mt-2 text-sm text-slate-500">
              Explore an illustrative monthly payment using the published vehicle price.
            </p>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-[#f6f8fc] p-5 sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">Vehicle price</p>
                  <p className="text-3xl font-extrabold">{formatUsd(Number(v.price_cents))}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Estimated payment</p>
                  <p className="text-3xl font-extrabold text-[#0969c5]">
                    ${Math.round(calculatedPayment).toLocaleString("en-US")}
                    <span className="text-base font-medium">/mo</span>
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <label className="space-y-1.5 text-xs font-semibold">
                  Down payment ($)
                  <Input
                    type="number"
                    min={0}
                    max={vehiclePrice}
                    value={downPayment}
                    onChange={(event) =>
                      setDownPayment(Math.min(vehiclePrice, Math.max(0, Number(event.target.value) || 0)))
                    }
                    className="bg-white"
                  />
                </label>
                <label className="space-y-1.5 text-xs font-semibold">
                  Loan term
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                    value={financeMonths}
                    onChange={(event) => setFinanceMonths(Number(event.target.value))}
                  >
                    {[36, 48, 60, 72, 75, 84].map((months) => (
                      <option key={months} value={months}>
                        {months} months
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-xs font-semibold">
                  APR (%)
                  <Input
                    type="number"
                    min={0}
                    max={40}
                    step="0.01"
                    value={actualApr}
                    onChange={(event) => setAprOverride(Math.min(40, Math.max(0, Number(event.target.value) || 0)))}
                    className="bg-white"
                  />
                </label>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">{pricingDisclosure}</p>
              <Button asChild className="mt-5 rounded-full bg-[#0969c5] hover:bg-[#0758a6]">
                <Link to="/finance">
                  Explore financing <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </section>

          <section
            id="vehicle-reviews"
            data-vehicle-section="true"
            className="scroll-mt-28 border-b border-slate-200 py-12"
          >
            <h2 className="text-2xl font-extrabold">Reviews</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Want to learn about the experience at My Car? Ask our team for verified customer feedback about purchasing
              and financing. Reviews of this specific unit are not currently published.
            </p>
            <Button asChild variant="outline" className="mt-5 rounded-full">
              <Link to="/contact">Contact My Car</Link>
            </Button>
          </section>

          <section
            id="vehicle-inspection"
            data-vehicle-section="true"
            className="scroll-mt-28 border-b border-slate-200 py-12"
          >
            <h2 className="text-2xl font-extrabold">Inspection & vehicle history</h2>
            <div className="mt-6 rounded-xl border border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-7 text-[#1174c5]" />
                <div>
                  <h3 className="font-bold">Get the vehicle details you need</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Ask our team about condition, service records and inspection information. A passing inspection or
                    accident-free history is not claimed unless documented for this vehicle.
                  </p>
                </div>
              </div>
              {safeHistoryUrl ? (
                <a
                  href={safeHistoryUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#0969c5] hover:underline"
                >
                  View vehicle history report <ExternalLink className="size-4" />
                </a>
              ) : (
                <p className="mt-4 text-xs text-slate-500">
                  No public vehicle history report link is currently listed for this unit.
                </p>
              )}
            </div>
          </section>

          <section id="vehicle-more" data-vehicle-section="true" className="scroll-mt-28 py-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-extrabold">More cars you might like</h2>
              <Link to="/search" className="text-sm font-bold text-[#0969c5] hover:underline">
                See all inventory <ArrowRight className="inline size-4" />
              </Link>
            </div>
            {similar?.length ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {similar.slice(0, 4).map((item) => (
                  <VehicleCard key={item.id} vehicle={item} settings={settings} />
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-slate-500">Explore My Car's current inventory to find other vehicles.</p>
            )}
          </section>
        </main>

        <aside className="min-w-0 space-y-5 self-start lg:sticky lg:top-[92px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_16px_55px_rgba(15,43,75,0.08)] sm:p-6">
            <div className="hidden lg:block">
              <h1 className="font-display text-xl font-extrabold leading-tight">{vehicleTitle(v)}</h1>
              <p className="mt-1 text-xs text-slate-500">
                {formatMiles(v.mileage)} · Stock #{v.stock_number}
              </p>
            </div>
            {v.status !== "available" && (
              <Badge variant="secondary" className="mt-3">
                Availability to be confirmed
              </Badge>
            )}
            <div className="hidden lg:block">
              <p className="mt-5 text-3xl font-extrabold">{formatUsd(Number(v.price_cents))}</p>
            </div>
            {payment != null && settings && (
              <div className="mt-4 rounded-lg bg-[#f0f6fd] p-3">
                <p className="text-sm font-bold text-[#0969c5]">Est. ${payment}/mo</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-600">
                  {settings.finance_term_months} months at {Number(settings.finance_apr)}% APR with{" "}
                  {Number(settings.finance_down_percent)}% down. {settings.finance_disclosure}
                </p>
              </div>
            )}
            <div className="mt-5 grid gap-2.5">
              <Button asChild size="lg" className="h-12 rounded-full bg-[#0969c5] font-bold hover:bg-[#0758a6]">
                <a href="#availability">
                  Check availability <ArrowRight className="ml-2 size-4" />
                </a>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-full">
                <Link to="/finance">Get pre-qualified</Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-full">
                <Link to="/schedule" search={{ type: "test_drive", vehicle: v.id }}>
                  Schedule a test drive
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-full">
                <Link to="/sell">Value my trade</Link>
              </Button>
              <Button variant="ghost" onClick={toggleSave} disabled={savingBusy} className="h-10">
                <Heart className={`mr-2 size-4 ${saved ? "fill-rose-500 text-rose-500" : ""}`} />
                {saved ? "Saved — remove" : "Save this vehicle"}
              </Button>
              {settings?.phone && (
                <a
                  href={`tel:${settings.phone.replace(/\D/g, "")}`}
                  className="flex items-center justify-center gap-2 py-2 text-sm font-bold text-[#10385d]"
                >
                  <Phone className="size-4 text-[#f28c22]" /> {settings.phone}
                </a>
              )}
            </div>
          </div>
          <div id="availability" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-extrabold">Check availability</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              We'll confirm this vehicle is still on the lot and answer your questions.
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
                  price: v.price_cents != null ? (Number(v.price_cents) / 100).toFixed(2) : null,
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

      {photos.length > 0 && (
        <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
          <DialogContent className="flex h-[95dvh] w-[98vw] max-w-[1450px] flex-col gap-0 overflow-hidden border-0 bg-[#101923] p-0 text-white sm:rounded-2xl">
            <DialogHeader className="flex-none border-b border-white/10 p-4 pr-14 text-left">
              <DialogTitle className="text-base font-bold text-white">{vehicleTitle(v)}</DialogTitle>
              <DialogDescription className="text-xs text-slate-300">
                Actual inventory images · {active + 1} of {photos.length}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 overflow-x-auto border-b border-white/10 px-5 py-3">
              {(["all", "exterior", "interior"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setGalleryFilter(filter)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold capitalize transition ${galleryFilter === filter ? "bg-white text-slate-900" : "border border-white/20 text-white hover:bg-white/10"}`}
                >
                  {filter === "all" ? `All (${photos.length})` : filter}
                </button>
              ))}
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center p-2 sm:p-6">
              {currentMedia &&
                (isVideoUrl(currentMedia.url) ? (
                  <video
                    key={currentMedia.url}
                    src={currentMedia.url}
                    controls
                    playsInline
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <img
                    key={currentMedia.url}
                    src={currentMedia.url}
                    alt={currentMedia.alt ?? vehicleTitle(v)}
                    className="max-h-full max-w-full object-contain"
                  />
                ))}
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous gallery photo"
                    onClick={() => movePhoto(-1)}
                    className="absolute left-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900"
                  >
                    <ChevronLeft />
                  </button>
                  <button
                    type="button"
                    aria-label="Next gallery photo"
                    onClick={() => movePhoto(1)}
                    className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900"
                  >
                    <ChevronRight />
                  </button>
                </>
              )}
            </div>
            <div className="flex max-h-24 flex-none gap-2 overflow-x-auto border-t border-white/10 p-3">
              {(displayedIndexes.length ? displayedIndexes : photoIndexes).map((index) => (
                <button
                  key={photos[index].id}
                  onClick={() => setActive(index)}
                  className={`h-16 w-24 shrink-0 overflow-hidden rounded border-2 ${index === active ? "border-[#55abff]" : "border-white/10"}`}
                >
                  {isVideoUrl(photos[index].url) ? (
                    <span className="flex size-full items-center justify-center bg-slate-700">
                      <Play />
                    </span>
                  ) : (
                    <img src={photos[index].url} alt={`Photo ${index + 1}`} className="size-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-6px_25px_rgba(17,40,66,0.08)] backdrop-blur-sm lg:hidden">
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <span className="text-[10px] text-slate-500">Vehicle price</span>
          <span className="truncate text-lg font-extrabold">{formatUsd(Number(v.price_cents))}</span>
        </div>
        <Button asChild className="h-11 rounded-full bg-[#0969c5] px-5 font-bold hover:bg-[#0758a6]">
          <a href="#availability">Check availability</a>
        </Button>
      </div>
      <div className="h-20 lg:hidden" />
    </div>
  );
}
