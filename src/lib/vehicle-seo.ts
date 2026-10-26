// Vehicle listing SEO: titles, descriptions, structured data, photo alt text and search-result indexing rules.
//
// Pure functions over the vehicle fields already shown on the site. Nothing here is invented: a mileage or price
// that is missing (the legacy inventory mapper stores a missing mileage as 0) is left out instead of being
// published as "0 miles" or "$0".
import { descriptionToPlainText } from "./vehicle-description";
import { formatMiles, formatUsd, vehicleTitle } from "./format";
import { dealerReference, SITE_ORIGIN } from "./seo";
import { isVideoUrl } from "./vehicle-media";

export type VehicleSeoInput = {
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  vin: string;
  stock_number: string;
  mileage?: number | string | null;
  price_cents?: number | string | null;
  status?: string | null;
  body_style?: string | null;
  exterior_color?: string | null;
  fuel_type?: string | null;
  transmission?: string | null;
  description?: string | null;
  currency?: unknown;
  vehicle_photos?: Array<{ url: string; position: number; alt?: string | null }> | null;
};

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

/** The canonical public URL of a vehicle detail page. */
export function getVehicleUrl(slug: string): string {
  return `${SITE_ORIGIN}/inventory/${encodeURIComponent(slug)}`;
}

/** Relative image URLs become absolute so crawlers can fetch them. */
export function toAbsoluteUrl(url: string): string | null {
  const clean = url.trim();
  if (!clean) return null;
  if (clean.startsWith("https://") || clean.startsWith("http://")) return clean;
  if (clean.startsWith("//")) return `https:${clean}`;
  if (clean.startsWith("/")) return `${SITE_ORIGIN}${clean}`;
  return `${SITE_ORIGIN}/${clean}`;
}

/** Actual vehicle image URLs, in gallery order, without videos or duplicates. */
export function getVehicleImages(vehicle: Pick<VehicleSeoInput, "vehicle_photos">): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const photo of [...(vehicle.vehicle_photos ?? [])].sort((a, b) => a.position - b.position)) {
    if (typeof photo.url !== "string") continue;
    const absolute = toAbsoluteUrl(photo.url);
    if (!absolute || isVideoUrl(absolute) || seen.has(absolute)) continue;
    seen.add(absolute);
    out.push(absolute);
  }
  return out;
}

/** A real odometer reading: the legacy mapper stores a missing mileage as 0, which is treated as unknown. */
export function knownMileage(vehicle: Pick<VehicleSeoInput, "mileage">): number | null {
  const miles = Number(vehicle.mileage);
  return vehicle.mileage != null && Number.isFinite(miles) && miles > 0 ? miles : null;
}

/** A real price in cents; zero or missing means the price is unknown. */
export function knownPriceCents(vehicle: Pick<VehicleSeoInput, "price_cents">): number | null {
  const cents = Number(vehicle.price_cents);
  return vehicle.price_cents != null && Number.isFinite(cents) && cents > 0 ? cents : null;
}

export function getPriceCurrency(vehicle: Pick<VehicleSeoInput, "currency">): string {
  const currency = typeof vehicle.currency === "string" ? vehicle.currency.trim().toUpperCase() : "";
  return /^[A-Z]{3}$/.test(currency) ? currency : "USD";
}

/** Inventory description when one exists, otherwise a factual line built from vehicle data only. */
export function getVehicleDescription(vehicle: VehicleSeoInput): string {
  const custom = typeof vehicle.description === "string" ? vehicle.description.trim() : "";
  if (custom) return descriptionToPlainText(custom);
  const miles = knownMileage(vehicle);
  return [`Used ${vehicleTitle(vehicle)}`, miles ? `with ${formatMiles(miles)}` : null, "available at MyCar in Fredericksburg, VA."]
    .filter(Boolean)
    .join(" ");
}

/**
 * Search-result title for a vehicle page. Prefers "<year make model trim> for sale in Fredericksburg, VA — MyCar" and
 * drops the brand, then the location, when the title would be cut off in results.
 */
export function vehicleSeoTitle(vehicle: VehicleSeoInput): string {
  const name = vehicleTitle(vehicle);
  const candidates = [
    `${name} for sale in Fredericksburg, VA — MyCar`,
    `${name} for sale in Fredericksburg, VA`,
    `${name} for sale — MyCar`,
  ];
  return candidates.find((candidate) => candidate.length <= TITLE_MAX) ?? candidates[1]!;
}

