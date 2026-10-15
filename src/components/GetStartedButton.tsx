import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { vehicleTitle } from "@/lib/format";
import type { VehicleWithPhotos } from "@/lib/queries";
import type { VehicleSnapshot } from "@/lib/purchases.functions";

export const PENDING_PURCHASE_KEY = "mycar.pendingPurchase";

export function readPendingPurchase(): VehicleSnapshot | null {
  try {
    const raw = sessionStorage.getItem(PENDING_PURCHASE_KEY);
    return raw ? (JSON.parse(raw) as VehicleSnapshot) : null;
  } catch {
    return null;
  }
}

export function clearPendingPurchase() {
  try {
    sessionStorage.removeItem(PENDING_PURCHASE_KEY);
  } catch {
    /* storage blocked */
  }
}

export function GetStartedButton({
  vehicle,
  className,
  size = "sm",
}: {
  vehicle: VehicleWithPhotos;
  className?: string;
  size?: "sm" | "lg" | "default";
}) {
  const navigate = useNavigate();
  function start(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const photos = [...(vehicle.vehicle_photos ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const snapshot: VehicleSnapshot = {
      id: String(vehicle.id),
      slug: vehicle.slug,
      vin: vehicle.vin,
      title: vehicleTitle(vehicle),
      price_cents: Number(vehicle.price_cents) || null,
      mileage: Number(vehicle.mileage) || null,
      photo: photos.find((p) => !/\.(mp4|mov|webm|m4v)(\?|$)/i.test(p.url))?.url ?? null,
    };
    try {
      sessionStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify(snapshot));
    } catch {
      /* storage blocked */
    }
    void navigate({ to: "/my" });
  }
  return (
    <Button type="button" size={size} onClick={start} className={cn("w-full font-semibold", className)}>
      Get Started <ArrowRight className="ml-1.5 size-4" />
    </Button>
  );
}
