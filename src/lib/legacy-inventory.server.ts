import { requireStaff } from "./legacy-blog.server";

type Json = Record<string, unknown>;

type LegacyCar = {
  id: number;
  year: number;
  make: string;
  model: string;
  trim_level: string | null;
  body_type: string | null;
  fuel_type: string | null;
  drivetrain: string | null;
  color: string | null;
  mileage: number | null;
  price: number;
  original_price: number | null;
  image_url: string | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  source_id: string | null;
};

function creds() {
  const url = process.env["LEGACY_SUPABASE_URL"];
  const key = process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("Legacy inventory credentials are not configured.");
  return { url, key };
}

async function rest(
  path: string,
  init: { method?: string; body?: unknown; profile?: "public" | "mycarco_db"; prefer?: string } = {},
) {
  const c = creds();
  const method = init.method ?? "GET";
  const headers: Record<string, string> = {
    apikey: c.key,
    Authorization: `Bearer ${c.key}`,
    "Content-Type": "application/json",
  };
  if (init.profile) headers[method === "GET" ? "Accept-Profile" : "Content-Profile"] = init.profile;
  if (init.prefer) headers["Prefer"] = init.prefer;
  const requestInit: RequestInit = {
    method,
    headers,
  };
  if (init.body !== undefined) requestInit.body = JSON.stringify(init.body);
  const response = await fetch(`${c.url}/rest/v1/${path}`, requestInit);
  const text = await response.text();
  if (!response.ok) throw new Error(`Legacy inventory request failed (${response.status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const enumBody = (value: string | null): string => {
  const text = (value ?? "").toLowerCase();
  if (/suv|sport utility|crossover/.test(text)) return "SUV";
  if (/truck|pickup|chassis/.test(text)) return "Truck";
  if (/coupe/.test(text)) return "Coupe";
  if (/convertible|roadster/.test(text)) return "Convertible";
  if (/van/.test(text)) return "Van";
  if (/wagon/.test(text)) return "Wagon";
  if (/hatch/.test(text)) return "Hatchback";
  return "Sedan";
};

const enumStatus = (value: string | null) =>
  value === "draft" ? "draft" : value === "sold" ? "sold" : value === "pending" ? "pending" : "available";

function imageUrls(car: LegacyCar): string[] {
  const vin = (car.source_id ?? `legacy-${car.id}`).trim().toLowerCase();
  return (car.image_url ?? "")
    .split(/[,|\s]+/)
    .map((path) => path.trim())
    .filter(Boolean)
    .map((path) => {
      if (/^https?:\/\//i.test(path)) return path;
      const photo = path.match(/photo-(\d+)\.(?:jpg|jpeg|png|webp)$/i);
      if (photo) return `/api/public/vehicle-photos/${vin}/photo-${photo[1]}.jpg`;
      return path;
    });
}

function publicVehicle(car: LegacyCar, existingId?: string, overrides: Record<string, unknown> = {}) {
  const vin = (car.source_id ?? `legacy-${car.id}`).trim().toUpperCase();
  const slug = `${car.year}-${car.make}-${car.model}-${car.id}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    ...(existingId ? { id: existingId } : {}),
    vin,
    stock_number: `LEGACY-${car.id}`,
    slug,
    year: car.year,
    make: car.make,
    model: car.model,
    trim: car.trim_level,
    body_style: enumBody(car.body_type ?? car.trim_level),
    mileage: car.mileage ?? 0,
    price_cents: Math.round(Number(car.price) * 100),
    prior_price_cents: car.original_price == null ? null : Math.round(Number(car.original_price) * 100),
    exterior_color: car.color,
    interior_color: null,
    fuel_type: /hybrid/i.test(car.fuel_type ?? "") ? "Hybrid" : /electric/i.test(car.fuel_type ?? "") ? "Electric" : "Gas",
    drivetrain: /awd|4wd/i.test(car.drivetrain ?? "") ? "AWD/4WD" : /rwd/i.test(car.drivetrain ?? "") ? "RWD" : "FWD",
    description: car.description,
    features: [],
    status: enumStatus(car.status),
    date_received: (car.created_at ?? new Date().toISOString()).slice(0, 10),
    ...overrides,
  };
}

