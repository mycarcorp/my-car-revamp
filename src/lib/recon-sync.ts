// Maps vehicles sent by the MyCar Recon operations app onto public.vehicles.
// Pure functions only so the webhook route stays thin and this stays testable.
import type { Database } from "@/integrations/supabase/types";
import { VIN_RE, inferBodyStyle, vehicleSlug } from "@/lib/inventory-csv";

type FuelType = Database["public"]["Enums"]["fuel_type"];
type Drivetrain = Database["public"]["Enums"]["drivetrain"];
export type VehicleInsert = Database["public"]["Tables"]["vehicles"]["Insert"];

export type ReconVehicle = {
  vin: string;
  stock?: string;
  year: number | string;
  make: string;
  model: string;
  trim?: string;
  body?: string;
  miles?: number | string;
  price: number | string;
  color?: string;
  interior?: string;
  transmission?: string;
  drive?: string;
  fuel?: string;
  engine?: string;
  description?: string;
  features?: string[];
};

const num = (v: unknown): number | null => {
  const n = Number(String(v ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null;
};
const text = (v: unknown, max = 200): string | null => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};

/** NHTSA fuel names ("Gasoline", "Electric", "Diesel", "Flexible Fuel Vehicle (FFV)") to the site enum. */
export function mapFuel(raw: unknown): FuelType | null {
  const s = String(raw ?? "").toLowerCase();
  if (!s) return null;
  if (/plug/.test(s)) return "Plug-in Hybrid";
  if (/hybrid/.test(s)) return "Hybrid";
  if (/electric/.test(s)) return "Electric";
  if (/diesel/.test(s)) return "Diesel";
  if (/gas|flex|ffv|ethanol/.test(s)) return "Gas";
  return null;
}

/** NHTSA drive names ("4WD/4-Wheel Drive/4x4", "AWD/All-Wheel Drive", "FWD/Front-Wheel Drive") to the site enum. */
export function mapDrive(raw: unknown): Drivetrain | null {
  const s = String(raw ?? "").toLowerCase();
  if (!s) return null;
  if (/awd|4wd|4x4|all-wheel|four-wheel|4-wheel/.test(s)) return "AWD/4WD";
  if (/fwd|front/.test(s)) return "FWD";
  if (/rwd|rear|4x2/.test(s)) return "RWD";
  return null;
}

export type MapResult = { ok: true; row: VehicleInsert } | { ok: false; errors: string[] };

export function mapReconVehicle(v: ReconVehicle): MapResult {
  const errors: string[] = [];
  const vin = String(v.vin ?? "").trim().toUpperCase();
  if (!VIN_RE.test(vin)) errors.push("VIN must be 17 valid characters");
  const year = num(v.year);
  if (!year || year < 1980 || year > new Date().getFullYear() + 2) errors.push("Year is missing or invalid");
  const make = text(v.make, 60);
  const model = text(v.model, 80);
  if (!make) errors.push("Make is required");
  if (!model) errors.push("Model is required");
  const price = num(v.price);
  if (price === null || price <= 0) errors.push("Asking price is required");
  const body = inferBodyStyle(String(v.body ?? ""), String(model ?? ""), String(v.trim ?? ""));
  if (!body) errors.push(`Body style "${v.body ?? ""}" is not recognized; set it on the car`);
  if (errors.length) return { ok: false, errors };
  const trim = text(v.trim, 80);
  const row: VehicleInsert = {
    vin,
    stock_number: text(v.stock, 40) ?? vin.slice(-8),
    slug: vehicleSlug({ year: year!, make: make!, model: model!, trim, vin }),
    year: year!,
    make: make!,
    model: model!,
    trim,
    body_style: body!,
    mileage: Math.max(0, Math.round(num(v.miles) ?? 0)),
    price_cents: Math.round(price! * 100),
    exterior_color: text(v.color, 60),
    interior_color: text(v.interior, 60),
    transmission: text(v.transmission, 60),
    drivetrain: mapDrive(v.drive),
    fuel_type: mapFuel(v.fuel),
    engine: text(v.engine, 80),
    description: text(v.description, 8000),
    features: Array.isArray(v.features) ? v.features.map((f) => String(f).trim()).filter(Boolean).slice(0, 80) : [],
    status: "available",
    last_synced_at: new Date().toISOString(),
  };
  return { ok: true, row };
}
