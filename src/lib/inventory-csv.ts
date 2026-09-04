// CSV import mapping for the DealerCenter inventory export (inventory_template.csv)
// -> public.vehicles / public.vehicle_photos on the dealership backend.
import type { Database } from "@/integrations/supabase/types";

type BodyStyle = Database["public"]["Enums"]["body_style"];
type FuelType = Database["public"]["Enums"]["fuel_type"];
type Drivetrain = Database["public"]["Enums"]["drivetrain"];
type VehicleStatus = Database["public"]["Enums"]["vehicle_status"];
export type VehicleInsert = Database["public"]["Tables"]["vehicles"]["Insert"];

export const REQUIRED_HEADERS = [
  "VIN",
  "Stock Number",
  "Year",
  "Make",
  "Model",
  "Odometer",
  "Body type",
] as const;

export type ParsedRow = {
  rowNumber: number;
  vehicle: VehicleInsert | null;
  photoUrls: string[];
  errors: string[];
};

export type ParsedCsv = {
  headers: string[];
  rows: ParsedRow[];
  missingHeaders: string[];
};

/** RFC4180-ish parser: handles quotes, embedded commas and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === "") inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

const clean = (v: string | undefined) =>
  (v ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

const BODY_MAP: Record<string, BodyStyle> = {
  suv: "SUV",
  crossover: "SUV",
  sedan: "Sedan",
  truck: "Truck",
  pickup: "Truck",
  cab_chassis: "Truck",
  "cab chassis": "Truck",
  coupe: "Coupe",
  hatchback: "Hatchback",
  convertible: "Convertible",
  minivan: "Minivan",
  wagon: "Wagon",
  van: "Van",
};

const FUEL_MAP: Record<string, FuelType> = {
  gas: "Gas",
  gasoline: "Gas",
  "flexible fuel": "Gas",
  flex: "Gas",
  electric: "Electric",
  hybrid: "Hybrid",
  "plug-in hybrid": "Plug-in Hybrid",
  "plug in hybrid": "Plug-in Hybrid",
  diesel: "Diesel",
};

const DRIVE_MAP: Record<string, Drivetrain> = {
  awd: "AWD/4WD",
  "4wd": "AWD/4WD",
  "4x4": "AWD/4WD",
  "awd/4wd": "AWD/4WD",
  fwd: "FWD",
  rwd: "RWD",
};

const STATUS_MAP: Record<string, VehicleStatus> = {
  "in inventory": "available",
  available: "available",
  pending: "pending",
  sold: "sold",
  draft: "draft",
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function vehicleSlug(v: {
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  vin: string;
}): string {
  const base = [v.year, v.make, v.model, v.trim ?? ""].join(" ");
  return `${slugify(base)}-${v.vin.slice(-6).toLowerCase()}`;
}

export const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

function toNumber(raw: string): number | null {
  const n = Number(raw.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** The dealer export separates options with 2+ spaces, commas or pipes. */
function splitFeatures(raw: string): string[] {
  if (!raw || !/\s{2,}|,|\|/.test(raw)) return [];
  return raw
    .split(/\s{2,}|,|\|/g)
    .map((s) => clean(s))
    .filter((s) => s.length > 1)
    .slice(0, 60);
}

