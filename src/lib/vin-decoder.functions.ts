import { createServerFn } from "@tanstack/react-start";
import { requireStaff } from "./legacy-blog.server";

export type VinDecodedVehicle = {
  vin: string;
  year?: number | undefined;
  make?: string | undefined;
  model?: string | undefined;
  trim?: string | undefined;
  series?: string | undefined;
  bodyStyle?: string | undefined;
  vehicleType?: string | undefined;
  doors?: string | undefined;
  seats?: string | undefined;
  engine?: string | undefined;
  cylinders?: string | undefined;
  displacement?: string | undefined;
  horsepower?: string | undefined;
  turbo?: string | undefined;
  fuelType?: string | undefined;
  fuelTypeSecondary?: string | undefined;
  electrification?: string | undefined;
  transmission?: string | undefined;
  transmissionSpeeds?: string | undefined;
  drivetrain?: string | undefined;
  manufacturer?: string | undefined;
  plantCountry?: string | undefined;
  plantState?: string | undefined;
  plantCity?: string | undefined;
  mpgCombined?: number | undefined;
  mpgCity?: number | undefined;
  mpgHighway?: number | undefined;
  features: string[];
  description?: string | undefined;
};

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
const NHTSA_TIMEOUT_MS = 8_000;
const NHTSA_MIN_REQUEST_GAP_MS = 500;
const NHTSA_PRIMARY_ATTEMPTS = 2;
const MPG_TOTAL_TIMEOUT_MS = 3_500;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

type CacheEntry = { expiresAt: number; value: VinDecodedVehicle };
const decodeCache = new Map<string, CacheEntry>();
const inFlightDecodes = new Map<string, Promise<VinDecodedVehicle>>();
let nhtsaQueue: Promise<void> = Promise.resolve();
let lastNhtsaRequestAt = 0;

