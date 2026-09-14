import { createServerFn } from "@tanstack/react-start";
import { requireStaff } from "./legacy-blog.server";

export type VinDecodedVehicle = {
  vin: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  bodyStyle?: string;
  vehicleType?: string;
  doors?: string;
  engine?: string;
  cylinders?: string;
  displacement?: string;
  fuelType?: string;
  transmission?: string;
  drivetrain?: string;
  manufacturer?: string;
  plantCountry?: string;
  plantState?: string;
};

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
const clean = (value: unknown): string | undefined => {
  const text = String(value ?? "").trim();
  return !text || /^not applicable$/i.test(text) || /^not available$/i.test(text) ? undefined : text;
};

const numberValue = (value: unknown): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

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

    const year = numberValue(result.ModelYear);
    const make = clean(result.Make);
    const model = clean(result.Model);
    if (!year && !make && !model) throw new Error("VIN returned no usable vehicle information.");

    return {
      vin: data.vin,
      year,
      make,
      model,
      trim: clean(result.Trim) ?? clean(result.Series),
      bodyStyle: clean(result.BodyClass),
      vehicleType: clean(result.VehicleType),
      doors: clean(result.Doors),
      engine: clean(result.EngineModel) ?? clean(result.EngineConfiguration),
      cylinders: clean(result.EngineCylinders),
      displacement: clean(result.DisplacementL),
      fuelType: clean(result.FuelTypePrimary),
      transmission: clean(result.TransmissionStyle),
      drivetrain: clean(result.DriveType),
      manufacturer: clean(result.Manufacturer),
      plantCountry: clean(result.PlantCountry),
      plantState: clean(result.PlantState),
    };
  });