export type LegacyInventoryRow = ReturnType<typeof publicVehicle> & {
  id: string;
  legacy_id: number;
  vehicle_photos: { url: string; position: number; alt: string | null }[];
};

export async function listLegacyInventory(accessToken: string): Promise<LegacyInventoryRow[]> {
  await requireStaff(accessToken);
  const cars = (await rest("mc_cars?select=*&order=created_at.desc", {
    profile: "mycarco_db",
  })) as LegacyCar[];
  if (!cars.length) return [];

  const vins = cars
    .map((car) => (car.source_id ?? `legacy-${car.id}`).trim().toUpperCase())
    .filter(Boolean);
  const publicRows = (await rest(
    `vehicles?select=*&vin=in.(${vins.map(encodeURIComponent).join(",")})`,
    { profile: "public" },
  )) as Array<Record<string, unknown> & { id: string; vin: string }>;
  const publicIds = new Map(publicRows.map((row) => [row.vin.toUpperCase(), row.id]));

  return cars.map((car) => {
    const vin = (car.source_id ?? `legacy-${car.id}`).trim().toUpperCase();
    const publicRow = publicRows.find((row) => row.vin.toUpperCase() === vin);
    return adapt(car, publicIds.get(vin) ?? `legacy-${car.id}`, publicRow);
  });
}

function adapt(
  car: LegacyCar,
  publicId: string,
  publicRow?: Record<string, unknown> | null,
): LegacyInventoryRow {
  const urls = imageUrls(car);
  return {
    ...publicVehicle(car, publicId, publicRow ? publicFields(publicRow) : {}),
    id: publicId,
    legacy_id: car.id,
    vehicle_photos: urls.map((url, index) => ({
      url,
      position: index + 1,
      alt: `${car.year} ${car.make} ${car.model}`,
    })),
  };
}

function publicFields(row: Record<string, unknown>): Record<string, unknown> {
  return {
    vin: row.vin,
    stock_number: row.stock_number,
    slug: row.slug,
    year: row.year,
    make: row.make,
    model: row.model,
    trim: row.trim,
    body_style: row.body_style,
    mileage: row.mileage,
    price_cents: row.price_cents,
    prior_price_cents: row.prior_price_cents,
    exterior_color: row.exterior_color,
    interior_color: row.interior_color,
    transmission: row.transmission,
    drivetrain: row.drivetrain,
    fuel_type: row.fuel_type,
    engine: row.engine,
    mpg_combined: row.mpg_combined,
    description: row.description,
    features: row.features,
    status: row.status,
    is_featured: row.is_featured,
    date_received: row.date_received,
  };
}

function publicFieldsFromInput(vehicle: Json): Record<string, unknown> {
  return {
    stock_number: String(vehicle.stock_number ?? "").trim() || undefined,
    slug: String(vehicle.slug ?? "").trim() || undefined,
    trim: vehicle.trim ?? null,
    body_style: vehicle.body_style,
    interior_color: vehicle.interior_color ?? null,
    transmission: vehicle.transmission ?? null,
    drivetrain: vehicle.drivetrain ?? null,
    fuel_type: vehicle.fuel_type ?? null,
    engine: vehicle.engine ?? null,
    mpg_combined: vehicle.mpg_combined ?? null,
    description: vehicle.description ?? null,
    features: Array.isArray(vehicle.features) ? vehicle.features : [],
    status: vehicle.status,
    is_featured: Boolean(vehicle.is_featured),
  };
}

