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
  /** Combined MPG from fueleconomy.gov, when a confident match exists. */
  mpgCombined?: number | undefined;
  mpgCity?: number | undefined;
  mpgHighway?: number | undefined;
  /** Safety / equipment highlights suitable for the features list. */
  features: string[];
  /** Ready-to-use description sentence built from the decoded data. */
  description?: string | undefined;
};

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
const clean = (value: unknown): string | undefined => {
  const text = String(value ?? "").trim();
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

/** NHTSA equipment fields that read as feature bullets when present/standard. */
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
  const text = String(value ?? "").trim().toLowerCase();
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

/** Best-effort combined MPG lookup from the free fueleconomy.gov API. */
async function lookupMpg(year: number, make: string, model: string): Promise<EpaMpg> {
  const base = "https://www.fueleconomy.gov/ws/rest/vehicle/menu/options";
  const url = `${base}?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
  try {
    const listRes = await fetch(url, { headers: { Accept: "application/json" } });
    if (!listRes.ok) return {};
    const list = (await listRes.json()) as { menuItem?: unknown };
    const items = Array.isArray(list.menuItem) ? list.menuItem : list.menuItem ? [list.menuItem] : [];
    const first = items[0] as { value?: unknown } | undefined;
    const id = clean(first?.value);
    if (!id) return {};
    const detailRes = await fetch(`https://www.fueleconomy.gov/ws/rest/vehicle/${id}`, {
      headers: { Accept: "application/json" },
    });
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

export const decodeVin = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; vin: string }) => {
    const accessToken = String(input?.accessToken ?? "");
    const vin = String(input?.vin ?? "").replace(/\s+/g, "").toUpperCase();
    if (!accessToken) throw new Error("Not signed in.");
    if (!VIN_PATTERN.test(vin)) throw new Error("Enter a valid 17-character VIN.");
    return { accessToken, vin };
  })
  .handler(async ({ data }): Promise<VinDecodedVehicle> => {
    await requireStaff(data.accessToken);
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(data.vin)}?format=json`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) throw new Error("VIN service is unavailable. Please try again.");

    const payload = (await response.json()) as {
      Results?: Array<Record<string, unknown>>;
    };
    const result = payload.Results?.[0];
    if (!result) throw new Error("VIN was not found.");

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
      vin: data.vin,
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
  });
