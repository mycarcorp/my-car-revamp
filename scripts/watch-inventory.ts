import { mkdir, readdir, readFile, rename } from "node:fs/promises";
import { watch } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseInventoryCsv } from "../src/lib/inventory-csv";
import { importLegacyInventory } from "../src/lib/legacy-inventory.server";

const uploadsDir = resolve("uploads");
const processedDir = join(uploadsDir, "processed");
const accessToken = process.env.INVENTORY_IMPORT_ACCESS_TOKEN;

if (!accessToken) {
  throw new Error("INVENTORY_IMPORT_ACCESS_TOKEN is required to watch inventory uploads.");
}

let importing = false;
let pendingImport = false;

async function importFile(fileName: string) {
  if (!fileName.toLowerCase().endsWith(".csv")) return;
  if (importing) {
    pendingImport = true;
    return;
  }

  importing = true;
  try {
    const files = await readdir(uploadsDir);
    const nextFile = files.find((file) => file.toLowerCase().endsWith(".csv"));
    if (!nextFile) return;

    const filePath = join(uploadsDir, nextFile);
    const parsed = parseInventoryCsv(await readFile(filePath, "utf8"));
    if (parsed.missingHeaders.length > 0) {
      console.error(`${nextFile}: missing columns: ${parsed.missingHeaders.join(", ")}`);
      return;
    }

    const validRows = parsed.rows.filter((row) => row.vehicle);
    const invalidRows = parsed.rows.filter((row) => !row.vehicle);
    if (invalidRows.length > 0) {
      console.error(`${nextFile}: ${invalidRows.length} invalid row(s) were skipped.`);
    }
    if (validRows.length === 0) {
      console.error(`${nextFile}: no valid vehicles found.`);
      return;
    }

    const result = await importLegacyInventory({
      accessToken,
      mode: "update",
      rows: validRows.map((row) => ({ vehicle: row.vehicle!, photoUrls: row.photoUrls })),
    });
    console.log(
      `${nextFile}: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped, ${result.failed.length} failed.`,
    );
    if (result.failed.length > 0) console.error(result.failed.join("\n"));

    await mkdir(processedDir, { recursive: true });
    await rename(filePath, join(processedDir, `${Date.now()}-${basename(nextFile)}`));
  } finally {
    importing = false;
    if (pendingImport) {
      pendingImport = false;
      const files = await readdir(uploadsDir);
      const nextFile = files.find((file) => file.toLowerCase().endsWith(".csv"));
      if (nextFile) void importFile(nextFile);
    }
  }
}

await mkdir(uploadsDir, { recursive: true });
await mkdir(processedDir, { recursive: true });

for (const file of await readdir(uploadsDir)) void importFile(file);

console.log(`Watching ${uploadsDir} for DealerCenter CSV files...`);
watch(uploadsDir, (_event, fileName) => {
  if (fileName) void importFile(fileName.toString());
});