/** Meta description from verified fields only. Optional facts are added in priority order while they fit. */
export function vehicleSeoDescription(vehicle: VehicleSeoInput): string {
  let text = `${vehicleTitle(vehicle)} for sale at MyCar in Fredericksburg, VA.`;
  const miles = knownMileage(vehicle);
  const cents = knownPriceCents(vehicle);
  const extras = [
    miles ? `${formatMiles(miles)}.` : null,
    cents ? `${formatUsd(cents)}.` : null,
    vehicle.vin ? `VIN ${vehicle.vin}.` : null,
    vehicle.stock_number ? `Stock #${vehicle.stock_number}.` : null,
  ];
  for (const extra of extras) {
    if (extra && `${text} ${extra}`.length <= DESCRIPTION_MAX) text = `${text} ${extra}`;
  }
  return text;
}

/** schema.org availability for the inventory status. Unknown statuses publish no availability. */
export function availabilityFor(status: string | null | undefined): string | undefined {
  if (status === "available") return "https://schema.org/InStock";
  if (status === "pending") return "https://schema.org/LimitedAvailability";
  if (status === "sold") return "https://schema.org/SoldOut";
  return undefined;
}

/**
 * Product + Vehicle structured data. Includes only what is known: no mileage or offer is emitted without a real
 * value, and the seller refers to the site-wide dealership entity.
 */
export function buildVehicleJsonLd(vehicle: VehicleSeoInput, slug: string): Record<string, unknown> {
  const url = getVehicleUrl(slug);
  const images = getVehicleImages(vehicle);
  const miles = knownMileage(vehicle);
  const cents = knownPriceCents(vehicle);
  const availability = availabilityFor(vehicle.status);
  return {
    "@context": "https://schema.org",
    "@type": ["Product", "Vehicle"],
    "@id": `${url}#vehicle`,
    url,
    name: vehicleTitle(vehicle),
    description: getVehicleDescription(vehicle),
    ...(images.length > 0 ? { image: images } : {}),
    sku: vehicle.stock_number,
    vehicleIdentificationNumber: vehicle.vin,
    brand: { "@type": "Brand", name: vehicle.make },
    model: vehicle.model,
    vehicleModelDate: String(vehicle.year),
    ...(vehicle.body_style ? { bodyType: vehicle.body_style } : {}),
    ...(miles ? { mileageFromOdometer: { "@type": "QuantitativeValue", value: miles, unitCode: "SMI" } } : {}),
    ...(vehicle.exterior_color ? { color: vehicle.exterior_color } : {}),
    ...(vehicle.fuel_type ? { fuelType: vehicle.fuel_type } : {}),
    ...(vehicle.transmission ? { vehicleTransmission: vehicle.transmission } : {}),
    ...(cents
      ? {
          offers: {
            "@type": "Offer",
            url,
            price: (cents / 100).toFixed(2),
            priceCurrency: getPriceCurrency(vehicle),
            ...(availability ? { availability } : {}),
            itemCondition: "https://schema.org/UsedCondition",
            seller: dealerReference(),
          },
        }
      : {}),
  };
}

/**
 * Alt text for one vehicle photo. A custom caption is kept. The inventory stores the bare vehicle name as the alt of
 * every legacy photo, so a blank or bare-name alt becomes "<vehicle> — photo N", which is distinct per photo.
 */
export function vehiclePhotoAlt(vehicle: Pick<VehicleSeoInput, "year" | "make" | "model" | "trim">, alt: string | null | undefined, index: number): string {
  const title = vehicleTitle(vehicle);
  const bare = [title, vehicleTitle({ ...vehicle, trim: null })].map((value) => value.toLowerCase());
  const clean = (alt ?? "").trim();
  if (clean && !bare.includes(clean.toLowerCase()) && !/^photo \d+$/i.test(clean)) return clean;
  return `${title} — photo ${index + 1}`;
}

/**
 * Whether a /search URL should be kept out of the index. The plain page is the one indexable inventory list;
 * filtered, sorted, searched and paged variants are near-duplicates of it, so they are noindex (links are still followed).
 */
export function searchResultsRobots(search: Record<string, unknown> | null | undefined): "noindex,follow" | null {
  for (const [key, value] of Object.entries(search ?? {})) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    if (key === "page" && Number(value) === 1) continue;
    return "noindex,follow";
  }
  return null;
}