export async function importLegacyInventory(input: {
  accessToken: string;
  rows: Array<{ vehicle: Json; photoUrls?: string[] }>;
  mode: "skip" | "update";
}) {
  await requireStaff(input.accessToken);
  const summary = { added: 0, updated: 0, skipped: 0, failed: [] as string[] };
  for (const row of input.rows) {
    const vehicle = row.vehicle;
    const sourceId = String(vehicle["vin"] ?? "").trim().toLowerCase();
    try {
      const existing = (await rest(`mc_cars?select=*&source_id=eq.${encodeURIComponent(sourceId)}&limit=1`, { profile: "mycarco_db" })) as LegacyCar[];
      if (existing[0] && input.mode === "skip") {
        summary.skipped++;
        continue;
      }
      const payload = {
        year: Number(vehicle["year"]),
        make: String(vehicle["make"] ?? ""),
        model: String(vehicle["model"] ?? ""),
        trim_level: vehicle["trim"] ?? null,
        body_type: vehicle["body_style"] ?? null,
        fuel_type: vehicle["fuel_type"] ?? "Gas",
        drivetrain: vehicle["drivetrain"] ?? null,
        color: vehicle["exterior_color"] ?? null,
        mileage: Number(vehicle["mileage"] ?? 0),
        price: Number(vehicle["price_cents"] ?? 0) / 100,
        original_price: vehicle["prior_price_cents"] == null ? null : Number(vehicle["prior_price_cents"]) / 100,
        image_url: (row.photoUrls?.length ? row.photoUrls : existing[0]?.image_url?.split(","))?.join(",") ?? null,
        description: vehicle["description"] ?? null,
        status: vehicle["status"] === "draft" ? "draft" : vehicle["status"] === "sold" ? "sold" : vehicle["status"] === "pending" ? "pending" : "active",
        source_id: sourceId,
      };
      const result = existing[0]
        ? await rest(`mc_cars?id=eq.${existing[0].id}`, { method: "PATCH", profile: "mycarco_db", prefer: "return=representation", body: payload })
        : await rest("mc_cars", { method: "POST", profile: "mycarco_db", prefer: "return=representation", body: payload });
      const car = (result as LegacyCar[])[0];
      if (!car) throw new Error("Legacy vehicle was not returned after save.");
      const vin = sourceId.toUpperCase();
      const publicRows = (await rest(`vehicles?select=id&vin=eq.${encodeURIComponent(vin)}&limit=1`, { profile: "public" })) as Array<{ id: string }>;
      const publicPayload = {
        ...publicVehicle(car, publicRows[0]?.id),
        ...publicFieldsFromInput(vehicle),
      };
      const publicResult = publicRows[0]
        ? await rest(`vehicles?id=eq.${publicRows[0].id}`, { method: "PATCH", profile: "public", prefer: "return=representation", body: publicPayload })
        : await rest("vehicles", { method: "POST", profile: "public", prefer: "return=representation", body: publicPayload });
      const publicId = (publicResult as Array<{ id: string }>)[0]?.id ?? publicRows[0]?.id;
      if (publicId) {
        await rest(`vehicle_photos?vehicle_id=eq.${publicId}`, { method: "DELETE", profile: "public" });
        const urls = imageUrls(car);
        if (urls.length) await rest("vehicle_photos", { method: "POST", profile: "public", body: urls.map((url, i) => ({ vehicle_id: publicId, url, position: i + 1, alt: `${car.year} ${car.make} ${car.model}` })) });
      }
      if (existing[0]) summary.updated++;
      else summary.added++;
    } catch (error) {
      summary.failed.push(error instanceof Error ? error.message : "Unknown import error");
    }
  }
  return summary;
}

export async function saveLegacyInventoryVehicle(input: {
  accessToken: string;
  vehicle: Json;
}): Promise<LegacyInventoryRow> {
  const result = await importLegacyInventory({
    accessToken: input.accessToken,
    mode: "update",
    rows: [{ vehicle: input.vehicle }],
  });
  if (result.failed.length) throw new Error(result.failed[0]);

  const sourceId = String(input.vehicle["vin"] ?? "").trim().toLowerCase();
  const cars = (await rest(`mc_cars?select=*&source_id=eq.${encodeURIComponent(sourceId)}&limit=1`, {
    profile: "mycarco_db",
  })) as LegacyCar[];
  const car = cars[0];
  if (!car) throw new Error("Legacy vehicle was not returned after save.");
  const vin = sourceId.toUpperCase();
  const publicRows = (await rest(`vehicles?select=id&vin=eq.${encodeURIComponent(vin)}&limit=1`, {
    profile: "public",
  })) as Array<{ id: string }>;
  return adapt(car, publicRows[0]?.id ?? `legacy-${car.id}`);
}