function splitPhotoUrls(...raw: string[]): string[] {
  const out: string[] = [];
  for (const chunk of raw) {
    for (const part of (chunk ?? "").split(/[\s,|]+/g)) {
      const u = part.trim();
      if (/^https?:\/\//i.test(u) && !out.includes(u)) out.push(u);
    }
  }
  return out.slice(0, 12);
}

function buildDescription(desc: string, equipment: string, features: string[]): string | null {
  const parts = [desc];
  if (equipment && features.length === 0) parts.push(`Equipment and options: ${equipment}`);
  const out = parts.filter(Boolean).join("\n\n");
  return out || null;
}

export function parseInventoryCsv(text: string): ParsedCsv {
  const table = parseCsv(text);
  if (table.length === 0) return { headers: [], rows: [], missingHeaders: [...REQUIRED_HEADERS] };

  const headers = table[0]!.map((h) => clean(h));
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  const idx = (name: string) => headers.indexOf(name);
  const get = (r: string[], name: string) => clean(r[idx(name)]);

  const rows: ParsedRow[] = table.slice(1).map((r, i) => {
    const rowNumber = i + 2;
    const errors: string[] = [];

    const vin = get(r, "VIN").toUpperCase();
    if (!vin) errors.push("VIN is missing");
    else if (!VIN_RE.test(vin)) errors.push(`VIN "${vin}" is not a valid 17-character VIN`);

    const stock = get(r, "Stock Number") || vin.slice(-8);
    const year = toNumber(get(r, "Year"));
    if (year === null || year < 1900 || year > new Date().getFullYear() + 2) {
      errors.push(`Year "${get(r, "Year")}" is not valid`);
    }
    const make = get(r, "Make");
    if (!make) errors.push("Make is missing");
    const model = get(r, "Model");
    if (!model) errors.push("Model is missing");

    const mileage = toNumber(get(r, "Odometer"));
    if (mileage === null || mileage < 0) errors.push(`Odometer "${get(r, "Odometer")}" is not valid`);

    const priceRaw = get(r, "SpecialPrice") || get(r, "MSRP") || get(r, "Price");
    const price = toNumber(priceRaw);
    if (price === null || price <= 0) errors.push(`Price "${priceRaw}" is missing or not valid`);

    const bodyRaw = get(r, "Body type") || get(r, "Body Style");
    const body = BODY_MAP[bodyRaw.toLowerCase()];
    if (!body) errors.push(`Body type "${bodyRaw}" is not one of the allowed body styles`);

    const fuelRaw = get(r, "Fuel type");
    const fuel = fuelRaw ? (FUEL_MAP[fuelRaw.toLowerCase()] ?? null) : null;
    if (fuelRaw && !fuel) errors.push(`Fuel type "${fuelRaw}" is not recognized`);

    const driveRaw = get(r, "Drivetrain");
    const drive = driveRaw ? (DRIVE_MAP[driveRaw.toLowerCase()] ?? null) : null;

    const city = toNumber(get(r, "City MPG"));
    const hwy = toNumber(get(r, "Highway MPG"));
    const mpg =
      city !== null && hwy !== null && city > 0 && hwy > 0 ? Math.round((city + hwy) / 2) : null;

    const status = STATUS_MAP[get(r, "Inventory status").toLowerCase()] ?? "available";
    const trim = get(r, "Trim") || null;
    const dateReceived = parseDate(get(r, "Date in stock"));

    const equipment = clean(r[idx("Equipment and options")] ?? "");
    const features = splitFeatures(equipment);

    const photoUrls = splitPhotoUrls(get(r, "Primary photo URL"), get(r, "Additional photo URLs"));

    if (errors.length > 0) return { rowNumber, vehicle: null, photoUrls, errors };

    const vehicle: VehicleInsert = {
      vin,
      stock_number: stock,
      year: year!,
      make,
      model,
      trim,
      body_style: body!,
      mileage: mileage!,
      price_cents: Math.round(price! * 100),
      status,
      slug: vehicleSlug({ year: year!, make, model, trim, vin }),
      exterior_color: get(r, "Exterior color") || null,
      interior_color: get(r, "Interior color") || null,
      transmission: get(r, "Transmission") || null,
      engine: get(r, "Engine") || null,
      fuel_type: fuel,
      drivetrain: drive,
      mpg_combined: mpg,
      description: buildDescription(get(r, "Vehicle description"), equipment, features),
      features,
      ...(dateReceived ? { date_received: dateReceived } : {}),
    };

    return { rowNumber, vehicle, photoUrls, errors };
  });

  return { headers, rows, missingHeaders };
}
