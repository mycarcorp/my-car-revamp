import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Camera, ChevronLeft, ChevronRight, Heart, Images, Play, TrendingDown, X, CarFront } from "lucide-react";
import { isVideoUrl } from "@/lib/vehicle-media";
import { Badge } from "@/components/ui/badge";
import { formatMiles, formatUsd, monthlyPayment, vehicleTitle } from "@/lib/format";
import type { VehicleWithPhotos, SiteSettings } from "@/lib/queries";

type Media = { url: string; alt?: string; video: boolean };
type LooseObject = Record<string, unknown>;

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function mediaUrl(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const item = value as LooseObject;
  for (const key of [
    "url",
    "photo_url",
    "image_url",
    "public_url",
    "full_url",
    "original_url",
    "src",
    "secure_url",
    "uri",
    "file_url",
  ]) {
    const candidate = item[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
}

function normalizeUrl(url: string): string {
  if (!url || /^(data:|blob:|javascript:)/i.test(url)) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  // Relative images are resolved against the website origin. Absolute URLs from
  // your image provider (Supabase, DealerCenter, CDN, etc.) are used unchanged.
  if (url.startsWith("/")) return url;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(url)) return `https://${url}`;
  return `/${url.replace(/^\.\/?/, "")}`;
}

export function vehicleMedia(vehicle: VehicleWithPhotos): Media[] {
  const raw = vehicle as unknown as LooseObject;
  const collections = [raw.vehicle_photos, raw.photos, raw.images, raw.gallery, raw.vehicle_images];
  const items: unknown[] = [];
  for (const collection of collections) {
    if (Array.isArray(collection)) items.push(...collection);
  }
  // Some feeds supply a single cover image independently of the photo list.
  for (const key of [
    "primary_photo_url",
    "primary_image_url",
    "image_url",
    "photo_url",
    "thumbnail_url",
    "cover_image_url",
    "image",
    "featured_image",
  ]) {
    if (raw[key]) items.push(raw[key]);
  }
  const rank = (value: unknown): number => {
    if (!value || typeof value !== "object") return 9999;
    const obj = value as LooseObject;
    const number = Number(obj.position ?? obj.sort_order ?? obj.order_index ?? obj.order ?? 9999);
    return Number.isFinite(number) ? number : 9999;
  };
  items.sort((a, b) => rank(a) - rank(b));
  const seen = new Set<string>();
  const output: Media[] = [];
  for (const item of items) {
    const url = normalizeUrl(mediaUrl(item));
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const obj = item && typeof item === "object" ? (item as LooseObject) : {};
    output.push({
      url,
      alt: str(obj.alt) || str(obj.alt_text) || vehicleTitle(vehicle),
      video: isVideoUrl(url),
    });
  }
  // Keep pictures ahead of videos; the card should start on a still image.
  return [...output.filter((m) => !m.video), ...output.filter((m) => m.video)];
}

const storageKey = "mycar-saved-vehicles";
function readSaved(id: string): boolean {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "[]").includes(id);
  } catch {
    return false;
  }
}

function isRecentlyAdded(value: unknown): boolean {
  if (!value) return false;
  const date = new Date(String(value)).getTime();
  const age = Date.now() - date;
  return Number.isFinite(date) && age >= 0 && age <= 7 * 86400000;
}

