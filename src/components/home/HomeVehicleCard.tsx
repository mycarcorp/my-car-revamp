import { useMemo, useState, type MouseEvent } from "react";
import { Link } from "@tanstack/react-router";
import { CarFront, ChevronLeft, ChevronRight } from "lucide-react";
import { vehicleMedia } from "@/components/VehicleCard";
import { formatMiles, formatUsd, vehicleTitle } from "@/lib/format";
import type { VehicleWithPhotos } from "@/lib/queries";

function hasFreeShipping(v: VehicleWithPhotos) {
  const raw = v as unknown as Record<string, unknown>;
  const value = raw.free_shipping ?? raw.freeShipping ?? raw.is_free_shipping;
  return value === true || value === 1 || value === "true";
}

/**
 * Homepage vehicle card: whole card opens the detail page; arrows slide photos in place.
 */
export function HomeVehicleCard({ vehicle }: { vehicle: VehicleWithPhotos }) {
  const photos = useMemo(() => vehicleMedia(vehicle).filter((m) => !m.video).slice(0, 8), [vehicle]);
  const [index, setIndex] = useState(0);
  const title = vehicleTitle(vehicle);

  const step = (e: MouseEvent, dir: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIndex((i) => (i + dir + photos.length) % photos.length);
  };

  return (
    <Link
      to="/inventory/$slug"
      params={{ slug: vehicle.slug }}
      className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {photos.length ? (
          <div
            className="flex h-full transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{ transform: `translate3d(-${index * 100}%,0,0)` }}
          >
            {photos.map((p, i) => (
              <img
                key={p.url}
                src={p.url}
                alt={i === 0 ? title : `${title} photo ${i + 1}`}
                loading="lazy"
                className="h-full w-full shrink-0 object-cover"
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <CarFront className="size-8" />
            <span className="text-xs font-medium">Photos coming soon</span>
          </div>
        )}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={(e) => step(e, -1)}
              className="absolute left-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-foreground opacity-0 shadow transition group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={(e) => step(e, 1)}
              className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-foreground opacity-0 shadow transition group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
            >
              <ChevronRight className="size-4" />
            </button>
            <div className="absolute inset-x-3 bottom-2 flex gap-1" aria-hidden>
              {photos.map((p, i) => (
                <span
                  key={p.url}
                  className={`h-1 flex-1 rounded-full transition-colors ${i === index ? "bg-card" : "bg-card/40"}`}
                />
              ))}
            </div>
          </>
        )}
        {hasFreeShipping(vehicle) && (
          <span className="absolute left-3 top-3 rounded-full bg-success px-2.5 py-1 text-[11px] font-bold text-success-foreground">
            Free shipping
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="line-clamp-1 font-display text-base font-bold">
          {vehicle.year} {vehicle.make} {vehicle.model}
        </h3>
        <p className="line-clamp-1 text-sm text-muted-foreground">
          {[vehicle.trim, formatMiles(vehicle.mileage)].filter(Boolean).join(" • ")}
        </p>
        <p className="mt-3 font-display text-xl font-black">{formatUsd(vehicle.price_cents)}</p>
      </div>
    </Link>
  );
}
