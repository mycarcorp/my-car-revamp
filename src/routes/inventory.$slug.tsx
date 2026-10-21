import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { descriptionToPlainText, descriptionToSafeHtml, extractDescriptionFaqs } from "@/lib/vehicle-description";
import { trackEvent } from "@/lib/visitor-personalization";
import { publicCatalogItemId, trackAnalyticsEvent } from "@/lib/analytics";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CarFront,
  Check,
  Play,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  Gauge,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { isVideoUrl, parseVideoAlt, videoPublicLabel } from "@/lib/vehicle-media";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DeferredContent } from "@/components/DeferredContent";
import { GetStartedButton } from "@/components/GetStartedButton";
import { formatMiles, formatUsd, monthlyPayment, vehicleTitle } from "@/lib/format";
import {
  allVehiclesQuery,
  siteSettingsQuery,
  vehicleBySlugQuery,
  type VehicleWithPhotos,
} from "@/lib/queries";

const SITE_URL = "https://mycarcorp.com";
const RelatedVehicleCard = lazy(() => import("@/components/VehicleCard").then((module) => ({ default: module.VehicleCard })));

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
    return descriptionToPlainText(customDescription);
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
        ...(image ? [{ rel: "preload", as: "image", href: v.vehicle_photos.find((photo) => !isVideoUrl(photo.url))?.url ?? image, fetchPriority: "high" as const }] : []),
        {
          rel: "canonical",
          href: canonicalUrl,
        },
      ],
    };
  },

  component: VehicleDetail,
  errorComponent: () => <div role="alert" className="mx-auto max-w-5xl px-4 py-16">Unable to load this vehicle. <Link to="/search">Browse inventory</Link></div>,
  notFoundComponent: () => <div className="mx-auto max-w-5xl px-4 py-16">Vehicle unavailable. <Link to="/search">Browse inventory</Link></div>,
});