export function VehicleCard({
  vehicle,
  settings,
}: {
  vehicle: VehicleWithPhotos;
  settings?: SiteSettings | null | undefined;
}) {
  const media = useMemo(() => vehicleMedia(vehicle), [vehicle]);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const id = String(vehicle.id);

  useEffect(() => {
    setSaved(readSaved(id));
  }, [id]);

  useEffect(() => {
    setIndex(0);
    setFailed([]);
  }, [vehicle.id, vehicle.vehicle_photos]);

  const validMedia = media.filter((m) => !failed.includes(m.url));
  const currentIndex = validMedia.length ? Math.min(index, validMedia.length - 1) : 0;
  const active = validMedia[currentIndex];
  const price = Number(vehicle.price_cents);
  const previous = Number(vehicle.prior_price_cents ?? 0);
  const priceDrop = price > 0 && previous > price;
  const savings = previous - price;
  const recentlyAdded = isRecentlyAdded(vehicle.date_received);
  const hasVideo = media.some((m) => m.video);

  const payment =
    settings && Number.isFinite(price) && price > 0
      ? monthlyPayment(price, {
          apr: Number(settings.finance_apr),
          termMonths: settings.finance_term_months,
          downPercent: Number(settings.finance_down_percent),
        })
      : null;

  function markFailed(url: string) {
    setFailed((old) => (old.includes(url) ? old : [...old, url]));
    setIndex(0);
  }

  function move(direction: number) {
    if (validMedia.length < 2) return;
    setIndex((old) => (Math.min(old, validMedia.length - 1) + direction + validMedia.length) % validMedia.length);
  }

  function toggleSave() {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const list: string[] = Array.isArray(raw) ? raw.map(String) : [];
      const next = list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSaved(next.includes(id));
      window.dispatchEvent(new Event("mycar-favorites-changed"));
    } catch {
      setSaved((value) => !value);
    }
  }

  useEffect(() => {
    if (!galleryOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGalleryOpen(false);
      if (event.key === "ArrowRight") move(1);
      if (event.key === "ArrowLeft") move(-1);
    };
    document.addEventListener("keydown", onKey);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = oldOverflow;
    };
  }, [galleryOpen, validMedia.length]);

  const mediaView = (large: boolean) =>
    active ? (
      active.video ? (
        <video
          key={active.url}
          src={active.url}
          controls={large}
          muted={!large}
          playsInline
          preload="metadata"
          onError={() => markFailed(active.url)}
          className={large ? "max-h-[75vh] max-w-full object-contain" : "h-full w-full object-contain"}
        />
      ) : (
        <img
          key={active.url}
          src={active.url}
          alt={active.alt || vehicleTitle(vehicle)}
          loading={large ? "eager" : "lazy"}
          decoding="async"
          onError={() => markFailed(active.url)}
          className={
            large
              ? "max-h-[75vh] max-w-full object-contain"
              : "h-full w-full object-contain transition-opacity duration-300"
          }
        />
      )
    ) : (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <Camera className="h-9 w-9 opacity-50" />
        <span className="text-xs">Photos coming soon</span>
      </div>
    );

  return (
    <>
      <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
        <div className="relative aspect-[1.55/1] overflow-hidden bg-[#f3f5f7]">
          <button
            type="button"
            onClick={() => active && setGalleryOpen(true)}
            className="flex h-full w-full items-center justify-center"
            aria-label={`Open photos of ${vehicleTitle(vehicle)}`}
          >
            {mediaView(false)}
          </button>

          <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1">
            {priceDrop ? (
              <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
                <TrendingDown className="h-3 w-3" /> Price Drop
              </Badge>
            ) : recentlyAdded ? (
              <Badge className="bg-blue-600 text-white hover:bg-blue-600">Recently Added</Badge>
            ) : null}
            {vehicle.status === "pending" && <Badge variant="secondary">Sale Pending</Badge>}
          </div>

          <button
            type="button"
            onClick={toggleSave}
            aria-label={saved ? "Remove from favorites" : "Save to favorites"}
            aria-pressed={saved}
            className="absolute right-2 top-2 rounded-full bg-white/95 p-2 text-slate-800 shadow-sm transition hover:scale-105"
          >
            <Heart className={`h-4 w-4 ${saved ? "fill-red-500 text-red-500" : ""}`} />
          </button>

          {validMedia.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => move(-1)}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/95 p-1.5 text-slate-800 shadow transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/95 p-1.5 text-slate-800 shadow transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/85 px-2 py-1">
                {validMedia.slice(0, 7).map((item, i) => (
                  <button
                    key={item.url}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`Show photo ${i + 1}`}
                    className={`h-1.5 w-1.5 rounded-full ${currentIndex === i ? "bg-blue-600" : "bg-slate-400"}`}
                  />
                ))}
              </div>
            </>
          )}
          {hasVideo && (
            <Badge variant="secondary" className="pointer-events-none absolute bottom-2 left-2 gap-1">
              <Play className="h-3 w-3" /> Video
            </Badge>
          )}
          {active && (
            <button
              type="button"
              onClick={() => setGalleryOpen(true)}
              aria-label="Open fullscreen photo gallery"
              className="absolute bottom-2 right-2 rounded-full bg-white/95 p-1.5 text-slate-800 shadow-sm"
            >
              <Images className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-1 flex-col p-3.5">
          <Link to="/inventory/$slug" params={{ slug: vehicle.slug }} className="hover:text-primary">
            <h3 className="line-clamp-2 font-display text-sm font-bold sm:text-base">{vehicleTitle(vehicle)}</h3>
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatMiles(vehicle.mileage)}
            {vehicle.body_style ? ` · ${vehicle.body_style}` : ""}
            {vehicle.drivetrain ? ` · ${vehicle.drivetrain}` : ""}
          </p>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="font-display text-xl font-extrabold">{formatUsd(price)}</p>
              {priceDrop && (
                <p className="text-xs text-muted-foreground">
                  <span className="line-through">{formatUsd(previous)}</span>
                  <span className="ml-1 font-semibold text-emerald-600">Save {formatUsd(savings)}</span>
                </p>
              )}
            </div>
            {payment != null && (
              <p className="text-right text-sm font-semibold text-primary">
                ${payment}/mo
                <span className="block text-[10px] font-normal text-muted-foreground">estimated*</span>
              </p>
            )}
          </div>

          <div className="mt-auto pt-4">
            <Link
              to="/inventory/$slug"
              params={{ slug: vehicle.slug }}
              className="block rounded-md border border-border px-3 py-2 text-center text-xs font-semibold transition hover:border-primary hover:bg-primary/5 hover:text-primary"
            >
              View Vehicle Details
            </Link>
          </div>
        </div>
      </article>

      {galleryOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${vehicleTitle(vehicle)} photo gallery`}
          className="fixed inset-0 z-[100] flex flex-col bg-black/95 text-white"
          onClick={() => setGalleryOpen(false)}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3" onClick={(e) => e.stopPropagation()}>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{vehicleTitle(vehicle)}</p>
              <p className="text-xs text-white/70">
                {validMedia.length ? `${currentIndex + 1} of ${validMedia.length}` : "No photos available"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGalleryOpen(false)}
              className="rounded-full p-2 hover:bg-white/15"
              aria-label="Close gallery"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {mediaView(true)}
            {validMedia.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => move(-1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 hover:bg-white/30"
                  aria-label="Previous photo"
                >
                  <ChevronLeft />
                </button>
                <button
                  type="button"
                  onClick={() => move(1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 hover:bg-white/30"
                  aria-label="Next photo"
                >
                  <ChevronRight />
                </button>
              </>
            )}
          </div>
          <div className="px-4 pb-5 pt-2 text-center text-xs text-white/70" onClick={(e) => e.stopPropagation()}>
            Use the arrows to browse photos. Press Esc to close.
            <Link
              to="/inventory/$slug"
              params={{ slug: vehicle.slug }}
              className="ml-3 font-semibold text-white underline"
              onClick={() => setGalleryOpen(false)}
            >
              View vehicle details
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
