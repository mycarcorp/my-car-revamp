import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Camera, Play, TrendingDown } from "lucide-react";
import { isVideoUrl } from "@/lib/vehicle-media";

import { Badge } from "@/components/ui/badge";
import { formatMiles, formatUsd, monthlyPayment, vehicleTitle } from "@/lib/format";
import type { VehicleWithPhotos, SiteSettings } from "@/lib/queries";

export function VehicleCard({
  vehicle,
  settings,
}: {
  vehicle: VehicleWithPhotos;
  settings?: SiteSettings | null | undefined;
}) {
  const photos = [...(vehicle.vehicle_photos ?? [])].sort((a, b) => a.position - b.position);
  const cover = photos.find((p) => !isVideoUrl(p.url)) ?? photos[0];
  const hasVideo = photos.some((p) => isVideoUrl(p.url));
  const [coverFailed, setCoverFailed] = useState(false);

  const payment = settings
    ? monthlyPayment(Number(vehicle.price_cents), {
        apr: Number(settings.finance_apr),
        termMonths: settings.finance_term_months,
        downPercent: Number(settings.finance_down_percent),
      })
    : null;
  const priceDrop =
    vehicle.prior_price_cents != null &&
    Number(vehicle.prior_price_cents) > Number(vehicle.price_cents);

  return (
    <Link
      to="/inventory/$slug"
      params={{ slug: vehicle.slug }}
      className="card-lift group block overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {cover && !coverFailed ? (
          isVideoUrl(cover.url) ? (
            <video
              src={cover.url}
              muted
              playsInline
              preload="metadata"
              onError={() => setCoverFailed(true)}
              className="size-full bg-black object-cover"
            />
          ) : (
            <img
              src={cover.url}
              alt={cover.alt ?? vehicleTitle(vehicle)}
              loading="lazy"
              onError={() => setCoverFailed(true)}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Camera className="size-6" />
            <span className="text-xs">Photos coming soon</span>
          </div>
        )}
        {hasVideo && (
          <Badge variant="secondary" className="absolute bottom-3 left-3 gap-1">
            <Play className="size-3" /> Video
          </Badge>
        )}

        {priceDrop && (
          <Badge className="absolute left-3 top-3 gap-1 bg-success text-success-foreground">
            <TrendingDown className="size-3" /> Price drop
          </Badge>
        )}
        {vehicle.status === "pending" && (
          <Badge variant="secondary" className="absolute right-3 top-3">
            Sale pending
          </Badge>
        )}
      </div>

      <div className="space-y-2 p-4">
        <h3 className="line-clamp-1 font-display text-base font-semibold">
          {vehicleTitle(vehicle)}
        </h3>
        <p className="text-sm text-muted-foreground">
          {formatMiles(vehicle.mileage)} · {vehicle.body_style}
          {vehicle.drivetrain ? ` · ${vehicle.drivetrain}` : ""}
        </p>
        <div className="flex items-end justify-between pt-1">
          <div>
            <p className="font-display text-xl font-bold">{formatUsd(Number(vehicle.price_cents))}</p>
            {priceDrop && (
              <p className="text-xs text-muted-foreground line-through">
                {formatUsd(Number(vehicle.prior_price_cents))}
              </p>
            )}
          </div>
          {payment != null && (
            <p className="text-right text-sm font-medium text-primary">
              ${payment}/mo<span className="block text-[11px] font-normal text-muted-foreground">est.</span>
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