function VehicleDetail() {
  const { vehicle, slug } = Route.useLoaderData();

  const v = vehicle as VehicleWithPhotos;

  const { data: settings } = useQuery(siteSettingsQuery());

  const { data: allVehicles } = useQuery(allVehiclesQuery());

  const similar = useMemo(() => allVehicles?.filter((item) => item.id !== v.id && item.body_style === v.body_style).slice(0, 4), [allVehicles, v.id, v.body_style]);

  const photos = useMemo(() => [...(v.vehicle_photos ?? [])].sort((a, b) => a.position - b.position).map((photo) => ({ ...photo, id: photo.id || photo.url })), [v.vehicle_photos]);

  /*
   * These are absolute, crawlable image URLs used by
   * Product/Vehicle structured data.
   */
  const schemaImages = useMemo(() => getVehicleImages(v), [v.vehicle_photos]);

  const canonicalUrl = getVehicleUrl(slug);

  const schemaDescription = useMemo(() => getVehicleDescription(v), [v]);
  const descriptionHtml = useMemo(() => descriptionToSafeHtml(v.description), [v.description]);
  const descriptionFaqs = useMemo(() => extractDescriptionFaqs(descriptionHtml), [descriptionHtml]);

  const priceCurrency = getPriceCurrency(v);

  const numericPrice = Number(v.price_cents) / 100;

  useEffect(() => {
    trackEvent("vehicle_view", {
      vehicle: {
        id: String(v.id),
        slug: v.slug,
        make: v.make,
        model: v.model,
        body: v.body_style,
        priceCents: v.price_cents,
        year: v.year,
      },
    });
    const itemName = vehicleTitle(v);
    const price = Number(v.price_cents) / 100;
    trackAnalyticsEvent({
      name: "view_item",
      params: {
        item_id: publicCatalogItemId(v.year, v.make, v.model),
        item_name: itemName,
        ...(v.body_style ? { item_category: v.body_style } : {}),
        ...(Number.isFinite(price) && price >= 0 ? { price, currency: "USD" as const } : {}),
      },
    });
  }, [v.id, v.slug, v.year, v.make, v.model, v.trim, v.body_style, v.price_cents]);

  const [selectedSection, setSelectedSection] = useState("overview");
  const [walkaroundId, setWalkaroundId] = useState<string | null>(null);
  const sectionKey = (photos ?? []).some((p) => isVideoUrl(p.url)) ? "w" : "n";
  useEffect(() => {
    const ids = ["walkaround", "overview", "features", "details", "pricing", "reviews", "inspection", "more"];
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => Boolean(e));
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setSelectedSection(visible[0].target.id);
      },
      { rootMargin: "-150px 0px -55% 0px" },
    );
    els.forEach((e) => obs.observe(e));
    const hash = window.location.hash.slice(1);
    if (hash && ids.includes(hash)) {
      requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }));
    }
    return () => obs.disconnect();
  }, [sectionKey]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryFilter, setGalleryFilter] = useState<"all" | "exterior" | "interior">("all");
  const [downPayment, setDownPayment] = useState(0);
  const [financeMonths, setFinanceMonths] = useState(72);
  const [aprOverride, setAprOverride] = useState<number | null>(null);
  const [active, setActive] = useState(0);

  const [failedPhotoIds, setFailedPhotoIds] = useState<string[]>([]);

  const markFailed = (id: string) => setFailedPhotoIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

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
    setSelectedSection("overview");
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

  const walkaroundVideos = photos
    .filter((p) => isVideoUrl(p.url) && !failedPhotoIds.includes(p.id))
    .map((p) => {
      const meta = parseVideoAlt(p.alt);
      const label = videoPublicLabel(meta.type);
      // Auto-generated alt text ("… — video") is not a real title.
      const title = meta.title && !/—\s*video$/i.test(meta.title) ? meta.title : label;
      return { id: p.id, url: p.url, label, title };
    });
  const activeVideo = walkaroundVideos.find((w) => w.id === walkaroundId) ?? walkaroundVideos[0];
  const navSections = [
    ...(walkaroundVideos.length ? [{ id: "walkaround", label: "Walkaround" }] : []),
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

  const chooseTab = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    setSelectedSection(id);
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
      {descriptionFaqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: descriptionFaqs.map((f) => ({
                "@type": "Question",
                name: f.question,
                acceptedAnswer: { "@type": "Answer", text: f.answer },
              })),
            }).replace(/</g, "\\u003c"),
          }}
        />
      )}
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
              className="h-11 rounded-full text-xs"
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
              className="h-11 rounded-full text-xs"
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

        <div className="mx-auto grid max-w-7xl gap-7 px-4 py-7 sm:px-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.8fr)] lg:px-10">
        <main className="min-w-0">
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
                    loading="eager"
                    fetchPriority={active === 0 ? "high" : "auto"}
                    decoding="async"
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
                  className="absolute left-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-md transition hover:scale-105"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next vehicle photo"
                  onClick={() => movePhoto(1)}
                  className="absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-md transition hover:scale-105"
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            )}
          </div>
          {activeVideo && (
            <button
              type="button"
              onClick={() => chooseTab("walkaround")}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#0f2b4b] px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-[#173d66]"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-white text-[#0f2b4b]">
                <Play className="size-3.5 fill-current" />
              </span>
              360° Walkaround
              {walkaroundVideos.length > 1 && <span className="opacity-70">· {walkaroundVideos.length} videos</span>}
            </button>
          )}
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
                      decoding="async"
                      className="size-full object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
          {/* Sticky section navigation: every section stays on the page; links scroll to it. */}
          <nav
            aria-label="Vehicle sections"
            className="sticky top-16 z-30 -mx-4 mt-5 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:mx-0 sm:px-0"
          >
            <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
              {navSections.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  aria-current={selectedSection === id ? "true" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    chooseTab(id);
                  }}
                  className={`flex shrink-0 items-center gap-1.5 border-b-[3px] px-3 py-4 text-xs font-bold transition-colors sm:px-4 ${selectedSection === id ? "border-[#1478cc] text-[#0969c5]" : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-[#0969c5]"}`}
                >
                  {id === "walkaround" && <Play className="size-3.5" />}
                  {label}
                </a>
              ))}
            </div>
          </nav>
          <div id="vehicle-sections">
            {activeVideo && (
              <section id="walkaround" className="scroll-mt-[140px] pt-8">
                <h2 className="text-2xl font-extrabold">360° Walkaround</h2>
                <p className="mt-1 text-sm text-slate-500">Filmed video of this exact vehicle.</p>
                <div className="mt-5 overflow-hidden rounded-2xl bg-black">
                  <video
                    key={activeVideo.url}
                    src={activeVideo.url}
                    controls
                    playsInline
                    preload="none"
                    onError={() => markFailed(activeVideo.id)}
                    className="aspect-video w-full bg-black object-contain"
                  />
                </div>
                <p className="mt-3 text-sm font-bold">{activeVideo.title}</p>
                {walkaroundVideos.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {walkaroundVideos.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setWalkaroundId(w.id)}
                        aria-pressed={w.id === activeVideo.id}
                        className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold ${w.id === activeVideo.id ? "border-[#1478cc] bg-[#e8f4ff] text-[#0969c5]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                      >
                        <Play className="size-3.5" /> {w.title}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}
            {(
              <section id="overview" className="scroll-mt-[140px] pb-10 pt-7">
                <div className="overflow-hidden rounded-2xl bg-[#f4f6f9]">
                  <div className="px-5 pt-8 text-center sm:px-9">
                    <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#123a5b] sm:text-3xl">
                      Why You’ll Love This {v.model}
                    </h2>
                    <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
                      See what makes this {v.year} {v.make} {v.model} stand out, with real information from this exact
                      My Car listing.
                    </p>
                  </div>


                       <div className="mt-7 grid gap-3 px-4 sm:grid-cols-3 sm:px-7">
                    {[
                      {
                        title: "Made for your everyday",
                        text: `${v.body_style || "Vehicle"} • ${v.transmission || "Transmission details available on request"}`,
                      },
                      {
                        title: "Know your vehicle",
                        text: `${formatMiles(v.mileage)} • ${v.fuel_type || "Ask about fuel type"}`,
                      },
                      {
                        title: "Explore what matters",
                        text: v.features?.length
                          ? v.features.slice(0, 2).join(" • ")
                          : "Ask about the equipment and features on this vehicle",
                      },
                    ].map((card) => (
                      <div key={card.title} className="rounded-xl border border-slate-200 bg-white px-4 py-5 shadow-sm">
                        <div className="mb-3 flex size-8 items-center justify-center rounded-full bg-[#e8f4ff] text-[#1174cf]">
                          <Check className="size-4" />
                        </div>
                        <h3 className="text-sm font-extrabold text-[#173954]">{card.title}</h3>
                        <p className="mt-2 text-xs leading-5 text-slate-600">{card.text}</p>
                      </div>
                    ))}
                  </div>
                  <div className="relative mx-auto mt-5 flex max-w-[700px] items-center justify-center overflow-hidden px-4 pb-8 pt-3">
                    <div className="absolute bottom-7 left-[18%] right-[18%] h-8 rounded-full bg-slate-500/20 blur-2xl" />
                    {photos.find((photo) => !isVideoUrl(photo.url))?.url ? (
                      <img
                        src={photos.find((photo) => !isVideoUrl(photo.url))?.url}
                        alt={`Actual ${vehicleTitle(v)} inventory photograph`}
                        loading="lazy"
                        className="relative h-[235px] w-full rounded-xl object-contain drop-shadow-[0_16px_18px_rgba(20,45,70,0.22)] sm:h-[310px]"
                      />
                    ) : (
                      <div className="relative flex h-48 w-full items-center justify-center">
                        <CarFront className="size-16 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <p className="px-5 pb-5 text-center text-[11px] text-muted-foreground">
                    Actual vehicle listing photo, not a generic or AI-generated substitute.
                  </p>
                </div>
                <div className="mt-8 rounded-xl border border-slate-200 p-5 sm:p-6">
                  <h3 className="text-lg font-extrabold">
                    About this {v.make} {v.model}
                  </h3>
                  {descriptionHtml ? (
                    <div
                      className="vehicle-description mt-3 text-sm text-slate-600"
                      dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                    />
                  ) : (
                    <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{schemaDescription}</p>
                  )}
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[

                   ["Mileage", formatMiles(v.mileage)],
                      ["Body Style", v.body_style || "—"],
                      ["Engine", v.engine || "—"],
                      ["Fuel", v.fuel_type || "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className="mt-1 text-sm font-bold">{value}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => chooseTab("features")}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#0969c5] hover:underline"
                  >
                    Discover this car’s features <ArrowRight className="size-4" />
                  </button>
                </div>
              </section>
            )}
            {(
              <section id="features" className="scroll-mt-[140px] py-8">
                <div className="rounded-2xl bg-[#f5f7fa] px-5 py-8 sm:px-8">
                  <h2 className="mt-2 text-center text-2xl font-extrabold">Features & Highlights</h2>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl bg-white p-5">
                      <ShieldCheck className="size-6 text-[#1675c7]" />
                      <h3 className="mt-3 font-bold">Vehicle highlights</h3>
                      <p className="mt-2 text-sm text-slate-600">
                        {v.body_style || "Vehicle"} · {v.transmission || "Ask for transmission"} ·{" "}
                        {v.drivetrain || "Ask for drivetrain"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white p-5">
                      <Gauge className="size-6 text-[#1675c7]" />
                      <h3 className="mt-3 font-bold">Mileage & powertrain</h3>
                      <p className="mt-2 text-sm text-slate-600">
                        {formatMiles(v.mileage)} · {v.engine || "Engine specifications available on request"}
                      </p>
                    </div>
                  </div>
                  {photos.find((photo) => !isVideoUrl(photo.url))?.url && (
                    <div className="relative mx-auto mt-6 max-w-[650px] rounded-xl bg-white/60 p-4">
                      <img
                        src={photos.find((photo) => !isVideoUrl(photo.url))?.url}
                        alt={`${vehicleTitle(v)} from My Car inventory`}
                        loading="lazy"
                        className="mx-auto h-64 w-full object-contain drop-shadow-xl sm:h-80"
                      />
                    </div>
                  )}
                  <h3 className="mt-8 text-base font-extrabold">Key Features</h3>
                  {v.features?.length ? (
                    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                      {v.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 rounded-lg bg-white px-4 py-3 text-sm">
                          <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-600">
                      Detailed equipment information has not been published for this unit. Contact My Car to confirm
                      individual features.
                    </p>
                  )}
                </div>
              </section>
            )}
            {(
              <section id="details" className="scroll-mt-[140px] py-8">
                <h2 className="text-2xl font-extrabold">Vehicle Details</h2>
                <dl className="mt-5 grid gap-x-8 sm:grid-cols-2">
                  {specs.map(([name, value]) => (
                    <div
                      key={name}
                      className="flex min-w-0 justify-between gap-4 border-b border-slate-200 py-3 text-sm"
                    >
                      <dt className="text-slate-500">{name}</dt>
                      <dd className="break-all text-right font-semibold">{value || "—"}</dd>
                    </div>
                  ))}
                </dl>

                     {v.description && (
                  <div className="mt-7">
                    <h3 className="font-extrabold">About this vehicle</h3>
                    <div
                      className="vehicle-description mt-3 text-sm text-slate-600"
                      dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                    />
                  </div>
                )}
              </section>
            )}
            {(
              <section id="pricing" className="scroll-mt-[140px] py-8">
                <h2 className="text-center text-2xl font-extrabold">Price Details</h2>
                <p className="mt-2 text-center text-sm text-slate-500">
                  Explore estimated monthly payments for this vehicle.
                </p>
                <div className="mt-6 rounded-2xl bg-[#e9f5fd] p-5 sm:p-7">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Vehicle price</p>
                      <p className="text-3xl font-extrabold">{formatUsd(Number(v.price_cents))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Estimated monthly payment</p>
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

                     <p className="mt-4 text-xs leading-5 text-muted-foreground">{pricingDisclosure}</p>
                  <Button asChild className="mt-5 rounded-full bg-[#0969c5] hover:bg-[#0758a6]">
                    <Link to="/finance">
                      Explore financing <ArrowRight className="ml-2 size-4" />
                    </Link>
                  </Button>
                </div>
              </section>
            )}
            {(
              <section id="reviews" className="scroll-mt-[140px] py-8">
                <h2 className="text-2xl font-extrabold">Customer Reviews</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  We don't currently have a verified review specific to this vehicle. Contact My Car to learn about our
                  dealership and customer experience.
                </p>
                <Button asChild variant="outline" className="mt-5 rounded-full">
                  <Link to="/contact">Contact My Car</Link>
                </Button>
              </section>
            )}
            {(
              <section id="inspection" className="scroll-mt-[140px] py-8">
                <h2 className="text-2xl font-extrabold">Inspection & Vehicle History</h2>
                <div className="mt-5 rounded-xl border border-slate-200 p-6">
                  <ShieldCheck className="size-8 text-[#1174c5]" />
                  <h3 className="mt-3 font-extrabold">Know before you buy</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Our team can explain the condition and inspection information available for this individual vehicle.
                    No inspection result is implied without a published report.
                  </p>
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
                      A public vehicle history report is not currently linked for this unit.
                    </p>
                  )}
                </div>
              </section>
            )}
            {(
              <section id="more" className="scroll-mt-[140px] py-8">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-extrabold">More Cars You Might Like</h2>
                  <Link to="/search" className="text-sm font-bold text-[#0969c5]">
                    See all <ArrowRight className="inline size-4" />
                  </Link>
                </div>
                {similar?.length ? (
                  <DeferredContent fallback={<div className="mt-5 grid gap-4 sm:grid-cols-2" aria-hidden="true">{similar.map((item) => <div key={item.id} className="h-[420px] rounded-lg bg-muted" />)}</div>}>
                    <Suspense fallback={<div className="mt-5 min-h-[840px] bg-muted" aria-hidden="true" />}>
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        {similar.map((item) => <RelatedVehicleCard key={item.id} vehicle={item} settings={settings} />)}
                      </div>
                    </Suspense>
                  </DeferredContent>
                ) : (
                  <p className="mt-5 text-sm text-slate-500">Browse available vehicles in our inventory.</p>
                )}
              </section>
            )}
          </div>
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
            <div className="mt-5">
              <GetStartedButton vehicle={v} size="lg" className="h-12 w-full rounded-full" />
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
                    className="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900"
                  >
                    <ChevronLeft />
                  </button>
                  <button
                    type="button"
                    aria-label="Next gallery photo"
                    onClick={() => movePhoto(1)}
                    className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900"
                  >

                       <ChevronRight />
                  </button>
                </>
              )}
            </div>
            <div className="flex max-h-24 flex-none gap-2 overflow-x-auto border-t border-white/10 p-3">
              {(displayedIndexes.length ? displayedIndexes : photoIndexes).map((index) => (
                <button
                  key={photos[index]?.id}
                  aria-label={`View gallery photo ${index + 1}`}
                  aria-pressed={index === active}
                  onClick={() => setActive(index)}
                  className={`h-16 w-24 shrink-0 overflow-hidden rounded border-2 ${index === active ? "border-[#55abff]" : "border-white/10"}`}
                >
                  {isVideoUrl(photos[index]?.url) ? (
                    <span className="flex size-full items-center justify-center bg-slate-700">
                      <Play />
                    </span>
                  ) : (
                    <img src={photos[index]?.url} alt={`Photo ${index + 1}`} loading="lazy" decoding="async" className="size-full object-cover" />
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
        <GetStartedButton vehicle={v} size="lg" className="h-11 shrink-0 rounded-full px-5" />
      </div>
      <div className="h-20 lg:hidden" />
    </div>
  );
}
