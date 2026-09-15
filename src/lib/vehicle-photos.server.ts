import { requireStaff } from "./legacy-blog.server";

/**
 * Photo binaries live in the storage account reachable with the server
 * credentials below (bucket `vehicle-photos`, key `<vin>/photo-N.jpg`).
 * The legacy `mycarco_db.mc_cars.image_url` column stores the comma separated
 * `uploads/cars/<vin>/photo-N.jpg` paths, which the public photo proxy and the
 * inventory reader both understand.
 */

export type IncomingPhoto = { dataUrl: string; contentType?: string };
export type PhotoOrderItem =
  | { kind: "keep"; url: string }
  | { kind: "new"; index: number };

type Creds = { url: string; key: string };

function storageCreds(): Creds {
  const candidates: Array<{ url: string | undefined; key: string | undefined }> = [
    { url: process.env["SUPABASE_URL"], key: process.env["SUPABASE_SERVICE_ROLE_KEY"] },
    { url: process.env["LEGACY_SUPABASE_URL"], key: process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"] },
  ];
  const found = candidates.find((c): c is Creds => Boolean(c.url && c.key));
  if (!found) throw new Error("Photo storage is not configured.");
  return found;
}

function legacyCreds(): Creds {
  const url = process.env["LEGACY_SUPABASE_URL"];
  const key = process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("Inventory credentials are not configured.");
  return { url, key };
}

async function rest(
  path: string,
  init: { method?: string; body?: unknown; profile?: "public" | "mycarco_db"; prefer?: string } = {},
) {
  const c = legacyCreds();
  const method = init.method ?? "GET";
  const headers: Record<string, string> = {
    apikey: c.key,
    Authorization: `Bearer ${c.key}`,
    "Content-Type": "application/json",
  };
  if (init.profile) headers[method === "GET" ? "Accept-Profile" : "Content-Profile"] = init.profile;
  if (init.prefer) headers["Prefer"] = init.prefer;
  const requestInit: RequestInit = { method, headers };
  if (init.body !== undefined) requestInit.body = JSON.stringify(init.body);
  const res = await fetch(`${c.url}/rest/v1/${path}`, requestInit);
  const text = await res.text();
  if (!res.ok) throw new Error(`Inventory request failed (${res.status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.*)$/s);
  if (!match) throw new Error("Unsupported image data.");
  const contentType = match[1] ?? "image/jpeg";
  const binary = atob(match[2] ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType };
}

/** `uploads/cars/<vin>/photo-3.jpg` or `/api/public/vehicle-photos/<vin>/photo-3.jpg` -> storage key */
function storageKeyFromUrl(url: string, vin: string): string | null {
  const m = url.match(/photo-(\d+)\.(?:jpe?g|png|webp)$/i);
  if (!m) return null;
  return `${vin}/photo-${m[1]}.jpg`;
}

async function uploadObject(key: string, bytes: Uint8Array, contentType: string) {
  const c = storageCreds();
  const res = await fetch(`${c.url}/storage/v1/object/vehicle-photos/${key}`, {
    method: "POST",
    headers: {
      apikey: c.key,
      Authorization: `Bearer ${c.key}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: bytes as unknown as BodyInit,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Photo upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

async function removeObjects(keys: string[]) {
  if (keys.length === 0) return;
  const c = storageCreds();
  await fetch(`${c.url}/storage/v1/object/vehicle-photos`, {
    method: "DELETE",
    headers: {
      apikey: c.key,
      Authorization: `Bearer ${c.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: keys }),
  }).catch(() => null);
}

/**
 * Stores the ordered photo set for a vehicle: uploads new files, drops removed
 * ones, writes `mc_cars.image_url`, and mirrors `public.vehicle_photos`.
 */
export async function saveVehiclePhotos(input: {
  accessToken: string;
  vin: string;
  altBase: string;
  order: PhotoOrderItem[];
  newPhotos: IncomingPhoto[];
}): Promise<{ urls: string[] }> {
  await requireStaff(input.accessToken);
  const vin = input.vin.trim().toLowerCase();
  if (!vin) throw new Error("A VIN is required to store photos.");

  const legacyRows = (await rest(
    `mc_cars?select=id,image_url&source_id=eq.${encodeURIComponent(vin)}&limit=1`,
    { profile: "mycarco_db" },
  )) as Array<{ id: number; image_url: string | null }>;
  const legacy = legacyRows[0];

  const previousKeys = new Set(
    (legacy?.image_url ?? "")
      .split(/[,|\s]+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => storageKeyFromUrl(p, vin))
      .filter((k): k is string => Boolean(k)),
  );

  const keptKeys = new Set(
    input.order
      .filter((o): o is { kind: "keep"; url: string } => o.kind === "keep")
      .map((o) => storageKeyFromUrl(o.url, vin))
      .filter((k): k is string => Boolean(k)),
  );

  // Assign sequential slots to the final order so photo-1 is always the cover.
  const finalKeys: string[] = [];
  for (let i = 0; i < input.order.length; i++) {
    const item = input.order[i]!;
    const key = `${vin}/photo-${i + 1}.jpg`;
    if (item.kind === "new") {
      const photo = input.newPhotos[item.index];
      if (!photo) continue;
      const { bytes, contentType } = decodeDataUrl(photo.dataUrl);
      await uploadObject(key, bytes, photo.contentType || contentType);
    } else {
      const sourceKey = storageKeyFromUrl(item.url, vin);
      if (sourceKey && sourceKey !== key) {
        const c = storageCreds();
        const res = await fetch(`${c.url}/storage/v1/object/vehicle-photos/${sourceKey}`, {
          headers: { apikey: c.key, Authorization: `Bearer ${c.key}` },
          cache: "no-store",
        });
        if (!res.ok) continue;
        const buffer = new Uint8Array(await res.arrayBuffer());
        await uploadObject(key, buffer, res.headers.get("content-type") ?? "image/jpeg");
      }
    }
    finalKeys.push(key);
  }

  const stale = [...previousKeys, ...keptKeys].filter((k) => !finalKeys.includes(k));
  await removeObjects([...new Set(stale)]);

  const storedPaths = finalKeys.map((k) => `uploads/cars/${k}`);
  const appUrls = finalKeys.map((k) => `/api/public/vehicle-photos/${k}`);

  if (legacy) {
    await rest(`mc_cars?id=eq.${legacy.id}`, {
      method: "PATCH",
      profile: "mycarco_db",
      body: { image_url: storedPaths.length ? storedPaths.join(",") : null },
    });
  }

  const publicRows = (await rest(
    `vehicles?select=id&vin=eq.${encodeURIComponent(vin.toUpperCase())}&limit=1`,
    { profile: "public" },
  )) as Array<{ id: string }>;
  const publicId = publicRows[0]?.id;
  if (publicId) {
    await rest(`vehicle_photos?vehicle_id=eq.${publicId}`, { method: "DELETE", profile: "public" });
    if (appUrls.length) {
      await rest("vehicle_photos", {
        method: "POST",
        profile: "public",
        body: appUrls.map((url, i) => ({
          vehicle_id: publicId,
          url,
          position: i + 1,
          alt: `${input.altBase} — photo ${i + 1}`,
        })),
      });
    }
  }

  return { urls: appUrls };
}
