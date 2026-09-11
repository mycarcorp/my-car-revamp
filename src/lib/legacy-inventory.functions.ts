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
  .inputValidator((input: { accessToken: string; vehicle: Record<string, unknown> }) => input)
  .handler(async ({ data }) => {
    const { saveLegacyInventoryVehicle } = await import("./legacy-inventory.server");
    return saveLegacyInventoryVehicle(data);
  });

export const deleteLegacyInventoryRow = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; legacyId: number; publicId?: string | null }) => input)
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