export async function deleteLegacyInventoryVehicle(input: {
  accessToken: string;
  legacyId: number;
  publicId?: string | null;
}) {
  await requireStaff(input.accessToken);
  await rest(`mc_cars?id=eq.${input.legacyId}`, { method: "DELETE", profile: "mycarco_db" });
  if (!input.publicId || input.publicId.startsWith("legacy-")) return;

  await rest(`leads?vehicle_id=eq.${encodeURIComponent(input.publicId)}`, {
    method: "PATCH",
    profile: "public",
    body: { vehicle_id: null },
  });
  await rest(`appointments?vehicle_id=eq.${encodeURIComponent(input.publicId)}`, {
    method: "PATCH",
    profile: "public",
    body: { vehicle_id: null },
  });
  await rest(`saved_vehicles?vehicle_id=eq.${encodeURIComponent(input.publicId)}`, {
    method: "DELETE",
    profile: "public",
  });
  await rest(`vehicle_photos?vehicle_id=eq.${encodeURIComponent(input.publicId)}`, {
    method: "DELETE",
    profile: "public",
  });
  await rest(`vehicles?id=eq.${encodeURIComponent(input.publicId)}`, {
    method: "DELETE",
    profile: "public",
  });
}

export async function listPublicLegacyInventory(input: {
  q?: string;
  make?: string;
  model?: string;
  body?: string;
  fuel?: string;
  drivetrain?: string;
  color?: string;
  priceMin?: number;
  priceMax?: number;
  yearMin?: number;
  yearMax?: number;
  mileageMax?: number;
  sort?: string;
  page?: number;
  pageSize?: number;
  slug?: string;
  excludeId?: string;
}): Promise<{ vehicles: LegacyInventoryRow[]; count: number }> {
  const cars = (await rest("mc_cars?select=*&order=created_at.desc", {
    profile: "mycarco_db",
  })) as LegacyCar[];
  const vins = cars
    .map((car) => (car.source_id ?? `legacy-${car.id}`).trim().toUpperCase())
    .filter(Boolean);
  const publicRows = (await rest(
    `vehicles?select=id,vin&vin=in.(${vins.map(encodeURIComponent).join(",")})`,
    { profile: "public" },
  )) as Array<{ id: string; vin: string }>;
  const publicIds = new Map(publicRows.map((row) => [row.vin.toUpperCase(), row.id]));
  let rows = cars.map((car) => {
    const vin = (car.source_id ?? `legacy-${car.id}`).trim().toUpperCase();
    return adapt(car, publicIds.get(vin) ?? `legacy-${car.id}`);
  });
  rows = rows.filter((row) => row.status === "available" || row.status === "pending");
  if (input.slug) rows = rows.filter((row) => row.slug === input.slug);
  if (input.excludeId) rows = rows.filter((row) => row.id !== input.excludeId);
  const needle = input.q?.trim().toLowerCase();
  if (needle) rows = rows.filter((row) => [row.make, row.model, row.trim].join(" ").toLowerCase().includes(needle));
  if (input.make) rows = rows.filter((row) => row.make === input.make);
  if (input.model) rows = rows.filter((row) => row.model === input.model);
  if (input.body) rows = rows.filter((row) => row.body_style === input.body);
  if (input.fuel) rows = rows.filter((row) => row.fuel_type === input.fuel);
  if (input.drivetrain) rows = rows.filter((row) => row.drivetrain === input.drivetrain);
  if (input.color) rows = rows.filter((row) => row.exterior_color === input.color);
  if (input.priceMin != null) rows = rows.filter((row) => Number(row.price_cents) >= input.priceMin! * 100);
  if (input.priceMax != null) rows = rows.filter((row) => Number(row.price_cents) <= input.priceMax! * 100);
  if (input.yearMin != null) rows = rows.filter((row) => row.year >= input.yearMin!);
  if (input.yearMax != null) rows = rows.filter((row) => row.year <= input.yearMax!);
  if (input.mileageMax != null) rows = rows.filter((row) => row.mileage <= input.mileageMax!);
  rows.sort((a, b) => {
    if (input.sort === "price-asc") return Number(a.price_cents) - Number(b.price_cents);
    if (input.sort === "price-desc") return Number(b.price_cents) - Number(a.price_cents);
    if (input.sort === "mileage-asc") return a.mileage - b.mileage;
    return String(b.date_received).localeCompare(String(a.date_received));
  });
  const count = rows.length;
  const page = Math.max(1, input.page ?? 1);
  const pageSize = input.pageSize ?? 24;
  return { vehicles: rows.slice((page - 1) * pageSize, page * pageSize), count };
}