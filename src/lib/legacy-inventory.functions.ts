import { createServerFn } from "@tanstack/react-start";

export const importLegacyInventoryRows = createServerFn({ method: "POST" })
  .inputValidator((input: {
    accessToken: string;
    mode: "skip" | "update";
    rows: Array<{ vehicle: Record<string, unknown>; photoUrls?: string[] }>;
  }) => input)
  .handler(async ({ data }) => {
    const { importLegacyInventory } = await import("./legacy-inventory.server");
    return importLegacyInventory(data);
  });

export const listLegacyInventoryRows = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => input)
  .handler(async ({ data }) => {
    const { listLegacyInventory } = await import("./legacy-inventory.server");
    return listLegacyInventory(data.accessToken);
  });

export const saveLegacyInventoryRow = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; vehicle: Record<string, unknown> }) => {
    const accessToken = String(input?.accessToken ?? "");
    const vehicle = input?.vehicle ?? {};
    const vin = String(vehicle["vin"] ?? "").replace(/\s+/g, "").toUpperCase();
    const year = Number(vehicle["year"]);
    const mileage = Number(vehicle["mileage"]);
    const price = Number(vehicle["price_cents"]);
    if (!accessToken) throw new Error("Not signed in.");
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) throw new Error("Enter a valid 17-character VIN.");
    if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 2) {
      throw new Error("Enter a valid vehicle year.");
    }
    if (!Number.isFinite(mileage) || mileage < 0) throw new Error("Enter a valid mileage.");
    if (!Number.isFinite(price) || price <= 0) throw new Error("Enter a valid selling price.");
    if (!String(vehicle["make"] ?? "").trim() || !String(vehicle["model"] ?? "").trim()) {
      throw new Error("Make and model are required.");
    }
    return { accessToken, vehicle: { ...vehicle, vin, year, mileage, price_cents: price } };
  })
  .handler(async ({ data }) => {
    const { saveLegacyInventoryVehicle } = await import("./legacy-inventory.server");
    return saveLegacyInventoryVehicle(data);
  });

export const deleteLegacyInventoryRow = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { accessToken: string; legacyId?: number | null; publicId?: string | null; vin?: string | null }) => input,
  )
  .handler(async ({ data }) => {
    const { deleteLegacyInventoryVehicle } = await import("./legacy-inventory.server");
    return deleteLegacyInventoryVehicle(data);
  });

export const listPublicLegacyInventoryRows = createServerFn({ method: "GET" })
  .inputValidator((input: Record<string, unknown>) => input ?? {})
  .handler(async ({ data }) => {
    const { listPublicLegacyInventory } = await import("./legacy-inventory.server");
    return listPublicLegacyInventory(data as Parameters<typeof listPublicLegacyInventory>[0]);
  });