const clean = (value: unknown): string | undefined => {
  const text = String(value ?? "")
    .replace(/\*+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return !text ||
    /^not applicable$/i.test(text) ||
    /^not available$/i.test(text) ||
    /^\/$/.test(text) ||
    /^0$/.test(text)
    ? undefined
    : text;
};

const numberValue = (value: unknown): number | undefined => {
  const n = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const FEATURE_FIELDS: Array<[key: string, label: string]> = [
  ["ABS", "Anti-lock brakes (ABS)"],
  ["ESC", "Electronic stability control"],
  ["TractionControl", "Traction control"],
  ["TPMS", "Tire pressure monitoring"],
  ["AirBagLocFront", "Front airbags"],
  ["AirBagLocSide", "Side airbags"],
  ["AirBagLocCurtain", "Curtain airbags"],
  ["AirBagLocKnee", "Knee airbags"],
  ["SeatBeltsAll", "Seat belt pretensioners"],
  ["BlindSpotMon", "Blind spot monitoring"],
  ["ForwardCollisionWarning", "Forward collision warning"],
  ["LaneDepartureWarning", "Lane departure warning"],
  ["LaneKeepSystem", "Lane keep assist"],
  ["AdaptiveCruiseControl", "Adaptive cruise control"],
  ["RearVisibilitySystem", "Backup camera"],
  ["ParkAssist", "Parking sensors"],
  ["PedestrianAutomaticEmergencyBraking", "Pedestrian emergency braking"],
  ["AutomaticPedestrianAlertingSound", "Pedestrian alert sound"],
  ["DaytimeRunningLight", "Daytime running lights"],
  ["KeylessIgnition", "Keyless ignition"],
  ["AdaptiveHeadlights", "Adaptive headlights"],
  ["SemiautomaticHeadlampBeamSwitching", "Automatic high beams"],
];

const isEnabled = (value: unknown): boolean => {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!text) return false;
  return (
    text === "standard" ||
    text === "yes" ||
    text === "1" ||
    text === "optional" ||
    (!text.startsWith("not ") && !text.startsWith("no") && text !== "0")
  );
};

type EpaMpg = { combined?: number; city?: number; highway?: number };

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function enqueueNhtsa<T>(task: () => Promise<T>): Promise<T> {
  const queued = nhtsaQueue.then(task, task);
  nhtsaQueue = queued.then(
    () => undefined,
    () => undefined,
  );
  return queued;
}

async function respectNhtsaRequestGap() {
  const remaining = NHTSA_MIN_REQUEST_GAP_MS - (Date.now() - lastNhtsaRequestAt);
  if (remaining > 0) await sleep(remaining);
  lastNhtsaRequestAt = Date.now();
}

function isTemporaryStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function requestNhtsa(vin: string): Promise<Record<string, unknown>> {
  return enqueueNhtsa(async () => {
    const encodedVin = encodeURIComponent(vin);
    const requests = [
      ...Array.from(
        { length: NHTSA_PRIMARY_ATTEMPTS },
        () => `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodedVin}?format=json`,
      ),
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodedVin}?format=json`,
    ];

    let sawRateLimit = false;
    let sawTimeout = false;

    for (let index = 0; index < requests.length; index++) {
      await respectNhtsaRequestGap();

      try {
        const response = await fetchWithTimeout(requests[index]!, NHTSA_TIMEOUT_MS);
        if (response.ok) {
          const payload = (await response.json()) as {
            Results?: Array<Record<string, unknown>>;
          };
          const result = payload.Results?.[0];
          if (result) return result;
        } else {
          sawRateLimit ||= response.status === 429;
          if (!isTemporaryStatus(response.status)) {
            throw new Error(`VIN service rejected the request (${response.status}).`);
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          sawTimeout = true;
        } else if (error instanceof Error && error.message.startsWith("VIN service rejected")) {
          throw error;
        }
      }

      if (index < requests.length - 1) {
        await sleep(600 * 2 ** index);
      }
    }

    if (sawRateLimit) {
      throw new Error("VIN service is busy. Your request was retried automatically; please try again shortly.");
    }
    if (sawTimeout) {
      throw new Error("VIN service did not respond after automatic retries. Please try again.");
    }
    throw new Error("VIN service is temporarily unavailable after automatic retries.");
  });
}

async function lookupMpg(year: number, make: string, model: string): Promise<EpaMpg> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MPG_TOTAL_TIMEOUT_MS);
  const request = (url: string) =>
    fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

  try {
    const base = "https://www.fueleconomy.gov/ws/rest/vehicle/menu/options";
    const url = `${base}?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
    const listRes = await request(url);
    if (!listRes.ok) return {};

    const list = (await listRes.json()) as { menuItem?: unknown };
    const items = Array.isArray(list.menuItem) ? list.menuItem : list.menuItem ? [list.menuItem] : [];
    const first = items[0] as { value?: unknown } | undefined;
    const id = clean(first?.value);
    if (!id) return {};

    const detailRes = await request(`https://www.fueleconomy.gov/ws/rest/vehicle/${encodeURIComponent(id)}`);
    if (!detailRes.ok) return {};

    const detail = (await detailRes.json()) as Record<string, unknown>;
    const combined = numberValue(detail["comb08"]);
    const city = numberValue(detail["city08"]);
    const highway = numberValue(detail["highway08"]);
    return {
      ...(combined ? { combined: Math.round(combined) } : {}),
      ...(city ? { city: Math.round(city) } : {}),
      ...(highway ? { highway: Math.round(highway) } : {}),
    };
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

function buildEngine(result: Record<string, unknown>): string | undefined {
  const displacement = clean(result["DisplacementL"]);
  const cylinders = clean(result["EngineCylinders"]);
  const config = clean(result["EngineConfiguration"]);
  const hp = clean(result["EngineHP"]);
  const turbo = clean(result["Turbo"]);
  const model = clean(result["EngineModel"]);
  const parts: string[] = [];
  if (displacement) parts.push(`${Number(displacement).toFixed(1)}L`);
  if (cylinders) {
    const prefix = config?.toLowerCase().startsWith("v") ? "V" : config?.toLowerCase().includes("in-line") ? "I" : "";
    parts.push(prefix ? `${prefix}${cylinders}` : `${cylinders}-cylinder`);
  }
  if (turbo && /yes/i.test(turbo)) parts.push("Turbocharged");
  if (hp) parts.push(`${Math.round(Number(hp))} hp`);
  if (parts.length === 0) return model ?? config ?? undefined;
  return parts.join(" ");
}

function buildTransmission(result: Record<string, unknown>): string | undefined {
  const style = clean(result["TransmissionStyle"]);
  const speeds = clean(result["TransmissionSpeeds"]);
  if (style && speeds) return `${speeds}-speed ${style}`;
  return style ?? (speeds ? `${speeds}-speed` : undefined);
}

function readCache(vin: string): VinDecodedVehicle | undefined {
  const cached = decodeCache.get(vin);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    decodeCache.delete(vin);
    return undefined;
  }
  return cached.value;
}

function writeCache(vin: string, value: VinDecodedVehicle) {
  if (decodeCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = decodeCache.keys().next().value as string | undefined;
    if (oldestKey) decodeCache.delete(oldestKey);
  }
  decodeCache.set(vin, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

async function decodeVinData(vin: string): Promise<VinDecodedVehicle> {
  const result = await requestNhtsa(vin);

  const year = numberValue(result["ModelYear"]);
  const make = clean(result["Make"]);
  const model = clean(result["Model"]);
  if (!year && !make && !model) throw new Error("VIN returned no usable vehicle information.");

  const features = FEATURE_FIELDS.filter(([key]) => isEnabled(result[key])).map(([, label]) => label);
  const trim = clean(result["Trim"]) ?? clean(result["Series"]);
  const bodyStyle = clean(result["BodyClass"]);
  const doors = clean(result["Doors"]);
  const engine = buildEngine(result);
  const transmission = buildTransmission(result);
  const drivetrain = clean(result["DriveType"]);
  const fuelType = clean(result["FuelTypePrimary"]);

  // MPG is optional. Its entire two-request lookup gets only one short budget.
  // If it is slow or unavailable, decoding still succeeds with NHTSA data.
  const mpg = year && make && model ? await lookupMpg(year, make, model) : {};

  const titleName = [year, make, model, trim].filter(Boolean).join(" ");
  const descriptionBits = [
    bodyStyle ? bodyStyle.toLowerCase() : undefined,
    drivetrain ? drivetrain.replace(/\s*\/\s*/g, "/") : undefined,
    engine,
    transmission ? transmission.toLowerCase() : undefined,
    fuelType ? `${fuelType.toLowerCase()} fuel` : undefined,
    mpg.combined ? `${mpg.combined} MPG combined` : undefined,
  ].filter(Boolean);
  const description = titleName
    ? `${titleName}${descriptionBits.length ? ` — ${descriptionBits.join(", ")}` : ""}.`
    : undefined;

  return {
    vin,
    year,
    make,
    model,
    trim,
    series: clean(result["Series"]),
    bodyStyle,
    vehicleType: clean(result["VehicleType"]),
    doors,
    seats: clean(result["Seats"]) ?? clean(result["SeatRows"]),
    engine,
    cylinders: clean(result["EngineCylinders"]),
    displacement: clean(result["DisplacementL"]),
    horsepower: clean(result["EngineHP"]),
    turbo: clean(result["Turbo"]),
    fuelType,
    fuelTypeSecondary: clean(result["FuelTypeSecondary"]),
    electrification: clean(result["ElectrificationLevel"]),
    transmission,
    transmissionSpeeds: clean(result["TransmissionSpeeds"]),
    drivetrain,
    manufacturer: clean(result["Manufacturer"]),
    plantCountry: clean(result["PlantCountry"]),
    plantState: clean(result["PlantState"]),
    plantCity: clean(result["PlantCity"]),
    ...(mpg.combined ? { mpgCombined: mpg.combined } : {}),
    ...(mpg.city ? { mpgCity: mpg.city } : {}),
    ...(mpg.highway ? { mpgHighway: mpg.highway } : {}),
    features,
    description,
  };
}

export const decodeVin = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; vin: string }) => {
    const accessToken = String(input?.accessToken ?? "");
    const vin = String(input?.vin ?? "")
      .replace(/\s+/g, "")
      .toUpperCase();
    if (!accessToken) throw new Error("Not signed in.");
    if (!VIN_PATTERN.test(vin)) throw new Error("Enter a valid 17-character VIN.");
    return { accessToken, vin };
  })
  .handler(async ({ data }): Promise<VinDecodedVehicle> => {
    await requireStaff(data.accessToken);

    const cached = readCache(data.vin);
    if (cached) return cached;

    const activeRequest = inFlightDecodes.get(data.vin);
    if (activeRequest) return activeRequest;

    const request = decodeVinData(data.vin).then((decoded) => {
      writeCache(data.vin, decoded);
      return decoded;
    });
    inFlightDecodes.set(data.vin, request);

    try {
      return await request;
    } finally {
      if (inFlightDecodes.get(data.vin) === request) {
        inFlightDecodes.delete(data.vin);
      }
    }
  });
